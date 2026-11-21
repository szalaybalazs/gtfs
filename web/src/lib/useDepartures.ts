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
 * two spare, plus one for every departure leaving within a minute (or that
 * just left and is still counting down), since each of those is about to drop
 * out. Re-checked every few seconds against the data on screen.
 */
export function useSteadyLimit(show: number, departures: { departure: string }[] | undefined) {
  const [soon, setSoon] = useState(0)
  useEffect(() => {
    const count = () =>
      setSoon((departures ?? []).filter((d) => new Date(d.departure).getTime() - Date.now() < 60_000).length)
    count()
    const id = setInterval(count, 5_000)
    return () => clearInterval(id)
  }, [departures])
  return show + 2 + soon
}
