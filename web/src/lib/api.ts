const API_URL = import.meta.env.VITE_API_URL ?? '/graphql'

export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] }
  if (body.errors?.length && !body.data) throw new Error(body.errors[0].message)
  return body.data as T
}

export type RouteType =
  | 'TRAM'
  | 'SUBWAY'
  | 'RAIL'
  | 'BUS'
  | 'FERRY'
  | 'CABLE_TRAM'
  | 'AERIAL_LIFT'
  | 'FUNICULAR'
  | 'TROLLEYBUS'
  | 'MONORAIL'

export type RouteSummary = {
  routeId: string
  shortName: string | null
  longName: string | null
  desc: string | null
  color: string | null
  textColor: string | null
  type: RouteType | null
}

export type RoutesPage = {
  routes: { page: number; pages: number; limit: number; data: RouteSummary[] }
}

export const ROUTES_QUERY = /* GraphQL */ `
  query Routes($limit: Int, $page: Int) {
    routes(limit: $limit, page: $page) {
      limit
      pages
      page
      data {
        routeId
        shortName
        longName
        desc
        color
        textColor
        type
      }
    }
  }
`

export type Stop = { stopId: string; name: string | null; code?: string | null }

export type Direction = { directionId: number; headsign: string; stops: Stop[] }

export type RouteDetails = {
  route:
    | (RouteSummary & {
        directions: Direction[] | null
      })
    | null
}

export const ROUTE_QUERY = /* GraphQL */ `
  query RouteById($routeId: ID!) {
    route(id: $routeId) {
      routeId
      shortName
      longName
      desc
      color
      textColor
      type
      directions {
        headsign
        directionId
        stops {
          stopId
          name
        }
      }
    }
  }
`

export type ClosestStop = { route: { closestStop: Stop | null } | null }

export const CLOSEST_STOP_QUERY = /* GraphQL */ `
  query ClosestStop($routeId: ID!, $lat: Float, $lon: Float) {
    route(id: $routeId) {
      closestStop(lat: $lat, lon: $lon) {
        stopId
        code
        name
      }
    }
  }
`

export type TimetableEntry = {
  arrival: string
  departure: string
  serviceId: string
  tripId: string
  wheelchairAccessible: 'UNKNOWN' | 'AVAILABLE' | 'UNAVAILABLE'
  bikesAllowed: 'UNKNOWN' | 'ALLOWED' | 'NOT_ALLOWED'
  arrivalDelay: number | null
  departureDelay: number | null
  scheduleRelationship: 'SCHEDULED' | 'NO_DATA' | null
  isNext: boolean
  isPast: boolean
}

export type Timetable = { timetable: TimetableEntry[] }

export const TIMETABLE_QUERY = /* GraphQL */ `
  query Timetable($stopId: ID!, $routeId: ID!, $range: RangeInput) {
    timetable(stopId: $stopId, routeId: $routeId, range: $range) {
      arrival
      departure
      serviceId
      tripId
      wheelchairAccessible
      bikesAllowed
      arrivalDelay
      departureDelay
      scheduleRelationship
      isNext
      isPast
    }
  }
`

export type StopSummary = {
  stopId: string
  name: string | null
  code?: string | null
  lat: number | null
  lon: number | null
  routes?: (Pick<RouteSummary, 'routeId' | 'shortName' | 'color' | 'textColor'> | null)[] | null
}

const STOP_FIELDS = /* GraphQL */ `
  stopId
  name
  code
  lat
  lon
`

export type StopsPage = { stops: { page: number; pages: number; data: StopSummary[] } }

export const STOPS_QUERY = /* GraphQL */ `
  query Stops($limit: Int, $page: Int) {
    stops(limit: $limit, page: $page) {
      page
      pages
      data { ${STOP_FIELDS} }
    }
  }
`

export type NearbyStops = { stopsByRadius: (StopSummary | null)[] }

export const NEARBY_STOPS_QUERY = /* GraphQL */ `
  query NearbyStops($lat: Float!, $lon: Float!, $radius: Float!) {
    stopsByRadius(lat: $lat, lon: $lon, radius: $radius) {
      ${STOP_FIELDS}
      routes { routeId shortName color textColor }
    }
  }
`

export type StopsInBox = { stopsByBbox: (StopSummary | null)[] }

export const STOPS_BBOX_QUERY = /* GraphQL */ `
  query StopsInBox($bbox: BboxInput!) {
    stopsByBbox(bbox: $bbox) { ${STOP_FIELDS} }
  }
`

export type StopDetails = { stop: StopSummary | null }

export const STOP_QUERY = /* GraphQL */ `
  query Stop($stopId: ID!) {
    stop(id: $stopId) {
      ${STOP_FIELDS}
      routes { routeId shortName color textColor }
    }
  }
`

export type VehiclePosition = {
  id: string
  latitude: number | null
  longitude: number | null
  bearing: number | null
  vehicleLabel: string | null
  trip: { headsign: string | null; route: Pick<RouteSummary, 'routeId' | 'shortName' | 'color' | 'textColor'> | null } | null
}

export type Vehicles = { vehiclePositions: (VehiclePosition | null)[] }

export const VEHICLES_QUERY = /* GraphQL */ `
  query Vehicles {
    vehiclePositions {
      id
      latitude
      longitude
      bearing
      vehicleLabel
      trip { headsign route { routeId shortName color textColor } }
    }
  }
`
