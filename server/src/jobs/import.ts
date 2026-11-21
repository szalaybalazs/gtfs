import { createReadStream, rmSync, statSync } from "node:fs";
import zlib from "node:zlib";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { importGtfs, openDb } from "gtfs";
import { Resource } from "sst";

// Builds the static timetable SQLite from the agency GTFS zips and uploads it
// to S3, where the API picks it up. Runs daily as a Fargate task.

const sqlitePath = process.env.SQLITE_PATH ?? "/tmp/timetable.sqlite";

rmSync(sqlitePath, { force: true });

await importGtfs({
  agencies: [
    {
      url: "https://go.bkk.hu/api/static/v1/public-gtfs/budapest_gtfs.zip",
    },
    {
      url: "https://gtfs.kti.hu/public-gtfs/volanbusz_gtfs.zip",
    },
    {
      url: "https://www.mavcsoport.hu/gtfs/gtfsMavMenetrend.zip",
      headers: { Authorization: `Basic ${Resource.MavAuth.value}` },
    },
  ],
  sqlitePath,
  csvOptions: { skip_records_with_error: true },
  downloadTimeout: 120_000,
  ignoreDuplicates: false,
  ignoreErrors: false,
  verbose: true,
});

// Indexes the API never uses (GTFS-Flex and timestamp lookups), ~600 MB
const UNUSED_INDEXES = [
  "idx_stop_times_arrival_timestamp",
  "idx_stop_times_departure_timestamp",
  "idx_stop_times_start_pickup_drop_off_window_timestamp",
  "idx_stop_times_pickup_booking_rule_id",
  "idx_stop_times_drop_off_booking_rule_id",
  "idx_stop_times_location_id",
  "idx_stop_times_location_group_id",
];

// Compact and switch to a single-file journal so the uploaded file is self-contained
const db = openDb({ sqlitePath });
for (const index of UNUSED_INDEXES) db.exec(`DROP INDEX IF EXISTS ${index}`);

// Per-line markers for the app's legend, precomputed here so the API never
// scans stop_times for them:
// - low_floor: every trip has wheelchair_accessible = 1
// - circular:  most trips end where they start (same stop name)
// - demand:    some stops are request-only (pickup/drop-off type 2 = phone ahead)
// - front_door: some trips board by the front door only (BKK marks the headsign "[Elsőajtós]")
db.exec(`
  DROP TABLE IF EXISTS route_flags;
  CREATE TABLE route_flags AS
  WITH ends AS (
    SELECT trip_id, MIN(stop_sequence) AS first_seq, MAX(stop_sequence) AS last_seq FROM stop_times GROUP BY trip_id
  ),
  circ AS (
    SELECT t.route_id, AVG(s1.stop_name = s2.stop_name) AS share
    FROM ends e
    JOIN trips t ON t.trip_id = e.trip_id
    JOIN stop_times f ON f.trip_id = e.trip_id AND f.stop_sequence = e.first_seq
    JOIN stop_times l ON l.trip_id = e.trip_id AND l.stop_sequence = e.last_seq
    JOIN stops s1 ON s1.stop_id = f.stop_id
    JOIN stops s2 ON s2.stop_id = l.stop_id
    GROUP BY t.route_id
  ),
  marks AS (
    SELECT t.route_id,
      MAX(st.pickup_type = 2 OR st.drop_off_type = 2) AS demand,
      MAX(COALESCE(st.stop_headsign, '') LIKE '%Elsőajtós%' OR COALESCE(t.trip_headsign, '') LIKE '%Elsőajtós%') AS front_door
    FROM stop_times st JOIN trips t ON t.trip_id = st.trip_id
    GROUP BY t.route_id
  )
  SELECT r.route_id,
    COALESCE((SELECT MIN(COALESCE(wheelchair_accessible, 0) = 1) FROM trips WHERE route_id = r.route_id), 0) AS low_floor,
    COALESCE(circ.share > 0.5, 0) AS circular,
    COALESCE(marks.demand, 0) AS demand,
    COALESCE(marks.front_door, 0) AS front_door
  FROM routes r
  LEFT JOIN circ ON circ.route_id = r.route_id
  LEFT JOIN marks ON marks.route_id = r.route_id;
  CREATE UNIQUE INDEX idx_route_flags ON route_flags (route_id);
`);
db.pragma("journal_mode = DELETE");
db.exec("VACUUM");
db.close();

console.log(`Uploading ${(statSync(sqlitePath).size / 1e6).toFixed(0)} MB (zstd compressed)`);

if (process.env.SKIP_UPLOAD) process.exit(0);

await new Upload({
  client: new S3Client({}),
  params: {
    Bucket: Resource.Gtfs.name,
    Key: "timetable.sqlite.zst",
    Body: createReadStream(sqlitePath).pipe(
      zlib.createZstdCompress({
        params: { [zlib.constants.ZSTD_c_compressionLevel]: 6 },
      })
    ),
  },
  queueSize: 8,
  partSize: 32 * 1024 * 1024,
}).done();

console.log("Upload complete");
