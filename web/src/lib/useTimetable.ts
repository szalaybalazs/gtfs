import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { gql, TIMETABLE_QUERY, type Timetable } from './api'

export const REFRESH_MS = 15_000

/** Timetable for one stop on one route. Shared cache, so several components can use it. */
export function useTimetable(routeId: string, stopId: string) {
  return useQuery({
    queryKey: ['timetable', routeId, stopId],
    queryFn: () => gql<Timetable>(TIMETABLE_QUERY, { routeId, stopId }),
    refetchInterval: REFRESH_MS,
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[1] === routeId ? prev : undefined),
  })
}

export function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
