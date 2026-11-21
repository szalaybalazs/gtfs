import { LineMarks } from '../components/LineMarks'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import AfterFilter, { useAfter } from '../components/AfterFilter'
import Alerts from '../components/Alerts'
import Departures from '../components/Departures'
import { LocationIcon, StarIcon, SwapIcon } from '../components/Icons'
import NavBar from '../components/NavBar'
import RouteBadge from '../components/RouteBadge'
import StationStops from '../components/StationStops'
import StopPicker from '../components/StopPicker'
import Timetable from '../components/Timetable'
import ViewToggle, { useView } from '../components/ViewToggle'
import { gql, ROUTE_QUERY, type Direction, type RouteDetails, type Stop } from '../lib/api'
import FavoriteSheet from '../components/FavoriteSheet'
import { favoriteId, useFavorites, type FavoriteDraft } from '../lib/favorites'
import { distance, formatDistance, hex } from '../lib/geo'
import { useT } from '../lib/i18n'
import { recordVisit } from '../lib/usage'
import { useDepartures } from '../lib/useDepartures'
import { useGeolocation, type Coords } from '../lib/useGeolocation'

/** A stop further than this doesn't count as "near you". */
const NEAR_M = 1000

type Choice = { direction: Direction; stop: Stop; reason: 'chosen' | 'nearest' | 'terminus' | 'first'; metres?: number }

/**
 * Which stop to show. An explicit choice in the URL wins. Otherwise the
 * nearest stop on the route if it is within NEAR_M, else the end stop
 * (first stop of a direction) closest to the user, else the first stop.
 */
function choose(directions: Direction[], dirParam: number | null, stopParam: string | null, here: Coords | null): Choice | null {
  if (directions.length === 0) return null
  const has = (id: string | null) => (d: Direction) => d.stops.some((s) => s.stopId === id)

  if (stopParam || dirParam != null) {
    const direction =
      directions.find((d) => d.directionId === dirParam && (!stopParam || has(stopParam)(d))) ??
      directions.find(has(stopParam)) ??
      directions.find((d) => d.directionId === dirParam) ??
      directions[0]
    const stop = direction.stops.find((s) => s.stopId === stopParam) ?? direction.stops[0]
    if (stop) return { direction, stop, reason: 'chosen' }
  }

  const located = (s: Stop) => here && s.lat != null && s.lon != null
  const metres = (s: Stop) => distance(here!, { lat: s.lat!, lon: s.lon! })

  if (here) {
    // Nearest stop overall, skipping each direction's last stop (nothing departs there)
    const candidates = directions.flatMap((direction) =>
      direction.stops.slice(0, -1).filter(located).map((stop) => ({ direction, stop, m: metres(stop) })),
    )
    const nearest = candidates.sort((a, b) => a.m - b.m)[0]
    if (nearest && nearest.m <= NEAR_M) return { direction: nearest.direction, stop: nearest.stop, reason: 'nearest', metres: nearest.m }

    const termini = directions
      .filter((d) => d.stops[0] && located(d.stops[0]))
      .map((direction) => ({ direction, stop: direction.stops[0], m: metres(direction.stops[0]) }))
      .sort((a, b) => a.m - b.m)
    if (termini[0]) return { direction: termini[0].direction, stop: termini[0].stop, reason: 'terminus', metres: termini[0].m }
  }

  const direction = directions[0]
  return direction.stops[0] ? { direction, stop: direction.stops[0], reason: 'first' } : null
}

