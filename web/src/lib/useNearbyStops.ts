import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { gql, NEARBY_STATIONS_QUERY, type NearbyStations } from './api'
import { distance } from './geo'
import { useGeolocation } from './useGeolocation'

/** Stop groups within `radius` metres of the user that something stops at, closest first. */
export function useNearbyStations(radius: number) {
  const location = useGeolocation(true)
  const query = useQuery({
    queryKey: ['nearbyStations', location.coords, radius],
    queryFn: () => gql<NearbyStations>(NEARBY_STATIONS_QUERY, { ...location.coords!, radius }),
    enabled: !!location.coords,
    staleTime: 5 * 60_000,
  })
  const stations = useMemo(() => {
    const here = location.coords
    if (!here) return []
    return (query.data?.stationsByRadius ?? [])
      .filter((s) => s.routes.length > 0)
      .map((station) => ({ station, distance: distance(here, { lat: station.lat, lon: station.lon }) }))
      .sort((a, b) => a.distance - b.distance)
  }, [query.data, location.coords])
  return { location, query, stations }
}
