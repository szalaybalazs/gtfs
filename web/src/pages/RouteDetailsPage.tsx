import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { LocationIcon } from '../components/Icons'
import NavBar from '../components/NavBar'
import PickerRow from '../components/PickerRow'
import RouteBadge from '../components/RouteBadge'
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

  return (
    <div className="min-h-dvh">
      <NavBar
        back={{ to: '/', label: 'Routes' }}
        title={
          route ? (
            <span className="flex items-center gap-3">
              <RouteBadge route={route} size="lg" />
              <span className="truncate text-2xl font-semibold">{route.desc ?? route.longName}</span>
            </span>
          ) : (
            routeId
          )
        }
      />

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        {routeQuery.isError && (
          <p className="p-6 text-center text-secondary">
            Couldn't load this route.{' '}
            <button type="button" className="text-accent" onClick={() => routeQuery.refetch()}>
              Retry
            </button>
          </p>
        )}

        <section>
          <div className="divide-y divide-separator overflow-hidden rounded-xl bg-surface">
            <PickerRow
              label="Stop"
              value={stop?.stopId}
              options={(direction?.stops ?? []).map((s) => ({ value: s.stopId, label: s.name ?? s.stopId }))}
              onChange={(id) => direction && select({ dir: direction.directionId, stop: id })}
            />
            <PickerRow
              label="Direction"
              value={direction?.directionId}
              options={directions.map((d) => ({ value: d.directionId, label: d.headsign }))}
              onChange={changeDirection}
            />
          </div>
          <div className="flex items-center justify-between gap-2 px-4 pt-1.5 text-[13px] text-secondary">
            <span>
              {location.loading
                ? 'Finding the closest stop…'
                : isClosest
                  ? 'Closest stop to you'
                  : location.error
                    ? location.error
                    : null}
            </span>
            {!isClosest && !location.loading && (
              <button type="button" onClick={useClosest} className="flex items-center gap-1 text-accent">
                <LocationIcon className="h-3.5 w-3.5" />
                Closest stop
              </button>
            )}
          </div>
        </section>

        {direction && stop && <Timetable routeId={routeId} stopId={stop.stopId} />}
        {routeQuery.isPending && <p className="p-6 text-center text-sm text-secondary">Loading…</p>}
      </main>
    </div>
  )
}