export default function RouteDetailsPage() {
  const t = useT()
  const { routeId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const dirParam = params.has('dir') ? Number(params.get('dir')) : null
  const stopParam = params.get('stop')
  const [view] = useView()
  const location = useGeolocation(true)
  const { has } = useFavorites()
  useEffect(() => recordVisit(`route:${routeId}`), [routeId])
  const [sheet, setSheet] = useState(false)

  const routeQuery = useQuery({
    queryKey: ['route', routeId],
    queryFn: () => gql<RouteDetails>(ROUTE_QUERY, { routeId }),
    staleTime: 60 * 60_000,
  })
  const route = routeQuery.data?.route
  const directions = useMemo(() => route?.directions ?? [], [route])
  const choice = choose(directions, dirParam, stopParam, location.coords)
  const direction = choice?.direction
  const stop = choice?.stop

  const { after } = useAfter()
  const arrivedOn = useSearchParams()[0].get('trip')
  // Everything on this line in the next 90 minutes (filtered by line on the server)
  const departuresQuery = useDepartures(stop ? [stop.stopId] : [], { limit: 60, after, routeIds: [routeId] })
  const windowEnd = (after?.getTime() ?? Date.now()) + 90 * 60_000
  const departures = (departuresQuery.data?.departures ?? []).filter(
    (d) => d.route?.routeId === (route?.routeId ?? routeId) && new Date(d.departure).getTime() <= windowEnd,
  )

  const setParam = (changes: Record<string, string | null>) =>
    setParams(
      (p) => {
        for (const [k, v] of Object.entries(changes)) v == null ? p.delete(k) : p.set(k, v)
        return p
      },
      { replace: true },
    )

  const changeDirection = (dir: number) => {
    // Keep the same place when switching direction: each direction usually has its own platform, matched by name
    const target = directions.find((d) => d.directionId === dir)
    if (!target) return
    // Same place by name, unless that is where the new direction ends (e.g.
    // swapping at a terminus): then start from the new direction's first stop
    const departing = target.stops.slice(0, -1)
    const match = departing.find((s) => s.name === stop?.name) ?? target.stops[0]
    setParam({ dir: String(dir), stop: match?.stopId ?? null })
  }

  const otherDirection = directions.find((d) => d.directionId !== direction?.directionId)
  const favoriteOptions: FavoriteDraft[] = route
    ? [
        ...(stop && direction
          ? [{ kind: 'lineStop' as const, route, stopId: stop.stopId, stationId: stop.stopId, stopName: stop.name ?? stop.stopId, headsign: direction.headsign }]
          : []),
        { kind: 'line' as const, route },
      ]
    : []
  const favorite = favoriteOptions.some((o) => has(favoriteId(o)))

  const hint =
    choice?.reason === 'nearest'
      ? t('route.nearest', { d: formatDistance(choice.metres!) })
      : choice?.reason === 'terminus'
        ? t('route.terminus', { d: formatDistance(choice.metres!) })
        : location.loading
          ? t('route.finding')
          : choice?.reason === 'first'
            ? (location.error ?? '')
            : ''

  return (
    <div className="min-h-dvh">
      <NavBar
        back={{ to: '/routes', label: t('nav.routes') }}
        leading={route && <RouteBadge route={route} size="lg" />}
        trailing={
          route && (
            <>
              <ViewToggle />
              <button
              type="button"
              onClick={() => setSheet(true)}
              aria-label={t('common.favourites')}
              className={`rounded-md p-2 active:opacity-50 ${favorite ? 'text-accent' : 'text-label'}`}
            >
              <StarIcon filled={favorite} className="h-6 w-6" />
              </button>
            </>
          )
        }
      />

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        {routeQuery.isError && (
          <p className="p-6 text-center text-secondary">
            {t('route.loadError')}{' '}
            <button type="button" className="font-medium text-accent" onClick={() => routeQuery.refetch()}>
              {t('common.retry')}
            </button>
          </p>
        )}
        {routeQuery.isPending && <div className="h-32 animate-pulse rounded-2xl bg-surface" />}

        {route && <Alerts routeIds={[routeId]} />}

        {route && direction && stop && (
          <section className="space-y-2">
            <div className="rounded-2xl bg-surface p-4">
              <h1 className="text-2xl leading-tight font-bold">{route.desc ?? route.longName}</h1>
              {/* BKK legend marks for the line: low-floor, circular, on request, front door, replacement */}
              <LineMarks flags={route.flags} className="mt-1.5 text-[18px] text-secondary" />
              {hint && <p className="mt-1 text-[15px] text-secondary">{hint}</p>}
            </div>
            <div className="flex gap-2">
              <StopPicker
                stops={direction.stops.slice(0, -1) /* not the last stop: nothing departs there */}
                value={stop}
                color={hex(route.color, 'var(--color-secondary)')}
                onChange={(id) => setParam({ dir: String(direction.directionId), stop: id })}
              />
              {choice.reason === 'chosen' && (
                <button
                  type="button"
                  onClick={() => {
                    setParam({ dir: null, stop: null })
                    location.request()
                  }}
                  aria-label={t('route.nearestStop')}
                  className="flex w-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-accent active:opacity-50"
                >
                  <LocationIcon className="h-5 w-5" />
                </button>
              )}
            </div>
            <button
              type="button"
              disabled={!otherDirection}
              onClick={() => otherDirection && changeDirection(otherDirection.directionId)}
              className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left active:bg-fill disabled:active:bg-surface"
            >
              <span className="w-[4.5rem] shrink-0 text-secondary">{t('route.towards')}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{direction.headsign}</span>
              {otherDirection && <SwapIcon className="h-5 w-5 shrink-0" aria-label={t('route.swap')} />}
            </button>
          </section>
        )}

        {route && stop && (
          <>
            {view === 'departures' ? (
              <Departures
                toolbar={<AfterFilter stopIds={stop ? [stop.stopId] : []} routeIds={[routeId]} />}
                includePast={!!after}
                highlightTrip={arrivedOn}
                title={null}
                departures={departures}
                empty={t('route.empty')}
                isPending={departuresQuery.isPending}
                error={departuresQuery.isError}
                onRetry={() => departuresQuery.refetch()}
              />
            ) : (
              <Timetable lines={[{ route, stopId: stop.stopId }]} />
            )}
          </>
        )}

        {stop && <StationStops id={stop.stopId} current={stop.stopId} />}
      </main>
      {sheet && <FavoriteSheet options={favoriteOptions} onClose={() => setSheet(false)} />}
    </div>
  )
}
