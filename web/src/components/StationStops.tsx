import { useQuery } from '@tanstack/react-query'
import { gql, STATION_QUERY, type StationDetails } from '../lib/api'
import MiniMap from './MiniMap'
import StopRow from './StopRow'

/**
 * "Stops here" + map for a stop group. Shared by the stop-group page and the
 * route page, so both read the same. `id` may be the group id or any of its
 * stop ids; `current` is highlighted.
 */
export default function StationStops({
  id,
  current,
  onSelect,
}: {
  id: string
  current?: string | null
  /** When set, tapping a stop selects it (tap again to clear) instead of opening it. */
  onSelect?: (stopId: string | null) => void
}) {
  const query = useQuery({
    queryKey: ['station', id],
    queryFn: () => gql<StationDetails>(STATION_QUERY, { id }),
    staleTime: 60 * 60_000,
  })
  const stops = (query.data?.station?.stops ?? []).filter((s) => (s.routes ?? []).some(Boolean))
  if (stops.length === 0) return null
  return (
    <>
      <section>
        <div className="flex items-baseline justify-between px-1 pb-2">
          <h2 className="text-xl font-bold">Stops here</h2>
          {onSelect && current && (
            <button type="button" onClick={() => onSelect(null)} className="text-[15px] font-medium text-accent">
              Show all
            </button>
          )}
        </div>
        <ul className="overflow-hidden rounded-2xl bg-surface">
          {stops.map((stop) => (
            <StopRow
              key={stop.stopId}
              stop={stop}
              highlighted={stop.stopId === current}
              onSelect={onSelect ? () => onSelect(stop.stopId) : undefined}
            />
          ))}
        </ul>
      </section>
      <section>
        <h2 className="px-1 pb-2 text-xl font-bold">Map</h2>
        <MiniMap
          area
          height={220}
          points={stops
            .filter((s) => s.lat != null && s.lon != null)
            .map((s) => ({ lat: s.lat!, lon: s.lon!, strong: s.stopId === current }))}
        />
      </section>
    </>
  )
}
