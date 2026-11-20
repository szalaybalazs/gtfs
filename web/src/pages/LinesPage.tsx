import { useQueries, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { ChevronIcon } from '../components/Icons'
import NavBar from '../components/NavBar'
import RouteBadge from '../components/RouteBadge'
import { gql, ROUTE_QUERY, SHARED_STATIONS_QUERY, type RouteDetails, type RouteRef, type SharedStation, type SharedStations } from '../lib/api'
import { formatDistance } from '../lib/geo'
import { useGeolocation } from '../lib/useGeolocation'

export const linesUrl = (routeIds: string[]) => `/lines?ids=${routeIds.map(encodeURIComponent).join(',')}`

/** Departures for several lines at one stop group: `/stations/:id?lines=a,b` */
export const stationLinesUrl = (stationId: string, routeIds: string[]) =>
  `/stations/${encodeURIComponent(stationId)}?lines=${routeIds.map(encodeURIComponent).join(',')}`

/**
 * Several lines picked on the Routes page (long-press). Lines can only share a
 * departures board where they actually meet, so this lists the stop groups
 * they have in common: all of them first, then places only some share,
 * nearest first. A stop group may have separate platforms per line; the
 * board then shows all of them, and tapping a platform narrows it.
 */
export default function LinesPage() {
  const [params] = useSearchParams()
  const ids = (params.get('ids') ?? '').split(',').filter(Boolean).slice(0, 12)
  const location = useGeolocation(true)

  const routes = useQueries({
    queries: ids.map((routeId) => ({
      queryKey: ['route', routeId],
      queryFn: () => gql<RouteDetails>(ROUTE_QUERY, { routeId }),
      staleTime: 60 * 60_000,
    })),
  })
    .map((q) => q.data?.route)
    .filter((r): r is NonNullable<typeof r> => !!r)

  const coords = location.coords
  const query = useQuery({
    // Rounded so a GPS jitter doesn't refetch
    queryKey: ['sharedStations', ids, coords && [coords.lat.toFixed(3), coords.lon.toFixed(3)]],
    queryFn: () => gql<SharedStations>(SHARED_STATIONS_QUERY, { routeIds: ids, lat: coords?.lat, lon: coords?.lon }),
    enabled: ids.length >= 2,
    staleTime: 60 * 60_000,
    // Keep the list on screen when the location arrives and it re-sorts
    placeholderData: (prev) => prev,
  })
  const shared = query.data?.sharedStations ?? []
  // Lines as the server resolved them (duplicate or variant ids in the URL count once)
  const lineCount = routes.length >= 2 ? new Set(routes.map((r) => r.routeId)).size : ids.length
  const all = shared.filter((s) => s.routes.length >= lineCount)
  const some = shared.filter((s) => s.routes.length < lineCount)

  return (
    <div className="min-h-dvh">
      <NavBar title="Shared stops" back={{ label: 'Routes' }} />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <div className="flex flex-wrap gap-1.5 rounded-2xl bg-surface p-4">
          {routes.map((r) => (
            <RouteBadge key={r.routeId} route={r} fit />
          ))}
          {routes.length === 0 && <span className="text-secondary">…</span>}
        </div>

        {ids.length < 2 && <p className="p-6 text-center text-secondary">Pick at least two lines on the Routes page (long-press a line).</p>}
        {query.isPending && ids.length >= 2 && <div className="h-40 animate-pulse rounded-2xl bg-surface" />}
        {query.isError && (
          <p className="p-6 text-center text-secondary">
            Couldn't load shared stops.{' '}
            <button type="button" className="font-medium text-accent" onClick={() => query.refetch()}>
              Retry
            </button>
          </p>
        )}

        {query.isSuccess && shared.length === 0 && (
          <p className="p-6 text-center text-secondary">These lines never stop at the same place, so they can't share a departures board.</p>
        )}

        {all.length > 0 && (
          <Section title={lineCount === 2 ? 'Both lines stop at' : `All ${lineCount} lines stop at`} items={all} />
        )}
        {some.length > 0 && <Section title={all.length ? 'Some of the lines' : 'Only some of the lines meet'} items={some} showLines />}
      </main>
    </div>
  )
}

function Section({ title, items, showLines }: { title: string; items: SharedStation[]; showLines?: boolean }) {
  return (
    <section>
      <h2 className="px-1 pb-2 text-xl font-bold">{title}</h2>
      <ul className="divide-y divide-separator overflow-hidden rounded-2xl bg-surface">
        {items.map(({ station, routes, distance }) => (
          <li key={station.stationId}>
            <Link to={stationLinesUrl(station.stationId, routes.map((r) => r.routeId))} className="flex items-center gap-3 px-4 py-3 active:bg-fill">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-semibold">
                  {station.name}
                  {distance != null && <span className="ml-2 font-normal text-secondary">{formatDistance(distance)}</span>}
                </p>
                <p className="truncate text-[13px] text-secondary">{platformNote(station.stops ?? [], routes)}</p>
                {showLines && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {routes.map((r) => (
                      <RouteBadge key={r.routeId} route={r} fit />
                    ))}
                  </div>
                )}
              </div>
              <ChevronIcon className="h-4 w-4 shrink-0 text-secondary/60" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** "Same platform" when one platform serves every line, else how many stops they're spread over */
function platformNote(stops: NonNullable<SharedStation['station']['stops']>, routes: RouteRef[]) {
  const ids = new Set(routes.map((r) => r.routeId))
  const used = stops.filter((s) => (s.routes ?? []).some((r) => r && ids.has(r.routeId)))
  const together = used.some((s) => routes.every((r) => (s.routes ?? []).some((x) => x?.routeId === r.routeId)))
  if (together) return 'Same platform'
  return `Different platforms · ${used.length} stops in this group`
}
