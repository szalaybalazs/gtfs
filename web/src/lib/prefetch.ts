import type { QueryClient } from '@tanstack/react-query'
import { gql, STATION_QUERY, TRIP_QUERY, type RouteRef, type Station, type StationDetails, type TripDetails } from './api'

/**
 * Faster page changes without extra server load:
 * - pages start from what an earlier list already loaded (cache lookups), so
 *   the header is there instantly instead of a grey box;
 * - pressing a row starts its page's top-level request ~100–200 ms before the
 *   click lands. Only the row actually touched, never a whole list.
 */

export const tripKey = (tripId: string, date?: string | null) => ['trip', tripId, date || undefined] as const
export const stationKey = (id: string) => ['station', id] as const

/** A stop group some list already loaded (nearby, all stops, map, search), if any. */
export function findCachedStation(qc: QueryClient, id: string): Station | undefined {
  let found: Station | undefined
  const visit = (v: unknown, depth: number) => {
    if (found || depth > 5 || v == null || typeof v !== 'object') return
    if (Array.isArray(v)) {
      for (const x of v) visit(x, depth + 1)
      return
    }
    const o = v as Record<string, unknown>
    if (o.stationId === id && typeof o.name === 'string' && Array.isArray(o.routes)) {
      found = o as unknown as Station
      return
    }
    for (const x of Object.values(o)) visit(x, depth + 1)
  }
  for (const q of qc.getQueryCache().getAll()) {
    if (q.queryKey[0] === 'station') continue
    visit(q.state.data, 0)
    if (found) break
  }
  return found
}

export function prefetchStation(qc: QueryClient, id: string) {
  return qc.prefetchQuery({ queryKey: stationKey(id), queryFn: () => gql<StationDetails>(STATION_QUERY, { id }), staleTime: 60 * 60_000 })
}

export function prefetchTrip(qc: QueryClient, tripId: string, date?: string | null) {
  return qc.prefetchQuery({
    queryKey: tripKey(tripId, date),
    queryFn: () => gql<TripDetails>(TRIP_QUERY, { id: tripId, serviceDate: date || undefined }),
    staleTime: 15_000,
  })
}

/** What a tapped row already knows about the trip it opens, handed over as router state. */
export type TripPreview = { route?: RouteRef | null; headsign?: string | null }
