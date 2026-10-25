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
