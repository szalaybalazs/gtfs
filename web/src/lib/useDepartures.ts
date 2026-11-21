import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { DEPARTURES_QUERY, gql, type Departures } from './api'
import { REFRESH_MS } from './useTimetable'

/** Next departures from any of the stops, across all routes. */
export function useDepartures(
  stopIds: string[],
  { limit = 20, enabled = true, after = null as Date | null, routeIds = null as string[] | null, arrivals = false } = {},
) {
  const ids = [...stopIds].sort()
  const afterIso = after?.toISOString() ?? null
  return useQuery({
    queryKey: ['departures', ids, routeIds, limit, afterIso, arrivals],
    queryFn: () => gql<Departures>(DEPARTURES_QUERY, { stopIds: ids, routeIds, limit, after: afterIso, arrivals }),
    enabled: enabled && ids.length > 0,
    refetchInterval: REFRESH_MS,
    placeholderData: (prev) => prev,
  })
}

/**
 * How many departures to fetch so a list of `show` rows never runs short:
 * two spare, plus one for each departure about to drop out (leaving within a
 * minute, or gone less than 35 s ago and still counting down), at most 5.
 * With a chosen time (`fixed`) nothing drops out, so it's just show + 2.
 * Re-checked every few seconds against the data on screen.
 */
export function useSteadyLimit(show: number, departures: { departure: string }[] | undefined, fixed = false) {
  const [soon, setSoon] = useState(0)
  useEffect(() => {
    if (fixed) return
    const count = () => {
      const now = Date.now()
      const n = (departures ?? []).filter((d) => {
        const dt = new Date(d.departure).getTime() - now
        return dt > -35_000 && dt < 60_000
      }).length
      setSoon(Math.min(n, 5))
    }
    count()
    const id = setInterval(count, 5_000)
    return () => clearInterval(id)
  }, [departures, fixed])
  return show + 2 + (fixed ? 0 : soon)
}
