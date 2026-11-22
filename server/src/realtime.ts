import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { Resource } from "sst";
import { connection, generation } from "./db";

// Realtime data is fetched on demand instead of synced on a schedule. Decoded
// feeds are cached in memory and mirrored into TEMP tables, which shadow the
// (empty) tables of the same name in the read-only static database, so the
// existing SQL joins keep working.

// How old each feed may get before a request starts a refresh (the refresh runs in the background).
const TTL_MS = { vehicles: 10_000, trips: 20_000 } as const;
// Older than this, a request waits for a refresh rather than serving the old data (the feed is down, or we are cold).
const MAX_AGE_MS = 90_000;
const TIMEOUT_MS = 8_000;
// How long a request waits for a refresh that is due (the rest of the wait is served from the cache).
const REFRESH_WAIT_MS = 2_000;
const BASE_URL = "https://go.bkk.hu/api/query/v1/ws/gtfs-rt/full";

const STOP_TIME_UPDATE_COLUMNS = [
  "trip_id",
  "trip_start_time",
  // Not in the gtfs package schema: lets realtime rows match the right service day
  "trip_start_date",
  "direction_id",
  "route_id",
  "stop_id",
  "stop_sequence",
  "arrival_delay",
  "departure_delay",
  "departure_timestamp",
  "arrival_timestamp",
  "schedule_relationship",
  "created_timestamp",
  "expiration_timestamp",
];

const VEHICLE_POSITION_COLUMNS = [
  "id",
  "bearing",
  "latitude",
  "longitude",
  "speed",
  "current_stop_sequence",
  "trip_id",
  "trip_start_date",
  "trip_start_time",
  "congestion_level",
  "occupancy_status",
  "occupancy_percentage",
  "vehicle_stop_status",
  "vehicle_id",
  "vehicle_label",
  "vehicle_license_plate",
  "vehicle_wheelchair_accessible",
  "timestamp",
  "created_timestamp",
  "expiration_timestamp",
];

type Row = (string | number | null)[];

/**
 * BKK sends each vehicle's model ("Mercedes-Benz Citaro C2G", "CAF Urbos 3"…)
 * in its own extension on the VehicleDescriptor (field 1006, sub-field 1).
 * gtfs-realtime-bindings drops unknown extensions, so read them from the raw
 * protobuf: FeedMessage.entity(2) → vehicle(4) → vehicle descriptor(8) →
 * id(1) and extension(1006).model(1).
 */
let models = new Map<string, string>();
export const vehicleModel = (vehicleId: string | null | undefined) => (vehicleId ? models.get(vehicleId) ?? null : null);

function* protoFields(b: Uint8Array, start: number, end: number): Generator<[number, number, number, number]> {
  let i = start;
  while (i < end) {
    let key = 0, shift = 0, x: number;
    do { x = b[i++]; key += (x & 0x7f) * 2 ** shift; shift += 7; } while (x & 0x80);
    const field = Math.floor(key / 8), wire = key % 8;
    if (wire === 0) { do { x = b[i++]; } while (x & 0x80); yield [field, wire, 0, 0]; }
    else if (wire === 2) {
      let len = 0; shift = 0;
      do { x = b[i++]; len += (x & 0x7f) * 2 ** shift; shift += 7; } while (x & 0x80);
      yield [field, wire, i, i + len];
      i += len;
    } else if (wire === 5) { i += 4; yield [field, wire, 0, 0]; }
    else if (wire === 1) { i += 8; yield [field, wire, 0, 0]; }
    else return;
  }
}

