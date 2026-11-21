export const typeDefs = `#graphql
  scalar JSON
  scalar Date
  scalar Time
  scalar DateTime
  scalar Coordinates
  type PointGeometry {
    type: String!
    coordinates: Coordinates!
  }
  type PointProps {
    id: Int!
    lat: Float
    lon: Float
  }
  type PointObject {
    type: String!
    geometry: PointGeometry
    properties: PointProps
  }
  type LineStringGeometry {
    type: String!
    coordinates: [Coordinates]
  }
  type FeatureCollection {
    type: String!
    features: [PointObject]
  }

  enum ScheduleRelationship {
    SCHEDULED
    NO_DATA
  }

  enum RouteType {
    TRAM
    SUBWAY
    RAIL
    BUS
    FERRY
    CABLE_TRAM
    AERIAL_LIFT
    FUNICULAR
    TROLLEYBUS
    MONORAIL
  }

  enum LocationType {
    STOP
    STATION
    ENTRANCE_EXIT
    GENERIC_NODE
    BOARDING_AREA
  }

  enum WheelchairBoarding {
    UNKNOWN
    AVAILABLE
    UNAVAILABLE
  }

  enum BikesAllowed {
    UNKNOWN
    ALLOWED
    NOT_ALLOWED
  }

  type Agency {
    agencyId: ID!
    name: String
    url: String
    timezone: String
    lang: String
    phone: String
    fareUrl: String

    # Custom fields
    routes: [Route]
    stops: [Stop]
  }

  type TimetableEntry {
    arrival: DateTime!
    departure: DateTime!
    serviceId: ID!
    tripId: ID!
    wheelchairAccessible: WheelchairBoarding!
    bikesAllowed: BikesAllowed!

    arrivalDelay: Int
    departureDelay: Int
    scheduleRelationship: ScheduleRelationship

    # Custom fields
    isNext: Boolean!
    isPast: Boolean!
    serviceDate: String
    headsign: String
  }

  "Stops grouped by name and proximity (the feed has no parent stations)"
  type Station {
    stationId: ID!
    name: String!
    lat: Float!
    lon: Float!
    stops: [Stop!]!
    routes: [Route!]!
  }
  "A stop group and which of the requested lines stop there"
  type SharedStation {
    station: Station!
    routes: [Route!]!
    distance: Float
  }
  type StationPaginated {
    page: Int!
    pages: Int!
    total: Int!
    data: [Station!]!
  }

  "One vehicle leaving one stop"
  type Departure {
    tripId: ID!
    serviceDate: String!
    stopId: ID!
    route: Route
    headsign: String
    "A stop roughly halfway to the destination, for 'via ▶ destination'"
    via: String
    arrival: DateTime!
    departure: DateTime!
    arrivalDelay: Int
    departureDelay: Int
    realtime: Boolean!
    wheelchairAccessible: WheelchairBoarding!
    bikesAllowed: BikesAllowed!
    "Board by the front door only on this trip (BKK's [Elsőajtós])"
    frontDoor: Boolean!
    "Stops here only on request (call ahead / signal the driver)"
    onRequest: Boolean!
  }

  type TripStop {
    stop: Stop!
    stopSequence: Int!
    arrival: DateTime!
    departure: DateTime!
    arrivalDelay: Int
    departureDelay: Int
    realtime: Boolean!
  }
  "BKK service alert: works, diversions, replacement services"
  type Alert {
    id: ID!
    header: String!
    description: String
    url: String
    start: DateTime
    end: DateTime
    effect: String
    routes: [Route!]!
    stopIds: [ID!]!
  }

  "A trip on one service day, with realtime where available"
  type TripDetails {
    tripId: ID!
    serviceDate: String!
    headsign: String
    directionId: Int
    route: Route
    stops: [TripStop!]!
    vehicle: VehiclePosition
    path: LineStringGeometry
  }


  type Route {
    routeId: ID!
    agency: Agency
    shortName: String
    longName: String
    desc: String
    type: RouteType
    url: String
    color: String
    textColor: String

    # Custom fields
    trips: [Trip]
    stops: [Stop]!
    closestStop(lat: Float, lon: Float): Stop
    directions: [Direction!]
    "Legend markers (from the nightly import; all false until it has run)"
    flags: RouteFlags!
  }

  type RouteFlags {
    "Every vehicle is low-floor"
    lowFloor: Boolean!
    "Ends where it starts (körjárat)"
    circular: Boolean!
    "Some stops are on request only (igényvezérelt)"
    demandResponsive: Boolean!
    "Some trips board by the front door only"
    frontDoor: Boolean!
    "Replacement bus (pótlóbusz) for a tram or metro line"
    replacement: Boolean!
  }

  type Direction {
    directionId: Int!
    headsign: String!
    stops: [Stop!]!
  }

  type RoutePaginated {
    data: [Route!]!
    total: Int
    page: Int
    limit: Int
    pages: Int
  }

  type Stop {
    stopId: ID!
    code: String
    name: String
    desc: String
    lat: Float
    lon: Float
    zoneId: ID
    url: String
    locationType: LocationType
    parentStation: ID
    timezone: String
    wheelchairBoarding: Int

    # Custom fields
    routes: [Route]
    trips: [Trip]
    station: Station
    "Where vehicles leaving this stop go, most frequent first"
    headsigns: [String!]!
  }

  type StopPaginated {
    data: [Stop!]!
    total: Int
    page: Int
    limit: Int
    pages: Int
  }

  type Trip {
    route: Route
    serviceId: ID!
    tripId: ID!
    headsign: String
    directionId: Int
    blockId: ID
    shapeId: ID

    # Custom fields
    agency: Agency
    stops: [Stop]
    stopTimes: [StopTime]
    path: LineStringGeometry
  }

  type StopTime {
    trip: Trip
    arrivalTime: String
    departureTime: String
    stop: Stop
    stopSequence: Int
    pickupType: Int
    dropOffType: Int
    shapeDistTraveled: Float
  }

  type VehiclePosition {
    id: ID!
    bearing:  Float
    latitude: Float
    longitude: Float
    speed: Float
    currentStopSequence: Int
    trip: Trip
    tripStartDate: String
    tripStartTime: String
    congestationLevel: String
    occupancyStatus: String
    occupationPercentage: Float
    vehicleId: ID
    vehicleLabel: String
    vehicleLicensePlate: String
    vehicleWheelchairAccessible: Boolean
    timestamp: DateTime
    createdTimestamp: DateTime
    expirationTimestamp: DateTime
  }
 

  type Calendar {
    serviceId: ID!
    monday: Int
    tuesday: Int
    wednesday: Int
    thursday: Int
    friday: Int
    saturday: Int
    sunday: Int
    startDate: String
    endDate: String
  }

  input BboxInput {
    minLat: Float!
    minLon: Float!
    maxLat: Float!
    maxLon: Float!
  }

  type AgencyPaginated {
    data: [Agency!]!
    total: Int
    page: Int
    limit: Int
    pages: Int
  }

  input RangeInput {
    start: Date!
    end: Date!
  }

  type Query {
    agencies(limit: Int, page: Int): AgencyPaginated!
    agency(id: ID!): Agency
    routes(limit: Int, page: Int): RoutePaginated!
    route(id: ID!): Route

    stops(limit: Int, page: Int): StopPaginated!
    stopsByBbox(bbox: BboxInput!): [Stop]!
    stopsByRadius(lat: Float!, lon: Float!, radius: Float!): [Stop]!
    stop(id: ID!): Stop

    vehiclePositions(bbox: BboxInput): [VehiclePosition]!

    shapes: FeatureCollection!

    timetable(stopId: ID!, routeId: ID!, range: RangeInput): [TimetableEntry!]!

    stations(limit: Int, page: Int, search: String): StationPaginated!
    station(id: ID!): Station
    stationsByRadius(lat: Float!, lon: Float!, radius: Float!): [Station!]!
    "Stop groups served by at least two of the lines (all of them first), nearest first"
    sharedStations(routeIds: [ID!]!, lat: Float, lon: Float): [SharedStation!]!
    "Next departures from any of the stops, across all routes"
    departures(stopIds: [ID!]!, routeIds: [ID!], limit: Int, hours: Int, after: DateTime): [Departure!]!
    trip(id: ID!, serviceDate: String): TripDetails
    "Current and upcoming alerts touching any of these lines or stops (all when both are empty)"
    alerts(routeIds: [ID!], stopIds: [ID!], lang: String): [Alert!]!
  }
`;
