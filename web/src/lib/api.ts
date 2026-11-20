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

export type Stop = { stopId: string; name: string | null; code?: string | null; lat?: number | null; lon?: number | null }

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
          lat
          lon
        }
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
  serviceDate: string | null
  headsign: string | null
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
      serviceDate
      headsign
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
  headsigns?: string[]
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
      headsigns
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
  vehicleId: string | null
  vehicleLicensePlate: string | null
  tripStartDate: string | null
  trip: { tripId: string; headsign: string | null; route: RouteRef | null } | null
}

export type Vehicles = { vehiclePositions: (VehiclePosition | null)[] }

export const VEHICLES_QUERY = /* GraphQL */ `
  query Vehicles($bbox: BboxInput) {
    vehiclePositions(bbox: $bbox) {
      id
      latitude
      longitude
      bearing
      vehicleLabel vehicleId vehicleLicensePlate tripStartDate
      trip { tripId headsign route { routeId shortName color textColor type } }
    }
  }
`

export type RouteRef = Pick<RouteSummary, 'routeId' | 'shortName' | 'color' | 'textColor'> & { type?: RouteType | null }
const ROUTE_REF = 'routeId shortName color textColor type'

export type Departure = {
  tripId: string
  serviceDate: string
  stopId: string
  route: RouteRef | null
  headsign: string | null
  via?: string | null
  arrival: string
  departure: string
  arrivalDelay: number | null
  departureDelay: number | null
  realtime: boolean
  wheelchairAccessible: 'UNKNOWN' | 'AVAILABLE' | 'UNAVAILABLE'
  bikesAllowed: 'UNKNOWN' | 'ALLOWED' | 'NOT_ALLOWED'
}

export type Departures = { departures: Departure[] }

export const DEPARTURES_QUERY = /* GraphQL */ `
  query Departures($stopIds: [ID!]!, $routeIds: [ID!], $limit: Int, $hours: Int, $after: DateTime) {
    departures(stopIds: $stopIds, routeIds: $routeIds, limit: $limit, hours: $hours, after: $after) {
      tripId serviceDate stopId headsign arrival departure arrivalDelay departureDelay
      realtime wheelchairAccessible bikesAllowed
      route { ${ROUTE_REF} }
    }
  }
`

export type Station = {
  stationId: string
  name: string
  lat: number
  lon: number
  routes: RouteRef[]
  stops?: (StopSummary & { routes?: (RouteRef | null)[] | null; headsigns?: string[] })[]
}

export type StationsPage = { stations: { page: number; pages: number; total: number; data: Station[] } }

export const STATIONS_QUERY = /* GraphQL */ `
  query Stations($limit: Int, $page: Int, $search: String) {
    stations(limit: $limit, page: $page, search: $search) {
      page pages total
      data { stationId name lat lon routes { ${ROUTE_REF} } stops { stopId name code headsigns routes { ${ROUTE_REF} } } }
    }
  }
`

export type NearbyStations = { stationsByRadius: Station[] }

export const NEARBY_STATIONS_QUERY = /* GraphQL */ `
  query NearbyStations($lat: Float!, $lon: Float!, $radius: Float!) {
    stationsByRadius(lat: $lat, lon: $lon, radius: $radius) {
      stationId name lat lon routes { ${ROUTE_REF} }
      stops { stopId name code lat lon headsigns routes { ${ROUTE_REF} } }
    }
  }
`

export type StationDetails = { station: Station | null }

export const STATION_QUERY = /* GraphQL */ `
  query Station($id: ID!) {
    station(id: $id) {
      stationId name lat lon
      routes { ${ROUTE_REF} }
      stops { stopId name code lat lon headsigns routes { ${ROUTE_REF} } }
    }
  }
`

export type TripStop = {
  stop: {
    stopId: string
    name: string | null
    lat: number | null
    lon: number | null
    station: { stationId: string; routes: RouteRef[] } | null
  }
  stopSequence: number
  arrival: string
  departure: string
  arrivalDelay: number | null
  departureDelay: number | null
  realtime: boolean
}

export type TripDetails = {
  trip: {
    tripId: string
    serviceDate: string
    headsign: string | null
    route: RouteRef | null
    stops: TripStop[]
    vehicle: {
      latitude: number | null
      longitude: number | null
      bearing: number | null
      vehicleLabel: string | null
      vehicleLicensePlate: string | null
      vehicleWheelchairAccessible: boolean | null
      currentStopSequence: number | null
      timestamp: string | null
    } | null
    path: { coordinates: [number, number][] } | null
  } | null
}

export const TRIP_QUERY = /* GraphQL */ `
  query Trip($id: ID!, $serviceDate: String) {
    trip(id: $id, serviceDate: $serviceDate) {
      tripId serviceDate headsign
      route { ${ROUTE_REF} }
      stops {
        stopSequence arrival departure arrivalDelay departureDelay realtime
        stop { stopId name lat lon station { stationId routes { ${ROUTE_REF} } } }
      }
      vehicle {
        latitude longitude bearing vehicleLabel vehicleLicensePlate
        vehicleWheelchairAccessible currentStopSequence timestamp
      }
      path { coordinates }
    }
  }
`

/** Map: stop groups only (lines for colour + badges), cheap enough for a wide area. */
export const MAP_GROUPS_QUERY = /* GraphQL */ `
  query MapGroups($lat: Float!, $lon: Float!, $radius: Float!) {
    stationsByRadius(lat: $lat, lon: $lon, radius: $radius) {
      stationId name lat lon routes { ${ROUTE_REF} }
    }
  }
`

/** Map, zoomed in: each stop of each group with its lines (no directions). */
export const MAP_STOPS_QUERY = /* GraphQL */ `
  query MapStops($lat: Float!, $lon: Float!, $radius: Float!) {
    stationsByRadius(lat: $lat, lon: $lon, radius: $radius) {
      stationId name lat lon routes { ${ROUTE_REF} }
      stops { stopId name lat lon routes { ${ROUTE_REF} } }
    }
  }
`

export type Alert = {
  id: string
  header: string
  description: string | null
  url: string | null
  start: string | null
  end: string | null
  effect: string | null
  routes: RouteRef[]
  stopIds: string[]
}

export const ALERTS_QUERY = /* GraphQL */ `
  query Alerts($routeIds: [ID!], $stopIds: [ID!], $lang: String) {
    alerts(routeIds: $routeIds, stopIds: $stopIds, lang: $lang) {
      id header description url start end effect stopIds
      routes { ${ROUTE_REF} }
    }
  }
`

export type SharedStation = { station: Station; routes: RouteRef[]; distance: number | null }
export type SharedStations = { sharedStations: SharedStation[] }

export const SHARED_STATIONS_QUERY = /* GraphQL */ `
  query SharedStations($routeIds: [ID!]!, $lat: Float, $lon: Float) {
    sharedStations(routeIds: $routeIds, lat: $lat, lon: $lon) {
      distance
      routes { ${ROUTE_REF} }
      station { stationId name lat lon stops { stopId name code headsigns routes { ${ROUTE_REF} } } }
    }
  }
`
