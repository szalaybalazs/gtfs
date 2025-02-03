import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { GraphQLDate, GraphQLDateTime, GraphQLTime } from "graphql-scalars";
import { db } from "./db";
import { GraphQLObjectType, GraphQLSchema } from "graphql";
import { Point } from "graphql-geojson-scalar-types";

// 0 - Tram, Streetcar, Light rail. Any light rail or street level system within a metropolitan area.
// 1 - Subway, Metro. Any underground rail system within a metropolitan area.
// 2 - Rail. Used for intercity or long-distance travel.
// 3 - Bus. Used for short- and long-distance bus routes.
// 4 - Ferry. Used for short- and long-distance boat service.
// 5 - Cable tram. Used for street-level rail cars where the cable runs beneath the vehicle (e.g., cable car in San Francisco).
// 6 - Aerial lift, suspended cable car (e.g., gondola lift, aerial tramway). Cable transport where cabins, cars, gondolas or open chairs are suspended by means of one or more cables.
// 7 - Funicular. Any rail system designed for steep inclines.
// 11 - Trolleybus. Electric buses that draw power from overhead wires using poles.
// 12 - Monorail. Railway in which the track consists of a single rail or a beam.

const routeTypes: Record<number, string> = {
  0: "TRAM",
  1: "SUBWAY",
  2: "RAIL",
  3: "BUS",
  4: "FERRY",
  5: "CABLE_TRAM",
  6: "AERIAL_LIFT",
  7: "FUNICULAR",
  11: "TROLLEYBUS",
  12: "MONORAIL",
};

// 0 (or empty) - Stop (or Platform). A location where passengers board or disembark from a transit vehicle. Is called a platform when defined within a parent_station.
// 1 - Station. A physical structure or area that contains one or more platform.
// 2 - Entrance/Exit. A location where passengers can enter or exit a station from the street. If an entrance/exit belongs to multiple stations, it may be linked by pathways to both, but the data provider must pick one of them as parent.
// 3 - Generic Node. A location within a station, not matching any other location_type, that may be used to link together pathways define in pathways.txt.
// 4 - Boarding Area. A specific location on a platform, where passengers can board and/or alight vehicles.

const locationTypes: Record<number, string> = {
  0: "STOP",
  1: "STATION",
  2: "ENTRANCE_EXIT",
  3: "GENERIC_NODE",
  4: "BOARDING_AREA",
};

const typeDefs = `#graphql
  scalar JSON
  scalar Date
  scalar Time
  scalar DateTime

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


  type Route {
    routeId: ID!
    agency: Agency
    stops: [Stop]!
    shortName: String
    longName: String
    desc: String
    type: RouteType
    url: String
    color: String
    textColor: String

    # Custom fields
    trips: [Trip]
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

  type Query {
    agencies(limit: Int, page: Int): AgencyPaginated!
    agency(id: ID!): Agency
    routes(limit: Int, page: Int): RoutePaginated!
    route(id: ID!): Route

    stops(limit: Int, page: Int): StopPaginated!
    stopsByBbox(bbox: BboxInput!): [Stop]!
    stopsByRadius(lat: Float!, lon: Float!, radius: Float!): [Stop]!
    stop(id: ID!): Stop

    vehiclePositions: [VehiclePosition]!
  }
`;

const formatRoute = (r: any) => {
  return {
    ...r,
    routeId: r.route_id,
    shortName: r.route_short_name,
    longName: r.route_long_name,
    desc: r.route_desc,
    type: routeTypes[r.route_type],
    url: r.route_url,
    color: r.route_color,
    textColor: r.route_text_color,
  };
};

const formatStopTime = (st: any) => {
  return {
    ...st,
    arrivalTime: st.arrival_time,
    departureTime: st.departure_time,
    stopSequence: st.stop_sequence,
    pickupType: st.pickup_type,
    dropOffType: st.drop_off_type,
    shapeDistTraveled: st.shape_dist_traveled,
  };
};

const formatTrip = (t: any) => {
  const trip = {
    ...t,
    serviceId: t.service_id,
    tripId: t.trip_id,
    headsign: t.trip_headsign,
    directionId: t.direction_id,
    blockId: t.block_id,
    shapeId: t.shape_id,
  };

  if (t.arrival_time) {
    trip.stopTimes = [formatStopTime(t)];
  }

  return trip;
};

