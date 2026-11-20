import { GraphQLDate, GraphQLDateTime, GraphQLTime } from "graphql-scalars";
import {
  BIKES_ALLOWED,
  LOCATION_TYPES,
  ROUTE_TYPES,
  WHEELCHAIR_BOARDING,
} from "./constants";
import { db } from "./db";
import { ensureRealtime } from "./realtime";
import {
  Feature,
  FeatureCollection,
  LineString,
} from "graphql-geojson-scalar-types";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { snakeToCamel } from "./common/camel";
import { distanceM, stationIndex, type Station } from "./stations";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "Europe/Budapest";

// GTFS times are measured from "noon minus 12h" on the service day, so they
// stay correct across DST changes and can exceed 24:00:00 for trips running
// past midnight.
const gtfsTime = (date: string, time: string, delaySeconds?: number | null) => {
  const [h, m, s] = time.split(":").map(Number);
  return dayjs
    .tz(`${date} 12:00`, TIMEZONE)
    .subtract(12, "hour")
    .add(h * 3600 + m * 60 + s + (delaySeconds ?? 0), "second")
    .toDate();
};


// BKK publishes absolute predicted times rather than delays, so derive the
// delay from whichever one the feed provides
const realtime = (
  date: string,
  time: string,
  delay: number | null,
  timestamp: string | null
) => {
  const scheduled = gtfsTime(date, time);
  if (timestamp) {
    const predicted = new Date(Number(timestamp) * 1000);
    return {
      at: predicted,
      delay: Math.round((predicted.getTime() - scheduled.getTime()) / 1000),
    };
  }
  return { at: gtfsTime(date, time, delay), delay };
};

const today = () => dayjs().tz(TIMEZONE);

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
const stopsByIds = (ids: string[]) =>
  ids.length === 0
    ? []
    : db
        .query(`SELECT * FROM stops WHERE stop_id IN (${ids.map(() => "?").join(", ")})`)
        .all(...ids)
        .map(formatStop);

/** Distinct routes serving any of the stops, in the feed's sort order */
const routesAtStops = (ids: string[]) =>
  ids.length === 0
    ? []
    : db
        .query(
          `
            SELECT DISTINCT r.*
            FROM stop_times st
            JOIN trips t ON t.trip_id = st.trip_id
            JOIN routes r ON r.route_id = t.route_id
            WHERE st.stop_id IN (${ids.map(() => "?").join(", ")})
            ORDER BY r.route_sort_order IS NULL, r.route_sort_order
          `
        )
        .all(...ids)
        .map(formatRoute);

/**
 * A stop about halfway between `fromSequence` and the end of the trip, so a
 * departure reads "via ▶ destination". Null when the trip ends within 2 stops.
 */