function readVehicleModels(b: Uint8Array) {
  const out = new Map<string, string>();
  const text = new TextDecoder();
  try {
    for (const [f, w, a, z] of protoFields(b, 0, b.length)) {
      if (f !== 2 || w !== 2) continue;
      for (const [f2, w2, a2, z2] of protoFields(b, a, z)) {
        if (f2 !== 4 || w2 !== 2) continue;
        for (const [f3, w3, a3, z3] of protoFields(b, a2, z2)) {
          if (f3 !== 8 || w3 !== 2) continue;
          let id: string | null = null, model: string | null = null;
          for (const [f4, w4, a4, z4] of protoFields(b, a3, z3)) {
            if (f4 === 1 && w4 === 2) id = text.decode(b.subarray(a4, z4));
            if (f4 === 1006 && w4 === 2)
              for (const [f5, w5, a5, z5] of protoFields(b, a4, z4)) if (f5 === 1 && w5 === 2) model = text.decode(b.subarray(a5, z5)).trim();
          }
          if (id && model) out.set(id, model);
        }
      }
    }
  } catch {
    // A malformed extension shouldn't break realtime; keep what was read
  }
  return out;
}

const fetchFeed = async (name: string) => {
  const res = await fetch(`${BASE_URL}/${name}.pb?key=${Resource.BkkApiKey.value}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (name === "VehiclePositions") models = readVehicleModels(bytes);
  const message = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(bytes);
  return GtfsRealtimeBindings.transit_realtime.FeedMessage.toObject(message, {
    enums: String,
    longs: String,
    defaults: true,
    arrays: true,
    objects: true,
    oneofs: true,
  }) as any;
};

const toStopTimeUpdates = (feed: any, now: number) => {
  const rows: Row[] = [];
  for (const entity of feed.entity) {
    const trip = entity.tripUpdate?.trip;
    if (!trip) continue;
    for (const stu of entity.tripUpdate.stopTimeUpdate) {
      rows.push([
        trip.tripId ?? null,
        trip.startTime ?? null,
        trip.startDate ?? null,
        trip.directionId ?? null,
        trip.routeId ?? null,
        stu.stopId ?? null,
        stu.stopSequence ?? null,
        stu.arrival?.delay ?? null,
        stu.departure?.delay ?? null,
        stu.departure?.time ?? null,
        stu.arrival?.time ?? null,
        stu.scheduleRelationship ?? null,
        now,
        now,
      ]);
    }
  }
  return rows;
};

// TEMP-CODE (remove later?): BKK's feed sometimes drops a vehicle's trip for a moment and then sends it again.
// So we remember each vehicle's last trip and use it for up to TRIP_MEMORY_S seconds when the feed has none.
// Lives in memory per Lambda instance, so it's best-effort, not a guarantee.
const TRIP_MEMORY_S = 120;
const lastTrip = new Map<string, { tripId: string; startDate: string | null; startTime: string | null; seen: number }>();

const toVehiclePositions = (feed: any, now: number) => {
  const rows: Row[] = [];
  for (const entity of feed.entity) {
    const v = entity.vehicle;
    if (!v) continue;
    // Trip as sent; if the feed has none, the last one we saw for this vehicle (when it's recent enough)
    let tripId: string | null = v.trip?.tripId || null;
    let startDate: string | null = v.trip?.startDate ?? null;
    let startTime: string | null = v.trip?.startTime ?? null;
    if (tripId) {
      lastTrip.set(entity.id, { tripId, startDate, startTime, seen: now });
    } else {
      const remembered = lastTrip.get(entity.id);
      if (remembered && now - remembered.seen <= TRIP_MEMORY_S) {
        tripId = remembered.tripId;
        startDate = remembered.startDate;
        startTime = remembered.startTime;
      }
    }
    rows.push([
      entity.id,
      v.position?.bearing ?? null,
      v.position?.latitude ?? null,
      v.position?.longitude ?? null,
      v.position?.speed ?? null,
      v.currentStopSequence ?? null,
      tripId,
      startDate,
      startTime,
      v.congestionLevel ?? null,
      v.occupancyStatus ?? null,
      v.occupancyPercentage ?? null,
      v.currentStatus ?? null,
      v.vehicle?.id ?? null,
      v.vehicle?.label ?? null,
      v.vehicle?.licensePlate ?? null,
      v.vehicle?.wheelchairAccessible ?? null,
      v.timestamp ?? null,
      now,
      now,
    ]);
  }
  return rows;
};

let loadedGeneration = -1;

type Kind = "trips" | "vehicles";
type Feed = { rows: Row[]; header: number; fetchedAt: number };
const feeds: Record<Kind, Feed> = {
  trips: { rows: [], header: 0, fetchedAt: 0 },
  vehicles: { rows: [], header: 0, fetchedAt: 0 },
};
const inflight: Partial<Record<Kind, Promise<void>>> = {};

/**
 * Fetch one feed and replace its rows. Each feed is independent, so a slow trip feed doesn't hold up vehicles.
 * A feed whose header timestamp is older than the one we already have is ignored (BKK's caches don't agree on age).
 */
const refreshFeed = (kind: Kind) => {
  inflight[kind] ??= (async () => {
    try {
      const name = kind === "trips" ? "TripUpdates" : "VehiclePositions";
      const feed = await fetchFeed(name);
      const header = Number(feed.header?.timestamp ?? 0);
      const now = Math.floor(Date.now() / 1000);
      if (header && header < feeds[kind].header) return;
      feeds[kind] = {
        rows: kind === "trips" ? toStopTimeUpdates(feed, now) : toVehiclePositions(feed, now),
        header: header || feeds[kind].header,
        fetchedAt: Date.now(),
      };
      loadedGeneration = -1; // the TEMP tables need rebuilding from the new rows
    } catch (err) {
      // A failed refresh keeps the last good rows (until MAX_AGE_MS)
      console.error(`${kind} refresh failed`, err);
    } finally {
      inflight[kind] = undefined;
    }
  })();
  return inflight[kind]!;
};

const fill = (table: string, columns: string[], rows: Row[]) => {
  const db = connection();
  db.exec(`DELETE FROM temp.${table}`);
  const insert = db.prepare(
    `INSERT INTO temp.${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`
  );
  for (const row of rows) insert.run(...row);
};

/** Rows to serve for a feed: none once it is older than MAX_AGE_MS (the API then falls back to schedule-only times). */
const fresh = (kind: Kind, now: number) => (now - feeds[kind].fetchedAt > MAX_AGE_MS ? [] : feeds[kind].rows);

const load = () => {
  const db = connection();
  db.exec(`
    CREATE TEMP TABLE IF NOT EXISTS stop_time_updates (${STOP_TIME_UPDATE_COLUMNS.join(", ")});
    CREATE INDEX IF NOT EXISTS temp.idx_stop_time_updates ON stop_time_updates (trip_id, stop_id);
    CREATE TEMP TABLE IF NOT EXISTS vehicle_positions (${VEHICLE_POSITION_COLUMNS.join(", ")});
  `);
  const now = Date.now();
  db.exec("BEGIN");
  try {
    fill("stop_time_updates", STOP_TIME_UPDATE_COLUMNS, fresh("trips", now));
    fill("vehicle_positions", VEHICLE_POSITION_COLUMNS, fresh("vehicles", now));
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  loadedGeneration = generation;
};

/**
 * Make sure the realtime TEMP tables are ready. Never waits on BKK unless the data is missing or older than MAX_AGE_MS;
 * otherwise a stale-enough feed is refreshed in the background while this request is served from the cache.
 */
export const ensureRealtime = async () => {
  const now = Date.now();
  for (const kind of ["trips", "vehicles"] as Kind[]) {
    const age = now - feeds[kind].fetchedAt;
    if (feeds[kind].fetchedAt === 0 || age > MAX_AGE_MS) {
      await refreshFeed(kind);
    } else if (age > TTL_MS[kind]) {
      // TEMP-CODE (remove later?): wait briefly for a refresh instead of firing and forgetting. A Lambda can freeze
      // right after it responds, which stopped background refreshes from ever finishing (data went stale for ~90 s).
      // If BKK is slow, the request still goes out with the cached rows after REFRESH_WAIT_MS.
      await Promise.race([refreshFeed(kind), new Promise((r) => setTimeout(r, REFRESH_WAIT_MS))]);
    }
  }
  if (loadedGeneration !== generation) load();
};
