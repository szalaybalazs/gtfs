import { useQuery } from '@tanstack/react-query'
import { DEPARTURES_QUERY, gql, type Departures } from './api'
import { REFRESH_MS } from './useTimetable'

/** Next departures from any of the stops, across all routes. */
export function useDepartures(
  stopIds: string[],
  { limit = 20, enabled = true, after = null as Date | null } = {},
) {
  const ids = [...stopIds].sort()
  const afterIso = after?.toISOString() ?? null
  return useQuery({
    queryKey: ['departures', ids, limit, afterIso],
    queryFn: () => gql<Departures>(DEPARTURES_QUERY, { stopIds: ids, limit, after: afterIso }),
    enabled: enabled && ids.length > 0,
    refetchInterval: REFRESH_MS,
    placeholderData: (prev) => prev,
  })
}