const viaStop = (tripId: string, fromSequence: number): string | null => {
  const rest = db
    .query(
      `
        SELECT s.stop_name
        FROM stop_times st JOIN stops s ON s.stop_id = st.stop_id
        WHERE st.trip_id = ? AND st.stop_sequence > ?
        ORDER BY st.stop_sequence
      `
    )
    .all(tripId, fromSequence) as { stop_name: string | null }[];
  if (rest.length < 3) return null;
  return rest[Math.floor((rest.length - 1) / 2)].stop_name;
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
    station: (parent: any) => stationIndex().byStop.get(parent.stop_id) ?? null,
    headsigns: (parent: any) =>
      db
        .query(
          `
            SELECT t.trip_headsign AS headsign, COUNT(*) AS n
            FROM stop_times st
            JOIN trips t ON t.trip_id = st.trip_id
            WHERE st.stop_id = ? AND t.trip_headsign IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM stop_times n
                WHERE n.trip_id = st.trip_id AND n.stop_sequence > st.stop_sequence
              )
            GROUP BY t.trip_headsign
            ORDER BY n DESC
            LIMIT 3
          `
        )
        .all(parent.stop_id)
        .map((r: any) => r.headsign),
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
  Trip: {
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
        total: agencies[0]?.total_count ?? 0,
        page,
        limit,
        pages: Math.ceil((agencies[0]?.total_count ?? 0) / limit),
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
        total: routes[0]?.total_count ?? 0,
        page,
        limit,
        pages: Math.ceil((routes[0]?.total_count ?? 0) / limit),
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
        total: stops[0]?.total_count ?? 0,
        page,
        limit,
        pages: Math.ceil((stops[0]?.total_count ?? 0) / limit),
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


    stations: (
      _: any,
      { limit = 50, page = 0, search }: { limit: number; page: number; search?: string }
    ) => {
      const needle = search?.trim().toLocaleLowerCase("hu");
      const all = stationIndex().stations.filter(
        (s) => !needle || s.name.toLocaleLowerCase("hu").includes(needle)
      );
      return {
        page,
        total: all.length,
        pages: Math.ceil(all.length / limit),
        data: all.slice(page * limit, (page + 1) * limit),
      };
    },
    station: (_: any, { id }: { id: string }) => {
      const index = stationIndex();
      // Accept any member stop id too, so a platform id leads to its station
      return index.byId.get(id) ?? index.byStop.get(id) ?? null;
    },
    stationsByRadius: (
      _: any,
      { lat, lon, radius }: { lat: number; lon: number; radius: number }
    ) =>
      stationIndex()
        .stations.map((s) => ({ s, d: distanceM(lat, lon, s.lat, s.lon) }))
        .filter(({ d }) => d <= radius)
        .sort((a, b) => a.d - b.d)
        .map(({ s }) => s),

    departures: async (
      _: any,
      {
        stopIds,
        limit = 30,
        hours = 3,
        after,
      }: { stopIds: string[]; limit: number; hours: number; after?: Date }
    ) => {
      if (stopIds.length === 0) return [];
      await ensureRealtime();
      const start = after ? new Date(after).getTime() : Date.now();
      const now = dayjs(start).tz(TIMEZONE);
      // Yesterday too: trips past midnight belong to the previous service day
      const dates = [now.subtract(1, "day"), now].map((d) => d.format("YYYY-MM-DD"));
      const placeholders = stopIds.map(() => "?").join(", ");
      const rows = db
        .query(
          `
            WITH active AS (
              SELECT d.date AS date, cd.service_id
              FROM (SELECT ? AS date UNION ALL SELECT ?) d
              JOIN calendar_dates cd
                ON cd.date = REPLACE(d.date, '-', '') AND cd.exception_type = 1
            )
            SELECT st.*, t.trip_headsign, t.route_id, t.wheelchair_accessible,
              t.bikes_allowed, active.date,
              stu.arrival_delay, stu.departure_delay,
              stu.arrival_timestamp, stu.departure_timestamp
            FROM stop_times st
            JOIN trips t ON t.trip_id = st.trip_id
            JOIN active ON active.service_id = t.service_id
            LEFT JOIN stop_time_updates stu
              ON stu.trip_id = st.trip_id
              AND stu.stop_id = st.stop_id
              AND (stu.trip_start_date IS NULL OR stu.trip_start_date = REPLACE(active.date, '-', ''))
            WHERE st.stop_id IN (${placeholders})
              -- Not the last stop: nothing departs from a trip's terminus
              AND EXISTS (
                SELECT 1 FROM stop_times n
                WHERE n.trip_id = st.trip_id AND n.stop_sequence > st.stop_sequence
              )
          `
        )
        .all(...dates, ...stopIds);

      const from = start - 60_000;
      const to = start + hours * 3_600_000;
      const routes = new Map<string, any>();
      const routeById = (id: string) => {
        if (!routes.has(id))
          routes.set(id, formatRoute(db.query("SELECT * FROM routes WHERE route_id = ?").get(id)));
        return routes.get(id);
      };

      return rows
        .map((r: any) => {
          const arrival = realtime(r.date, r.arrival_time, r.arrival_delay, r.arrival_timestamp);
          const departure = realtime(r.date, r.departure_time, r.departure_delay, r.departure_timestamp);
          return { r, arrival, departure };
        })
        .filter(({ departure }) => {
          const t = departure.at.getTime();
          return t >= from && t <= to;
        })
        .sort((a, b) => a.departure.at.getTime() - b.departure.at.getTime())
        .slice(0, limit)
        .map(({ r, arrival, departure }) => ({
          tripId: r.trip_id,
          serviceDate: r.date,
          stopId: r.stop_id,
          route: routeById(r.route_id),
          headsign: r.trip_headsign,
          via: viaStop(r.trip_id, r.stop_sequence),
          arrival: arrival.at,
          departure: departure.at,
          arrivalDelay: arrival.delay,
          departureDelay: departure.delay,
          realtime: r.arrival_timestamp != null || r.departure_timestamp != null || r.arrival_delay != null || r.departure_delay != null,
          wheelchairAccessible: WHEELCHAIR_BOARDING[r.wheelchair_accessible] ?? WHEELCHAIR_BOARDING[0],
          bikesAllowed: BIKES_ALLOWED[r.bikes_allowed] ?? BIKES_ALLOWED[0],
        }));
    },

    trip: async (_: any, { id, serviceDate }: { id: string; serviceDate?: string }) => {
      const trip: any = db.query("SELECT * FROM trips WHERE trip_id = ?").get(id);
      if (!trip) return null;
      await ensureRealtime();
      const date = serviceDate ?? today().format("YYYY-MM-DD");
      const rows = db
        .query(
          `
            SELECT st.*, s.*,
              stu.arrival_delay, stu.departure_delay,
              stu.arrival_timestamp, stu.departure_timestamp
            FROM stop_times st
            JOIN stops s ON s.stop_id = st.stop_id
            LEFT JOIN stop_time_updates stu
              ON stu.trip_id = st.trip_id
              AND stu.stop_id = st.stop_id
              AND (stu.trip_start_date IS NULL OR stu.trip_start_date = REPLACE(?, '-', ''))
            WHERE st.trip_id = ?
            ORDER BY st.stop_sequence
          `
        )
        .all(date, id);
      const vehicle: any = db
        .query("SELECT * FROM vehicle_positions WHERE trip_id = ? LIMIT 1")
        .get(id);

      return {
        tripId: trip.trip_id,
        serviceDate: date,
        headsign: trip.trip_headsign,
        directionId: trip.direction_id,
        shapeId: trip.shape_id,
        route: formatRoute(db.query("SELECT * FROM routes WHERE route_id = ?").get(trip.route_id)),
        vehicle: vehicle ? formatVehiclePosition(vehicle) : null,
        stops: rows.map((r: any) => {
          const arrival = realtime(date, r.arrival_time, r.arrival_delay, r.arrival_timestamp);
          const departure = realtime(date, r.departure_time, r.departure_delay, r.departure_timestamp);
          return {
            stop: formatStop(r),
            stopSequence: r.stop_sequence,
            arrival: arrival.at,
            departure: departure.at,
            arrivalDelay: arrival.delay,
            departureDelay: departure.delay,
            realtime: r.arrival_timestamp != null || r.departure_timestamp != null || r.arrival_delay != null || r.departure_delay != null,
          };
        }),
      };
    },
    vehiclePositions: async () => {
      await ensureRealtime();
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
      const start = dayjs(range?.start).tz(TIMEZONE).format("YYYY-MM-DD");
      const end = (
        range?.end ? dayjs(range.end).tz(TIMEZONE) : dayjs().tz(TIMEZONE).add(1, "day")
      ).format("YYYY-MM-DD");
      await ensureRealtime();
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

            SELECT _trips.*, stop_times.*,
              stu.arrival_delay, stu.departure_delay,
              stu.arrival_timestamp, stu.departure_timestamp,
              stu.schedule_relationship
            FROM _trips
            LEFT JOIN stop_times USING (trip_id)
            LEFT JOIN stop_time_updates stu
              ON stu.trip_id = _trips.trip_id
              AND stu.stop_id = stop_times.stop_id
              AND (stu.trip_start_date IS NULL OR stu.trip_start_date = REPLACE(_trips.date, '-', ''))
            WHERE stop_times.stop_id = ?
            ORDER BY date, arrival_time;
          `
        )
        .all(start, end, routeId, stopId);

      const stops = res.map((s: any) => {
        const arrival = realtime(s.date, s.arrival_time, s.arrival_delay, s.arrival_timestamp);
        const departure = realtime(s.date, s.departure_time, s.departure_delay, s.departure_timestamp);
        return {
          ...s,
          arrival_delay: arrival.delay,
          departure_delay: departure.delay,
          // Only stop-level values the schema's enum knows about
          schedule_relationship: ["SCHEDULED", "NO_DATA"].includes(s.schedule_relationship)
            ? s.schedule_relationship
            : null,
          arrival: arrival.at,
          departure: departure.at,
        };
      });

      const nextIndex = stops.findIndex((s) => {
        return s.arrival.getTime() > Date.now();
      });
      return stops.map((s: any, index) => {
        return {
          ...snakeToCamel(s),
          serviceDate: s.date,
          headsign: s.trip_headsign,
          isNext: index === nextIndex,
          isPast: index < nextIndex,
          wheelchairAccessible:
            WHEELCHAIR_BOARDING[s.wheelchair_accessible] ??
            WHEELCHAIR_BOARDING[0],
          bikesAllowed: BIKES_ALLOWED[s.bikes_allowed] ?? BIKES_ALLOWED[0],
        };
      });
    },
  },

  Station: {
    stops: (station: Station) => stopsByIds(station.stopIds),
    routes: (station: Station) => routesAtStops(station.stopIds),
  },
  TripDetails: {
    path: (trip: any) => ({
      type: "LineString",
      coordinates: db
        .query(
          "SELECT shape_pt_lon, shape_pt_lat FROM shapes WHERE shape_id = ? ORDER BY shape_pt_sequence"
        )
        .all(trip.shapeId)
        .map((r: any) => [r.shape_pt_lon, r.shape_pt_lat]),
    }),
  },

  Date: GraphQLDate,
  Time: GraphQLTime,
  DateTime: GraphQLDateTime,
};
