import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { Resource } from "sst";
import { connection, generation } from "./db";

// Realtime data is fetched on demand instead of synced on a schedule. Decoded
// feeds are cached in memory and mirrored into TEMP tables, which shadow the
// (empty) tables of the same name in the read-only static database, so the
// existing SQL joins keep working.

const TTL_MS = 30_000;
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

let cache: { stopTimeUpdates: Row[]; vehiclePositions: Row[] } | undefined;
let fetchedAt = 0;
let loadedGeneration = -1;
let inflight: Promise<void> | undefined;

const fetchFeed = async (name: string) => {
  const res = await fetch(`${BASE_URL}/${name}.pb?key=${Resource.BkkApiKey.value}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const message = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
    new Uint8Array(await res.arrayBuffer())
  );
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

const toVehiclePositions = (feed: any, now: number) => {
  const rows: Row[] = [];
  for (const entity of feed.entity) {
    const v = entity.vehicle;
    if (!v) continue;
    rows.push([
      entity.id,
      v.position?.bearing ?? null,
      v.position?.latitude ?? null,
      v.position?.longitude ?? null,
      v.position?.speed ?? null,
      v.currentStopSequence ?? null,
      v.trip?.tripId ?? null,
      v.trip?.startDate ?? null,
      v.trip?.startTime ?? null,
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

const refresh = async () => {
  const now = Math.floor(Date.now() / 1000);
  const [tripUpdates, vehiclePositions] = await Promise.allSettled([
    fetchFeed("TripUpdates"),
    fetchFeed("VehiclePositions"),
  ]);

  // A failed feed keeps its last good data (or none), so the API serves
  // schedule-only times rather than failing
  const next = cache ?? { stopTimeUpdates: [], vehiclePositions: [] };
  if (tripUpdates.status === "fulfilled") {
    next.stopTimeUpdates = toStopTimeUpdates(tripUpdates.value, now);
  } else {
    console.error("TripUpdates refresh failed", tripUpdates.reason);
  }
  if (vehiclePositions.status === "fulfilled") {
    next.vehiclePositions = toVehiclePositions(vehiclePositions.value, now);
  } else {
    console.error("VehiclePositions refresh failed", vehiclePositions.reason);
  }

  cache = next;
  loadedGeneration = -1;
  fetchedAt = Date.now();
};

const fill = (table: string, columns: string[], rows: Row[]) => {
  const db = connection();
  db.exec(`DELETE FROM temp.${table}`);
  const insert = db.prepare(
    `INSERT INTO temp.${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`
  );
  for (const row of rows) insert.run(...row);
};

const load = () => {
  const db = connection();
  db.exec(`
    CREATE TEMP TABLE IF NOT EXISTS stop_time_updates (${STOP_TIME_UPDATE_COLUMNS.join(", ")});
    CREATE INDEX IF NOT EXISTS temp.idx_stop_time_updates ON stop_time_updates (trip_id, stop_id);
    CREATE TEMP TABLE IF NOT EXISTS vehicle_positions (${VEHICLE_POSITION_COLUMNS.join(", ")});
  `);
  db.exec("BEGIN");
  try {
    fill("stop_time_updates", STOP_TIME_UPDATE_COLUMNS, cache!.stopTimeUpdates);
    fill("vehicle_positions", VEHICLE_POSITION_COLUMNS, cache!.vehiclePositions);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  loadedGeneration = generation;
};

/** Make sure the realtime TEMP tables are fresh (at most TTL_MS old) */
export const ensureRealtime = async () => {
  if (!cache || Date.now() - fetchedAt > TTL_MS) {
    inflight ??= refresh().finally(() => (inflight = undefined));
    await inflight;
  }
  if (loadedGeneration !== generation) load();
};
