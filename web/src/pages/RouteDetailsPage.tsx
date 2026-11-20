import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router'
import AfterFilter, { useAfter } from '../components/AfterFilter'
import Departures from '../components/Departures'
import { LocationIcon, StarIcon, SwapIcon, UpDownIcon } from '../components/Icons'
import NavBar from '../components/NavBar'
import RouteBadge from '../components/RouteBadge'
import Segmented from '../components/Segmented'
import Timetable from '../components/Timetable'
import { gql, ROUTE_QUERY, type Direction, type RouteDetails, type Stop } from '../lib/api'
import { useFavorites } from '../lib/favorites'
import { distance, formatDistance } from '../lib/geo'
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
  const { routeId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const dirParam = params.has('dir') ? Number(params.get('dir')) : null
  const stopParam = params.get('stop')
  const view = params.get('view') === 'timetable' ? 'timetable' : 'departures'
  const location = useGeolocation(true)
  const { isFavorite, toggle } = useFavorites()

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

  const [after] = useAfter()
  const departuresQuery = useDepartures(stop ? [stop.stopId] : [], { limit: 40, after })
  const departures = (departuresQuery.data?.departures ?? []).filter((d) => d.route?.routeId === routeId).slice(0, 8)

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
  const favorite = isFavorite(routeId)

  const hint =
    choice?.reason === 'nearest'
      ? `Nearest stop to you · ${formatDistance(choice.metres!)}`
      : choice?.reason === 'terminus'
        ? `Nothing close by, so showing the end stop · ${formatDistance(choice.metres!)}`
        : location.loading
          ? 'Finding the nearest stop…'
          : choice?.reason === 'first'
            ? (location.error ?? '')
            : ''

  return (
    <div className="min-h-dvh">
      <NavBar
        back={{ to: '/routes', label: 'Routes' }}
        leading={route && <RouteBadge route={route} size="lg" />}
        trailing={
          route && (
            <button
              type="button"
              onClick={() => toggle(route)}
              aria-pressed={favorite}
              aria-label={favorite ? 'Remove from favourites' : 'Add to favourites'}
              className={`rounded-md p-2 active:opacity-50 ${favorite ? 'text-accent' : 'text-label'}`}
            >
              <StarIcon filled={favorite} className="h-6 w-6" />
            </button>
          )
        }
      />

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        {routeQuery.isError && (
          <p className="p-6 text-center text-secondary">
            Couldn't load this route.{' '}
            <button type="button" className="font-medium text-accent" onClick={() => routeQuery.refetch()}>
              Retry
            </button>
          </p>
        )}
        {routeQuery.isPending && <div className="h-32 animate-pulse rounded-2xl bg-surface" />}

        {route && direction && stop && (
          <section className="space-y-2">
            <div className="rounded-2xl bg-surface p-4">
              <h1 className="text-2xl leading-tight font-bold">{route.desc ?? route.longName}</h1>
              {hint && <p className="mt-1 text-[15px] text-secondary">{hint}</p>}
            </div>
            <div className="flex gap-2">
              {/* Native select under a styled row: the system picker on phones */}
              <label className="relative flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-surface px-4 py-3 has-focus-visible:ring-2 has-focus-visible:ring-accent">
                <span className="text-secondary">From</span>
                <span className="min-w-0 flex-1 truncate font-medium">{stop.name}</span>
                <UpDownIcon className="h-4 w-4 shrink-0 text-secondary" />
                <select
                  aria-label="Stop"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  value={stop.stopId}
                  onChange={(e) => setParam({ dir: String(direction.directionId), stop: e.target.value })}
                >
                  {/* Not the last stop: nothing departs from there */}
                  {direction.stops.slice(0, -1).map((s) => (
                    <option key={s.stopId} value={s.stopId}>
                      {s.name ?? s.stopId}
                    </option>
                  ))}
                </select>
              </label>
              {choice.reason === 'chosen' && (
                <button
                  type="button"
                  onClick={() => {
                    setParam({ dir: null, stop: null })
                    location.request()
                  }}
                  aria-label="Nearest stop"
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
              <span className="text-secondary">Towards</span>
              <span className="min-w-0 flex-1 truncate font-medium">{direction.headsign}</span>
              {otherDirection && <SwapIcon className="h-5 w-5 shrink-0" aria-label="Swap direction" />}
            </button>
          </section>
        )}

        {route && stop && (
          <>
            <Segmented
              label="View"
              value={view}
              onChange={(v) => setParam({ view: v === 'timetable' ? v : null })}
              options={[
                { value: 'departures', label: 'Departures' },
                { value: 'timetable', label: 'Timetable' },
              ]}
            />
            {view === 'departures' ? (
              <Departures
                toolbar={<AfterFilter />}
                title={null}
                departures={departures}
                isPending={departuresQuery.isPending}
                error={departuresQuery.isError}
                onRetry={() => departuresQuery.refetch()}
              />
            ) : (
              <Timetable lines={[{ route, stopId: stop.stopId }]} />
            )}
          </>
        )}

      </main>
    </div>
  )
}
