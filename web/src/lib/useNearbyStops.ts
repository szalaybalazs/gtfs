import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { gql, NEARBY_STOPS_QUERY, type NearbyStops } from './api'
import { distance } from './geo'
import { useGeolocation } from './useGeolocation'

/** Stops within `radius` metres of the user, closest first. */
export function useNearbyStops(radius: number) {
  const location = useGeolocation(true)
  const query = useQuery({
    queryKey: ['nearby', location.coords, radius],
    queryFn: () => gql<NearbyStops>(NEARBY_STOPS_QUERY, { ...location.coords!, radius }),
    enabled: !!location.coords,
    staleTime: 5 * 60_000,
  })
  const stops = useMemo(() => {
    const here = location.coords
    if (!here) return []
    return (query.data?.stopsByRadius ?? [])
      .filter((s) => s != null && s.lat != null && s.lon != null)
      .map((stop) => ({ stop: stop!, distance: distance(here, { lat: stop!.lat!, lon: stop!.lon! }) }))
      .sort((a, b) => a.distance - b.distance)
  }, [query.data, location.coords])
  return { location, query, stops }
}
