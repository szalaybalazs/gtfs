import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router'
import Departures from '../components/Departures'
import { LocationIcon, StarIcon, SwapIcon } from '../components/Icons'
import NavBar from '../components/NavBar'
import RouteBadge from '../components/RouteBadge'
import StopLine from '../components/StopLine'
import Timetable from '../components/Timetable'
import {
  CLOSEST_STOP_QUERY,
  gql,
  ROUTE_QUERY,
  type ClosestStop,
  type Direction,
  type RouteDetails,
  type Stop,
} from '../lib/api'
import { useFavorites } from '../lib/favorites'
import { useGeolocation } from '../lib/useGeolocation'

/**
 * Picks the direction and stop to show. An explicit choice in the URL wins,
 * then the stop closest to the user, then the first stop of the first
 * direction — the same order the app uses.
 */
function resolveSelection(
  directions: Direction[],
  dirParam: number | null,
  stopParam: string | null,
  closest: Stop | null | undefined,
) {
  const contains = (id: string | undefined) => (d: Direction) => d.stops.some((s) => s.stopId === id)
  const direction =
    directions.find((d) => d.directionId === dirParam) ??
    (stopParam ? directions.find(contains(stopParam)) : undefined) ??
    (closest ? directions.find(contains(closest.stopId)) : undefined) ??
    directions[0]
  if (!direction) return { direction: undefined, stop: undefined }

  const stop =
    direction.stops.find((s) => s.stopId === stopParam) ??
    (closest
      ? (direction.stops.find((s) => s.stopId === closest.stopId) ??
        direction.stops.find((s) => s.name === closest.name))
      : undefined) ??
    direction.stops[0]
  return { direction, stop }
}

export default function RouteDetailsPage() {
  const { routeId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const dirParam = params.has('dir') ? Number(params.get('dir')) : null
  const stopParam = params.get('stop')
  const location = useGeolocation(true)
  const { isFavorite, toggle } = useFavorites()

  const routeQuery = useQuery({
    queryKey: ['route', routeId],
    queryFn: () => gql<RouteDetails>(ROUTE_QUERY, { routeId }),
    staleTime: 60 * 60_000,
  })

  const closestQuery = useQuery({
    queryKey: ['closestStop', routeId, location.coords],
    queryFn: () => gql<ClosestStop>(CLOSEST_STOP_QUERY, { routeId, ...location.coords }),
    enabled: !!location.coords,
    staleTime: 5 * 60_000,
  })
  const closest = closestQuery.data?.route?.closestStop

  const route = routeQuery.data?.route
  const directions = useMemo(() => route?.directions ?? [], [route])
  const { direction, stop } = resolveSelection(directions, dirParam, stopParam, closest)

  const select = (next: { dir: number; stop?: string }) =>
    setParams(
      (p) => {
        p.set('dir', String(next.dir))
        if (next.stop) p.set('stop', next.stop)
        else p.delete('stop')
        return p
      },
      { replace: true },
    )

  const changeDirection = (dir: number) => {
    // Keep the same physical stop when switching direction, matched by name
    // since each direction usually has its own platform id.
    const target = directions.find((d) => d.directionId === dir)
    const match = target?.stops.find((s) => s.name === stop?.name)
    select({ dir, stop: match?.stopId })
  }

  const useClosest = () => {
    setParams(
      (p) => {
        p.delete('dir')
        p.delete('stop')
        return p
      },
      { replace: true },
    )
    location.request()
  }

  const isClosest = !!closest && !!stop && (stop.stopId === closest.stopId || stop.name === closest.name)

  const otherDirection = directions.find((d) => d.directionId !== direction?.directionId)
  const lineColor = route?.color ? (route.color.startsWith('#') ? route.color : `#${route.color}`) : 'var(--color-secondary)'
  const favorite = isFavorite(routeId)

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

        {route && direction && (
          <section className="space-y-2">
            <div className="rounded-2xl bg-surface p-4">
              <h1 className="text-2xl leading-tight font-bold">{route.desc ?? route.longName}</h1>
              <p className="mt-1 text-[15px] text-secondary">
                {location.loading
                  ? 'Finding the closest stop…'
                  : isClosest
                    ? 'Showing the stop closest to you'
                    : (location.error ?? '')}
              </p>
            </div>
            <div className="flex gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-surface px-4 py-3">
                <span className="text-secondary">From</span>
                <span className="truncate font-medium">{stop?.name}</span>
              </div>
              {!isClosest && !location.loading && (
                <button
                  type="button"
                  onClick={useClosest}
                  aria-label="Closest stop"
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

        {direction && stop && <Departures routeId={routeId} stopId={stop.stopId} />}

        {direction && (
          <section>
            <h2 className="px-1 pb-2 text-xl font-bold">Stops</h2>
            <StopLine
              stops={direction.stops}
              selectedId={stop?.stopId}
              closestId={closest?.stopId}
              color={lineColor}
              onSelect={(id) => {
                select({ dir: direction.directionId, stop: id })
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            />
          </section>
        )}

        {direction && stop && <Timetable routeId={routeId} stopId={stop.stopId} />}
      </main>
    </div>
  )
}
