import { GraphQLDate, GraphQLDateTime, GraphQLTime } from "graphql-scalars";
import {
  BIKES_ALLOWED,
  LOCATION_TYPES,
  ROUTE_TYPES,
  WHEELCHAIR_BOARDING,
} from "./constants";
import { db } from "./db";
import {
  Feature,
  FeatureCollection,
  LineString,
} from "graphql-geojson-scalar-types";
import dayjs from "dayjs";
import { snakeToCamel } from "./common/camel";

const formatRoute = (r: any) => {
  return {
    ...r,
    routeId: r.route_id,
    shortName: r.route_short_name,
    longName: r.route_long_name,
    desc: r.route_desc,
    type: ROUTE_TYPES[r.route_type],
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
    locationType: LOCATION_TYPES[s.location_type || 0],
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
export const resolvers = {
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
            SELECT DISTINCT
                s.*
            FROM routes r
            JOIN trips t ON r.route_id = t.route_id
            JOIN stop_times st ON t.trip_id = st.trip_id
            JOIN stops s ON st.stop_id = s.stop_id
            WHERE 
                r.route_id = ?
            GROUP BY 
                s.stop_id, 
                s.stop_name
            ORDER BY 
                st.stop_sequence;
          `
        )
        .all(parent.route_id)
        .map(formatStop);
    },
    trips: async (parent: any) => {
      return db
        .query("SELECT * FROM trips WHERE route_id = ?")
        .all(parent.route_id)
        .map(formatTrip);
    },
    closestStop: async (parent: any, args: any) => {
      if (!args.lon || !args.lat) return null;
      const stops =
        parent.stops ||
        db
          .query(
            `
              SELECT DISTINCT
                  s.*
              FROM routes r
              JOIN trips t ON r.route_id = t.route_id
              JOIN stop_times st ON t.trip_id = st.trip_id
              JOIN stops s ON st.stop_id = s.stop_id
              WHERE 
                  r.route_id = ?
              GROUP BY 
                  s.stop_id, 
                  s.stop_name
              ORDER BY 
                  st.stop_sequence;
            `
          )
          .all(parent.route_id)
          .map(formatStop);

      const closestStop = stops.reduce((acc, stop) => {
        if (!acc) return stop;
        const distance = Math.sqrt(
          Math.pow(stop.lat - args.lat, 2) + Math.pow(stop.lon - args.lon, 2)
        );
        if (!acc.distance || distance < acc.distance) {
          return { ...stop, distance };
        }
        return acc;
      }, null);
      return closestStop;
    },
    directions: async (parent: any) => {
      const res = db
        .query(
          `
          SELECT 
            route_id,
            direction_id,
            trip_headsign,
            COUNT(DISTINCT trip_id) AS num_trips,
            COUNT(DISTINCT stop_id) AS unique_stops
        FROM (
            SELECT 
                r.route_id,
                t.direction_id,
                t.trip_headsign,
                t.trip_id,
                st.stop_id
            FROM routes r
            JOIN trips t ON r.route_id = t.route_id
            JOIN stop_times st ON t.trip_id = st.trip_id
            WHERE r.route_id = ?
        )
        GROUP BY 
            route_id, 
            direction_id, 
            trip_headsign
        ORDER BY 
            num_trips DESC
            LIMIT 2;
        `
        )
        .all(parent.route_id);

      return res.map((r: any) => {
        return {
          directionId: r.direction_id,
          headsign: r.trip_headsign,
          stops: db
            .query(
              `
              SELECT
                  s.*
              FROM routes r
              JOIN trips t ON r.route_id = t.route_id
              JOIN stop_times st ON t.trip_id = st.trip_id
              JOIN stops s ON st.stop_id = s.stop_id
              WHERE
                  r.route_id = ? AND t.direction_id = ?
              GROUP BY
                  s.stop_id,
                  s.stop_name
              ORDER BY
                  st.stop_sequence;
              `
            )
            .all(parent.route_id, r.direction_id)
            .map(formatStop),
        };
      });
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
    stopTimes: async (parent: any, args: any) => {
      const start = dayjs(args.range?.start)
        .startOf("day")
        .format("YYYY-MM-DD");
      const end = (
        args.range?.end ? dayjs(args.range.end) : dayjs().add(1, "day")
      )
        .endOf("day")
        .format("YYYY-MM-DD");

      const res = db
        .query(
          `
          WITH RECURSIVE 
          -- Generate date range between start and end dates
          dates(date) AS (
              SELECT DATE(?)
              UNION ALL
              SELECT DATE(date, '+1 day')
              FROM dates
              WHERE date < DATE(?)
          ), 
          -- Format dates and create a clean date reference table
          date_range AS (
              SELECT 
                  date AS service_date,
                  strftime('%Y%m%d', date) AS date
              FROM dates
          ),
          -- Get active trips for the date range considering service exceptions
          active_trips AS (
              SELECT 
                  dr.service_date,
                  t.*
              FROM date_range dr
              LEFT JOIN calendar_dates cd USING (date)
              LEFT JOIN trips t USING (service_id)
              WHERE cd.exception_type = 1  -- Only include active service exceptions
          )

          -- Main query joining with stop times and real-time updates
          SELECT at.*, st.*, r.*, stu.arrival_delay, stu.departure_delay, schedule_relationship
          FROM active_trips at
          INNER JOIN stop_times st ON at.trip_id = st.trip_id
          LEFT JOIN stop_time_updates stu ON (
              st.trip_id = stu.trip_id 
              AND st.stop_id = stu.stop_id
          )
          LEFT JOIN routes r USING (route_id)
          WHERE st.stop_id = ?
          ORDER BY 
              at.service_date,
              st.arrival_time;
        `
        )
        .all(start, end, parent.stop_id);

      console.log(start, end, parent.stop_id);

      const stopTimes = res.map((r: any) => {
        return {
          ...snakeToCamel(r),
          arrival: getDateFromTime(r.arrival_time, r.service_date),
          departure: getDateFromTime(r.departure_time, r.service_date),
          trip: {
            ...formatTrip(r),
            wheelchairAccessible: WHEELCHAIR_BOARDING[r.wheelchair_accessible],
            bikesAllowed: BIKES_ALLOWED[r.bikes_allowed],
            route: formatRoute(r),
          },
        };
      });

      return stopTimes;
    },
  },
  VehiclePosition: {
    timestamp: (parent: any) => new Date(Number(`${parent.timestamp}000`)),
    createdTimestamp: (parent: any) =>
      new Date(Number(`${parent.created_timestamp}000`)),
    expirationTimestamp: (parent: any) =>
      new Date(Number(`${parent.expiration_timestamp}000`)),
  },
  Trip: {
    route: async (parent: any) => {
      if (parent.route) return parent.route;
      return formatRoute(
        db.query("SELECT * FROM routes WHERE route_id = ?").get(parent.routeId)
      );
    },
    path: (parent: any) => {
      const id = parent.tripId;

      const res = db
        .query(
          `
            SELECT *
            FROM shapes
            WHERE shape_id = (
              SELECT shape_id
              FROM trips
              WHERE trip_id = ?
            )
            ORDER BY shape_dist_traveled;
          `
        )
        .all(id);

      const coordinates = res.map((r: any) => [r.shape_pt_lon, r.shape_pt_lat]);

      return {
        type: "LineString",
        coordinates,
      };
    },
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
          "SELECT *, COUNT(*) OVER() AS total_count FROM routes WHERE agency_id = 'BKK' ORDER BY route_sort_order LIMIT ? OFFSET ?"
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

    route: async (_: any, { id, ...rest }: { id: string }) => {
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
    shapes: async () => {
      const res = db
        .query("SELECT * FROM shapes ORDER BY shape_dist_traveled")
        .all();
      const shapeIds = Array.from(new Set(res.map((r: any) => r.shape_id)));

      const shapes = shapeIds.map((shapeId: string) => {
        const points = res.filter((r: any) => r.shape_id === shapeId);

        return {
          type: "Feature",
          properties: {
            shapeId,
          },
          geometry: {
            type: "LineString",
            coordinates: points.map((p: any) => [
              p.shape_pt_lon,
              p.shape_pt_lat,
            ]),
          },
        };
      });

      return {
        type: "FeatureCollection",
        features: shapes,
      };
    },

    timetable: async (
      _: any,
      {
        stopId,
        routeId,
        range,
      }: { stopId: string; routeId: string; range?: { start: Date; end: Date } }
    ) => {
      const start = dayjs(range?.start).startOf("day").format("YYYY-MM-DD");
      const end = (range?.end ? dayjs(range.end) : dayjs().add(1, "day"))
        .endOf("day")
        .format("YYYY-MM-DD");
      const res = db
        .query(
          `
            WITH RECURSIVE dates(date) AS (
              SELECT DATE(?)
              UNION ALL
              SELECT DATE(date, '+1 day')
              FROM dates
              WHERE date < DATE(?)
            ), 
            _dates AS (
              SELECT date AS original_date, strftime('%Y%m%d', date) AS date
              FROM dates
            ),
            _trips AS (
              SELECT original_date AS date, trips.*
              FROM _dates
              LEFT JOIN calendar_dates USING (date)
              LEFT JOIN trips USING (service_id)
              WHERE route_id = ? AND exception_type = 1
            )

            SELECT _trips.*, stop_times.*, stop_time_updates.arrival_delay, stop_time_updates.departure_delay, schedule_relationship
            FROM _trips
            LEFT JOIN stop_times USING (trip_id)
            LEFT JOIN stop_time_updates USING (trip_id, stop_id)
            WHERE stop_id = ?
            ORDER BY date, arrival_time;
          `
        )
        .all(start, end, routeId, stopId);

      const stops = res.map((s: any) => {
        return {
          ...s,
          arrival: dayjs(`${s.date}T${s.arrival_time}`)
            .add(s.arrival_delay ?? 0, "second")
            .toDate(),
          departure: dayjs(`${s.date}T${s.departure_time}`)
            .add(s.departure_delay ?? 0, "second")
            .toDate(),
        };
      });

      const nextIndex = stops.findIndex((s) => {
        return s.arrival.getTime() > Date.now();
      });
      return stops.map((s: any, index) => {
        return {
          ...snakeToCamel(s),
          isNext: index === nextIndex,
          isPast: index < nextIndex,
          wheelchairAccessible:
            WHEELCHAIR_BOARDING[s.wheelchair_accessible] ??
            WHEELCHAIR_BOARDING[0],
          bikesAllowed: BIKES_ALLOWED[s.bikes_allowed] ?? BIKES_ALLOWED[0],
        };
      });
    },

    trip: async (_: any, { id }: { id: string }) => {
      const trip = formatTrip(
        db.query("SELECT * FROM trips WHERE trip_id = ?").get(id)
      );
      const stopTimes = db
        .query(
          `
            SELECT stop_times.*, stops.*, stop_time_updates.arrival_delay, stop_time_updates.departure_delay, schedule_relationship
            FROM stop_times 
            LEFT JOIN stops USING (stop_id)
            LEFT JOIN stop_time_updates USING (trip_id, stop_id)
            WHERE trip_id = ?
            ORDER BY stop_sequence;
          `
        )
        .all(id);

      return {
        ...snakeToCamel(trip),
        wheelchairAccessible: WHEELCHAIR_BOARDING[trip.wheelchair_accessible],
        bikesAllowed: BIKES_ALLOWED[trip.bikes_allowed],
        stopTimes: stopTimes.map((st: any) => {
          return {
            ...formatStopTime(st),
            stop: formatStop(st),
            arrival: getDateFromTime(st.arrival_time),
            departure: getDateFromTime(st.departure_time),
          };
        }),
      };
    },
  },

  Date: GraphQLDate,
  Time: GraphQLTime,
  DateTime: GraphQLDateTime,
};

const getDateFromTime = (
  time: string,
  date: string = dayjs().format("YYYY-MM-DD")
) => {
  const [hour, minute, second] = time.split(":").map(Number);
  const d = dayjs(date)
    .set("hour", hour)
    .set("minute", minute)
    .set("second", second);

  return d.toDate();
};