const formatStop = (s: any) => {
  return {
    ...s,
    stopId: s.stop_id,
    code: s.stop_code,
    name: s.stop_name,
    desc: s.stop_desc,
    lat: s.stop_lat,
    lon: s.stop_lon,
    zoneId: s.zone_id,
    url: s.stop_url,
    locationType: locationTypes[s.location_type || 0],
    parentStation: s.parent_station,
    timezone: s.stop_timezone,
    wheelchairBoarding: s.wheelchair_boarding,
  };
};

const formatAgency = (a: any) => {
  return {
    ...a,
    agencyId: a.agency_id,
    name: a.agency_name,
    url: a.agency_url,
    timezone: a.agency_timezone,
    lang: a.agency_lang,
    phone: a.agency_phone,
    fareUrl: a.agency_fare_url,
  };
};

const formatVehiclePosition = (vp: any) => {
  return {
    ...vp,
    id: vp.id,
    bearing: vp.bearing,
    latitude: vp.latitude,
    longitude: vp.longitude,
    speed: vp.speed,
    currentStopSequence: vp.current_stop_sequence,
    trip: vp.trip_id,
    tripStartDate: vp.trip_start_date,
    tripStartTime: vp.trip_start_time,
    congestationLevel: vp.congestation_level,
    occupancyStatus: vp.occupancy_status,
    occupationPercentage: vp.occupation_percentage,
    vehicleId: vp.vehicle_id,
    vehicleLabel: vp.vehicle_label,
    vehicleLicensePlate: vp.vehicle_license_plate,
    vehicleWheelchairAccessible: vp.vehicle_wheelchair_accessible,
    timestamp: vp.timestamp,
    createdTimestamp: vp.created_timestamp,
    expirationTimestamp: vp.expiration_timestamp,
  };
};
const resolvers = {
  Agency: {
    routes: async (parent: any) => {
      return db
        .query("SELECT * FROM routes WHERE agency_id = ?")
        .all(parent.agencyId)
        .map(formatRoute);
    },
  },
  Route: {
    agency: async (parent: any) => {
      return formatAgency(
        db
          .query("SELECT * FROM agency WHERE agency_id = ?")
          .get(parent.agency_id)
      );
    },
    stops: async (parent: any) => {
      return db
        .query(
          `
            WITH selected_trip AS (
              SELECT trip_id
              FROM trips
              WHERE route_id = ?
              LIMIT 1
            )
            SELECT s.*
            FROM stop_times st
            JOIN stops s ON s.stop_id = st.stop_id
            WHERE st.trip_id = (SELECT trip_id FROM selected_trip)
            ORDER BY st.stop_sequence;`
        )
        .all(parent.route_id)
        .map(formatStop);
    },
  },
  Stop: {
    routes: async (parent: any) => {
      const res = db
        .query(
          `
            SELECT * 
            FROM stop_times 
            LEFT JOIN trips USING (trip_id)
            LEFT JOIN routes USING (route_id)
            WHERE stop_id = ?;
          `
        )
        .all(parent.stop_id);
      const routeIds = Array.from(new Set(res.map((r: any) => r.route_id)));

      const routes = routeIds.map((routeId: string) => {
        const route: any = res.find((r: any) => r.route_id === routeId);
        if (!route) return null;

        route.trips = res
          .filter((r: any) => r.route_id === routeId)
          .map(formatTrip);
        return formatRoute(route);
      });

      return routes;

      // .map(formatRoute);
    },
    trips: async (parent: any) => {
      return db
        .query(
          `
            SELECT *
            FROM trips
            WHERE trip_id IN (
              SELECT trip_id
              FROM stop_times
              WHERE stop_id = ?
            );`
        )
        .all(parent.stop_id);
    },
  },
  VehiclePosition: {
    timestamp: (parent: any) => new Date(Number(`${parent.timestamp}000`)),
    createdTimestamp: (parent: any) =>
      new Date(Number(`${parent.created_timestamp}000`)),
    expirationTimestamp: (parent: any) =>
      new Date(Number(`${parent.expiration_timestamp}000`)),
  },
  Query: {
    agencies: async (
      _: any,
      { limit = 50, page = 0 }: { limit: number; page: number }
    ) => {
      const agencies = db
        .query(
          "SELECT *, COUNT(*) OVER() AS total_count FROM agency LIMIT ? OFFSET ?"
        )
        .all(limit, page * limit)
        .map(formatAgency);
      return {
        data: agencies,
        total: agencies[0].total_count,
        page,
        limit,
        pages: Math.ceil(agencies[0].total_count / limit),
      };
    },
    agency: async (_: any, { id }: { id: string }) => {
      return formatAgency(
        db.query("SELECT * FROM agency WHERE agency_id = ?").get(id)
      );
    },
    routes: async (
      _: any,
      { limit = 50, page = 0 }: { limit: number; page: number }
    ) => {
      const routes = db
        .query(
          "SELECT *, COUNT(*) OVER() AS total_count FROM routes LIMIT ? OFFSET ?"
        )
        .all(limit, page * limit)
        .map(formatRoute);
      return {
        data: routes,
        total: routes[0].total_count,
        page,
        limit,
        pages: Math.ceil(routes[0].total_count / limit),
      };
    },

    route: async (_: any, { id }: { id: string }) => {
      return formatRoute(
        db.query("SELECT * FROM routes WHERE route_id = ?").get(id)
      );
    },

    stops: async (
      _: any,
      { limit = 50, page = 0 }: { limit: number; page: number }
    ) => {
      const stops = db
        .query(
          "SELECT *, COUNT(*) OVER() AS total_count FROM stops LIMIT ? OFFSET ?"
        )
        .all(limit, page * limit)
        .map(formatStop);
      return {
        data: stops,
        total: stops[0].total_count,
        page,
        limit,
        pages: Math.ceil(stops[0].total_count / limit),
      };
    },
    stopsByBbox: async (_: any, { bbox }: { bbox: any }) => {
      const stops = db
        .query(
          `
            SELECT *
            FROM stops
            WHERE stop_lat >= ? AND stop_lat <= ? AND stop_lon >= ? AND stop_lon <= ?;
          `
        )
        .all(bbox.minLat, bbox.maxLat, bbox.minLon, bbox.maxLon)
        .map(formatStop);
      return stops;
    },
    stopsByRadius: async (
      _: any,
      { lat, lon, radius }: { lat: number; lon: number; radius: number }
    ) => {
      console.log(lat, lon, radius);
      const stops = db
        .query(
          `
            SELECT
                stop_id,
                stop_name,
                stop_lat,
                stop_lon,
                distance
            FROM (
                SELECT
                    stop_id,
                    stop_name,
                    stop_lat,
                    stop_lon,
                    (
                        6371000 * 2 * ASIN(
                            SQRT(
                                POWER(SIN(((stop_lat - ?)*(3.141592653589793/180)) / 2), 2)
                                + COS(?*(3.141592653589793/180)) * COS(stop_lat*(3.141592653589793/180)) *
                                  POWER(SIN(((stop_lon - ?)*(3.141592653589793/180)) / 2), 2)
                            )
                        )
                    ) AS distance
                FROM stops
            )
            WHERE distance <= ?;
          `
        )
        .all(lat, lat, lon, radius)
        .map(formatStop);
      return stops;
    },

    stop: async (_: any, { id }: { id: string }) => {
      return formatStop(
        db.query("SELECT * FROM stops WHERE stop_id = ?").get(id)
      );
    },

    vehiclePositions: async () => {
      return db
        .query("SELECT * FROM vehicle_positions")
        .all()
        .map(formatVehiclePosition);
    },
  },

  Date: GraphQLDate,
  Time: GraphQLTime,
  DateTime: GraphQLDateTime,
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

console.log(
  new GraphQLSchema({
    query: new GraphQLObjectType({
      name: "Query",
      fields: () => ({
        point: {
          type: Point,
          resolve: () => ({
            type: "Point",
            coordinates: [-105.01621, 39.57422],
          }),
        },
        pointInvalid: {
          type: Point,
          resolve: () => ({
            type: "Invalid",
            coordinates: [-105.01621, 39.57422],
          }),
        },
      }),
    }),
  })
);
const port = Number(process.env.PORT || 4000);

const { url } = await startStandaloneServer(server, {
  listen: { port },
});

console.log(`🚀  Server ready at: ${url}`);
