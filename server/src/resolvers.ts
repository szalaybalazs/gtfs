import { GraphQLDate, GraphQLDateTime, GraphQLTime } from "graphql-scalars";
import {
  BIKES_ALLOWED,
  LOCATION_TYPES,
  routeTypeName,
  WHEELCHAIR_BOARDING,
} from "./constants";
import { db, generation } from "./db";
import { ensureRealtime, vehicleModel } from "./realtime";
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
import { buildRouteLines } from "./common/routeLines";
import { score } from "./search";
import { getAlerts } from "./alerts";

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

/**
 * Rail feeds (MÁV, GYSEV, Gyermekvasút) add every train as its own route with
 * no short name and a long name like "Sz 30129" or "IC 989 ARRABONA". Label
 * those by train type instead of showing a number per train.
 */
const trainLabel = (r: any): string | null => {
  if (r.route_short_name) return r.route_short_name;
  if (r.agency_id === "1743") return "GyV"; // Gyermekvasút (Children's Railway)
  const type = String(r.route_long_name ?? "").split(" ")[0];
  return type || null;
};

/** One badge per (agency, label, colour): collapses per-train rail "routes". */
const uniqueRoutes = (routes: any[]) => {
  const seen = new Set<string>();
  return routes.filter((r) => {
    const key = `${r.agency_id}|${r.shortName}|${r.color}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const formatRoute = (r: any) => {
  return {
    ...r,
    // Variants of one line (e.g. a temporarily shortened 61) share one public ID
    routeId: canonicalRoute(r.route_id),
    shortName: trainLabel(r),
    longName: r.route_long_name,
    desc: r.route_desc,
    type: routeTypeName(r.route_type),
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
    headsign: cleanHeadsign(t.trip_headsign),
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
    // e.g. "Mercedes-Benz Citaro C2G", from BKK's realtime extension
    vehicleModel: vehicleModel(vp.vehicle_id),
    trip: vp.trip_id,
    tripStartDate: vp.trip_start_date,
    tripStartTime: vp.trip_start_time,
    congestationLevel: vp.congestation_level,
    occupancyStatus: vp.occupancy_status,
    occupationPercentage: vp.occupation_percentage,
    vehicleId: vp.vehicle_id,
    vehicleLabel: vp.vehicle_label,
    vehicleLicensePlate: vp.vehicle_license_plate,
    // Stored as the GTFS-RT enum (WHEELCHAIR_ACCESSIBLE / WHEELCHAIR_INACCESSIBLE / NO_VALUE / UNKNOWN, or its
    // number 2 / 3 / 0 / 1); the schema field is a Boolean, so map it (null when not known)
    vehicleWheelchairAccessible: wheelchairBool(vp.vehicle_wheelchair_accessible),
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

/**
 * Per-timetable memo for static lookups (a stop's lines, its directions).
 * Cleared whenever a new timetable is loaded.
 */
const memoCache = new Map<string, unknown>();
let memoGeneration = -1;
function memo<T>(key: string, compute: () => T): T {
  if (memoGeneration !== generation) {
    memoCache.clear();
    memoGeneration = generation;
  }
  // Bounded: drop everything rather than grow without limit on a long-lived Lambda
  if (memoCache.size > 200_000) memoCache.clear();
  if (!memoCache.has(key)) memoCache.set(key, compute());
  return memoCache.get(key) as T;
}


/**
 * BKK sometimes publishes a temporary variant of a line (a shortened 61 during
 * works) as a separate route with the same name, type and colour. Treat those
 * as one line: the lowest route_id is the public ID, and every query that takes
 * a route expands it back to all variants. Per-train rail routes have no short
 * name and are left alone (uniqueRoutes handles their badges).
 */
type VariantIndex = { canonical: Map<string, string>; variants: Map<string, string[]> };
const variantIndex = (): VariantIndex =>
  memo("routeVariants", () => {
    const rows = db
      .query("SELECT route_id, agency_id, route_type, route_short_name, route_color FROM routes WHERE agency_id = 'BKK' AND route_short_name IS NOT NULL AND route_short_name != ''")
      .all() as any[];
    const groups = new Map<string, string[]>();
    for (const r of rows) {
      const key = `${r.agency_id}|${r.route_type}|${r.route_short_name}|${r.route_color ?? ""}`;
      const list = groups.get(key) ?? [];
      list.push(String(r.route_id));
      groups.set(key, list);
    }
    const canonical = new Map<string, string>();
    const variants = new Map<string, string[]>();
    for (const ids of groups.values()) {
      if (ids.length < 2) continue;
      ids.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      for (const id of ids) canonical.set(id, ids[0]);
      variants.set(ids[0], ids);
    }
    return { canonical, variants };
  });
const wheelchairBool = (v: unknown): boolean | null =>
  v === true || v === 2 || v === "2" || v === "WHEELCHAIR_ACCESSIBLE"
    ? true
    : v === false || v === 3 || v === "3" || v === "WHEELCHAIR_INACCESSIBLE"
      ? false
      : null;

const canonicalRoute = (id: string): string => variantIndex().canonical.get(String(id)) ?? id;
/** Every route_id behind a (canonical or variant) ID */
const routeVariants = (id: string): string[] => variantIndex().variants.get(canonicalRoute(id)) ?? [id];
const expandRoutes = (ids: string[]): string[] => [...new Set(ids.flatMap(routeVariants))];
const placeholders = (ids: unknown[]) => ids.map(() => "?").join(", ");

/** The variant running the most trips today (falls back to the canonical one) */
const activeVariant = (id: string): string => {
  const ids = routeVariants(id);
  if (ids.length === 1) return ids[0];
  return memo(`activeVariant:${ids[0]}:${today().format("YYYYMMDD")}`, () => {
    const row = db
      .query(
        `SELECT t.route_id, COUNT(*) AS n FROM trips t
         JOIN calendar_dates cd ON cd.service_id = t.service_id
         WHERE t.route_id IN (${placeholders(ids)}) AND cd.date = ? AND cd.exception_type = 1
         GROUP BY t.route_id ORDER BY n DESC LIMIT 1`
      )
      .get(...ids, today().format("YYYYMMDD")) as any;
    if (row?.route_id) return row.route_id;
    // No service today: the variant with the most trips overall
    const any = db
      .query(`SELECT route_id, COUNT(*) AS n FROM trips WHERE route_id IN (${placeholders(ids)}) GROUP BY route_id ORDER BY n DESC LIMIT 1`)
      .get(...ids) as any;
    return any?.route_id ?? ids[0];
  });
};

/** Legend markers per route_id, from the import's route_flags table (empty if it predates it) */
const routeFlagsIndex = (): Map<string, any> =>
  memo("routeFlags", () => {
    try {
      return new Map((db.query("SELECT * FROM route_flags").all() as any[]).map((r) => [String(r.route_id), r]));
    } catch {
      return new Map();
    }
  });

/** "Hűvösvölgy [Elsőajtós]" -> "Hűvösvölgy": the marker becomes a flag, not part of the name */
const FRONT_DOOR = /\s*\[Elsőajtós\]/i;
const cleanHeadsign = (h: string | null | undefined) => (h ? h.replace(FRONT_DOOR, "").trim() : h);


/**
 * Every BKK line's path (one per direction), from the nightly import's
 * route_lines table. Older timetable files without it fall back to building
 * the lines here, once per timetable.
 */
const allRouteLines = (): { type: string; feature: any }[] =>
  memo("routeLines", () => {
    try {
      return (db.query("SELECT type, feature FROM route_lines").all() as any[]).map((r) => ({ type: r.type, feature: JSON.parse(r.feature) }));
    } catch {
      return buildRouteLines((sql, ...params) => db.query(sql).all(...(params as any[])) as any[]);
    }
  });

/** Distinct routes serving any of the stops, in the feed's sort order */
const routesAtStops = (ids: string[]): any[] =>
  ids.length === 0
    ? []
    : uniqueRoutes(db
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
        .map(formatRoute))

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
    // Any variant of the line counts (e.g. a temporary 61 that's front-door only)
    flags: (parent: any) => {
      const index = routeFlagsIndex();
      const rows = routeVariants(parent.route_id).map((id) => index.get(id)).filter(Boolean);
      const any = (k: string) => rows.some((r: any) => !!r[k]);
      return {
        lowFloor: rows.length > 0 && rows.every((r: any) => !!r.low_floor),
        circular: any("circular"),
        demandResponsive: any("demand"),
        frontDoor: any("front_door"),
        replacement: /^(VP|MP)/i.test(String(parent.route_id)),
      };
    },
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
        .all(activeVariant(parent.route_id))
        .map(formatStop);
    },
    trips: async (parent: any) => {
      return db
        .query(`SELECT * FROM trips WHERE route_id IN (${placeholders(routeVariants(parent.route_id))})`)
        .all(...routeVariants(parent.route_id))
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
          .all(activeVariant(parent.route_id))
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
      const variant = activeVariant(parent.route_id);
      // One entry per direction (at most two), headed by its most common headsign
      const dirs = db
        .query(
          `
          SELECT direction_id, trip_headsign, COUNT(*) AS n
          FROM trips
          WHERE route_id = ?
          GROUP BY direction_id, trip_headsign
          ORDER BY n DESC;
        `
        )
        .all(variant) as any[];
      const seen = new Set<number>();
      const picked = dirs.filter((d) => (seen.has(d.direction_id) ? false : (seen.add(d.direction_id), true))).slice(0, 2);

      return picked.map((r: any) => {
        // The stops of one real trip (the one with the most stops of that headsign), in running order.
        // (Merging every trip's stops and ordering by an arbitrary stop_sequence scrambled the order, so "the last stop" was wrong.)
        const trip = db
          .query(
            `
            SELECT t.trip_id
            FROM trips t JOIN stop_times st ON st.trip_id = t.trip_id
            WHERE t.route_id = ? AND t.direction_id = ? AND t.trip_headsign IS ?
            GROUP BY t.trip_id
            ORDER BY COUNT(*) DESC
            LIMIT 1;
          `
          )
          .get(variant, r.direction_id, r.trip_headsign) as any;
        return {
          directionId: r.direction_id,
          headsign: cleanHeadsign(r.trip_headsign) ?? "",
          stops: trip
            ? db
                .query(
                  `
                  SELECT s.*
                  FROM stop_times st JOIN stops s ON s.stop_id = st.stop_id
                  WHERE st.trip_id = ?
                  ORDER BY st.stop_sequence;
                `
                )
                .all(trip.trip_id)
                .map(formatStop)
            : [],
        };
      });
    },
  },
  Stop: {
    station: (parent: any) => stationIndex().byStop.get(parent.stop_id) ?? null,
    headsigns: (parent: any) =>
      memo(`headsigns:${parent.stop_id}`, () =>
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
        .map((r: any) => cleanHeadsign(r.headsign))
        // "X" and "X [Elsőajtós]" are the same direction
        .filter((h: any, i: number, all: any[]) => all.indexOf(h) === i)),
    // Distinct lines only (was: every stop time at the stop), cached per timetable
    routes: (parent: any) => memo(`routes:${parent.stop_id}`, () => routesAtStops([parent.stop_id])),
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
    // Positions only carry a trip id; resolve it to the trip with its route,
    // so vehicles can be coloured and labelled by line
    // Static per timetable, so memoised: the map asks for ~1,300 of these every 15 s
    trip: (vp: any) =>
      !vp.trip_id
        ? null
        : memo(`vehicleTrip:${vp.trip_id}`, () => {
            const t: any = db.query("SELECT * FROM trips WHERE trip_id = ?").get(vp.trip_id);
            if (!t) return null;
            const r = db.query("SELECT * FROM routes WHERE route_id = ?").get(t.route_id);
            return { ...formatTrip(t), route: r ? formatRoute(r) : null };
          }),
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
      const a = db.query("SELECT * FROM agency WHERE agency_id = ?").get(id);
      return a ? formatAgency(a) : null;
    },
    routes: async (
      _: any,
      { limit = 50, page = 0 }: { limit: number; page: number }
    ) => {
      const rows = db
        .query(
          "SELECT *, COUNT(*) OVER() AS total_count FROM routes WHERE agency_id = 'BKK' ORDER BY route_sort_order LIMIT ? OFFSET ?"
        )
        .all(limit, page * limit) as any[];
      const total = rows[0]?.total_count ?? 0;
      // One entry per line: variants collapse into their canonical route (counts stay raw so paging is stable)
      const routes = rows.map(formatRoute).filter((r: any) => r.routeId === r.route_id);
      return {
        data: routes,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      };
    },

    route: async (_: any, { id, ...rest }: { id: string }) => {
      const r = db.query("SELECT * FROM routes WHERE route_id = ?").get(canonicalRoute(id));
      return r ? formatRoute(r) : null;
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
      const st = db.query("SELECT * FROM stops WHERE stop_id = ?").get(id);
      return st ? formatStop(st) : null;
    },


    stations: (
      _: any,
      { limit = 50, page = 0, search }: { limit: number; page: number; search?: string }
    ) => {
      // Accent-insensitive, ranked: exact > prefix > word prefix > contains > fuzzy
      const all = search?.trim()
        ? stationIndex()
            .stations.map((st) => ({ st, s: score(search, st.name) }))
            .filter((x) => x.s > 0)
            .sort((a, b) => b.s - a.s || a.st.name.localeCompare(b.st.name, "hu"))
            .map((x) => x.st)
        : stationIndex().stations;
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
    sharedStations: (
      _: any,
      { routeIds, lat, lon }: { routeIds: string[]; lat?: number | null; lon?: number | null }
    ) => {
      const lines = [...new Set(routeIds.slice(0, 12).map(canonicalRoute))];
      if (lines.length < 2) return [];
      const index = stationIndex();
      // Stop groups each line serves (any variant, any platform), cached per timetable
      const stationsOf = (id: string) =>
        memo(`routeStations:${id}`, () => {
          const ids = routeVariants(id);
          const rows = db
            .query(
              `SELECT DISTINCT st.stop_id FROM trips t JOIN stop_times st ON st.trip_id = t.trip_id
               WHERE t.route_id IN (${placeholders(ids)})`
            )
            .all(...ids) as { stop_id: string }[];
          return new Set(rows.map((r) => index.byStop.get(r.stop_id)?.stationId).filter(Boolean) as string[]);
        });
      const served = new Map<string, string[]>();
      for (const line of lines)
        for (const stationId of stationsOf(line)) served.set(stationId, [...(served.get(stationId) ?? []), line]);
      const routes = new Map(
        lines.map((id) => [id, db.query("SELECT * FROM routes WHERE route_id = ?").get(id)] as const)
      );
      return [...served.entries()]
        .filter(([, ids]) => ids.length >= 2)
        .map(([stationId, ids]) => {
          const station = index.byId.get(stationId)!;
          return {
            station,
            routes: ids.map((id) => routes.get(id)).filter(Boolean).map(formatRoute),
            distance: lat != null && lon != null ? distanceM(lat, lon, station.lat, station.lon) : null,
          };
        })
        .sort(
          (a, b) =>
            b.routes.length - a.routes.length ||
            (a.distance ?? 0) - (b.distance ?? 0) ||
            a.station.name.localeCompare(b.station.name, "hu")
        )
        .slice(0, 40);
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
        routeIds,
        limit = 30,
        hours = 3,
        after,
        arrivals = false,
        perLine,
      }: { stopIds: string[]; routeIds?: string[]; limit: number; hours: number; after?: Date; arrivals?: boolean; perLine?: number }
    ) => {
      // Client-controlled sizes are clamped so one request can't do unbounded work
      stopIds = stopIds.slice(0, 60);
      if (routeIds?.length) routeIds = expandRoutes(routeIds.slice(0, 60));
      limit = Math.min(Math.max(1, limit), perLine ? 400 : 200);
      if (perLine) perLine = Math.min(Math.max(1, perLine), 10);
      hours = Math.min(Math.max(1, hours), 6);
      if (stopIds.length === 0) return [];
      await ensureRealtime();
      const start = after ? new Date(after).getTime() : Date.now();
      const from = start - 60_000;
      const to = start + hours * 3_600_000;
      // Service days that can have departures in [from, to]: yesterday (trips
      // past midnight), today, and the day of `to` (window crossing midnight)
      const dates = [
        ...new Set(
          [dayjs(from).tz(TIMEZONE).subtract(1, "day"), dayjs(from).tz(TIMEZONE), dayjs(to).tz(TIMEZONE)].map((d) =>
            d.format("YYYY-MM-DD")
          )
        ),
      ];
      // Filter by scheduled time in SQL (per service day, in GTFS seconds), padded
      // 30 min early / 5 min late so delayed realtime departures still qualify
      const windows = dates.map((d) => {
        const base = gtfsTime(d, "00:00:00").getTime();
        return [d, Math.floor((from - 30 * 60_000 - base) / 1000), Math.ceil((to + 5 * 60_000 - base) / 1000)];
      });
      const placeholders = stopIds.map(() => "?").join(", ");
      const routeFilter = routeIds?.length ? `AND t.route_id IN (${routeIds.map(() => "?").join(", ")})` : "";
      const rows = db
        .query(
          `
            WITH d(date, lo, hi) AS (VALUES ${windows.map(() => "(?, ?, ?)").join(", ")}),
            active AS (
              SELECT d.date AS date, d.lo, d.hi, cd.service_id
              FROM d
              JOIN calendar_dates cd
                ON cd.date = REPLACE(d.date, '-', '') AND cd.exception_type = 1
            )
            SELECT st.*, t.trip_headsign, t.route_id, t.wheelchair_accessible,
              NOT EXISTS (SELECT 1 FROM stop_times n WHERE n.trip_id = st.trip_id AND n.stop_sequence > st.stop_sequence) AS terminates,
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
              ${routeFilter}
              -- st.departure_timestamp: GTFS seconds of the scheduled departure
              AND (st.departure_timestamp IS NULL OR st.departure_timestamp BETWEEN active.lo AND active.hi)
              -- Not the last stop (nothing departs from a trip's terminus), unless arrivals were asked for
              AND (? OR EXISTS (
                SELECT 1 FROM stop_times n
                WHERE n.trip_id = st.trip_id AND n.stop_sequence > st.stop_sequence
              ))
          `
        )
        .all(...windows.flat(), ...stopIds, ...(routeIds ?? []), arrivals ? 1 : 0);

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
        // Board mode: only the next few of each line + direction, so rare lines still show
        .filter(
          ((seen) => ({ r }: { r: any }) => {
            if (!perLine) return true;
            const key = `${canonicalRoute(r.route_id)}|${cleanHeadsign(r.trip_headsign)}`;
            const n = (seen.get(key) ?? 0) + 1;
            seen.set(key, n);
            return n <= perLine;
          })(new Map<string, number>())
        )
        .slice(0, limit)
        .map(({ r, arrival, departure }) => ({
          tripId: r.trip_id,
          serviceDate: r.date,
          stopId: r.stop_id,
          route: routeById(r.route_id),
          headsign: cleanHeadsign(r.trip_headsign),
          // Ends here: an arrival, not a departure (only returned with arrivals: true)
          terminates: !!r.terminates,
          frontDoor: FRONT_DOOR.test(r.stop_headsign ?? "") || FRONT_DOOR.test(r.trip_headsign ?? ""),
          onRequest: r.pickup_type === 2 || r.pickup_type === 3,
          stopSequence: r.stop_sequence,
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
      // Validate; without a date, a trip whose times run past midnight that
      // already started belongs to yesterday's service day
      let date = serviceDate && /^\d{4}-\d{2}-\d{2}$/.test(serviceDate) ? serviceDate : null;
      if (!date) {
        const first: any = db.query("SELECT departure_time FROM stop_times WHERE trip_id = ? ORDER BY stop_sequence LIMIT 1").get(id);
        const todayStr = today().format("YYYY-MM-DD");
        const yesterday = today().subtract(1, "day").format("YYYY-MM-DD");
        const startsToday = first ? gtfsTime(todayStr, first.departure_time).getTime() : 0;
        date = startsToday > Date.now() + 6 * 3_600_000 ? yesterday : todayStr;
      }
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
        headsign: cleanHeadsign(trip.trip_headsign),
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
    alerts: async (
      _: any,
      { routeIds = [], stopIds = [], lang = "en" }: { routeIds?: string[]; stopIds?: string[]; lang?: string }
    ) => {
      const now = Date.now() / 1000;
      const routes = new Set(expandRoutes(routeIds ?? []));
      const stops = new Set(stopIds ?? []);
      const pick = (t: Record<string, string>) => t[lang] ?? t.en ?? t.hu ?? Object.values(t)[0] ?? "";
      return (await getAlerts())
        .filter((a) => !a.end || a.end > now)
        .filter((a) => (routes.size === 0 && stops.size === 0) || a.routeIds.some((r) => routes.has(r)) || a.stopIds.some((st) => stops.has(st)))
        .sort((a, b) => (a.start ?? 0) - (b.start ?? 0))
        .map((a) => ({
          id: a.id,
          header: pick(a.header),
          description: pick(a.description) || null,
          url: a.url,
          start: a.start ? new Date(a.start * 1000) : null,
          end: a.end ? new Date(a.end * 1000) : null,
          effect: a.effect,
          stopIds: a.stopIds,
          routes: uniqueRoutes(
            a.routeIds
              .map((id) => db.query("SELECT * FROM routes WHERE route_id = ?").get(id))
              .filter(Boolean)
              .map(formatRoute)
          ),
        }));
    },
    // Optional bbox: the map only asks for the visible area
    vehiclePositions: async (_: any, { bbox }: { bbox?: { minLat: number; minLon: number; maxLat: number; maxLon: number } }) => {
      await ensureRealtime();
      if (bbox) {
        return db
          .query("SELECT * FROM vehicle_positions WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?")
          .all(bbox.minLat, bbox.maxLat, bbox.minLon, bbox.maxLon)
          .map(formatVehiclePosition);
      }
      return db
        .query("SELECT * FROM vehicle_positions")
        .all()
        .map(formatVehiclePosition);
    },
    routeLines: (_: any, { types }: { types?: string[] | null }) => {
      const want = new Set(types ?? []);
      const key = [...want].sort().join(",");
      return memo(`routeLinesJson:${key}`, () =>
        JSON.stringify({
          type: "FeatureCollection",
          features: allRouteLines()
            .filter((l) => want.size === 0 || want.has(l.type))
            // Vehicles carry the merged (canonical) line id, so the paths must too
            .map((l) => ({ ...l.feature, properties: { ...l.feature.properties, routeId: canonicalRoute(l.feature.properties.routeId) } })),
        })
      );
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
              WHERE route_id IN (${placeholders(routeVariants(routeId))}) AND exception_type = 1
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
        .all(start, end, ...routeVariants(routeId), stopId);

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
          headsign: cleanHeadsign(s.trip_headsign),
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
    routes: (station: Station) => memo(`stationRoutes:${station.stationId}`, () => routesAtStops(station.stopIds)),
  },
  Departure: {
    // Only computed when a client asks for it (it costs a query per departure)
    via: (d: any) => memo(`via:${d.tripId}:${d.stopSequence}`, () => viaStop(d.tripId, d.stopSequence)),
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
