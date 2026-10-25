import { createWriteStream, rmSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createZstdDecompress } from "node:zlib";
import type { Readable } from "node:stream";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const KEY = "timetable.sqlite.zst";
// How often a warm Lambda checks S3 for a newer import
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

let conn: DatabaseSync | undefined;
let statements = new Map<string, StatementSync>();
let etag: string | undefined;
let path: string | undefined;
let checkedAt = 0;

/** Bumped every time a new database file is opened (realtime tables need repopulating) */
export let generation = 0;

const open = (file: string) => {
  conn?.close();
  conn = new DatabaseSync(file, { readOnly: true });
  statements = new Map();
  generation++;
};

export const connection = () => {
  if (!conn) throw new Error("Database not loaded");
  return conn;
};

/** Same shape as bun:sqlite's cached `db.query(sql)` */
export const db = {
  query(sql: string) {
    let stmt = statements.get(sql);
    if (!stmt) {
      stmt = connection().prepare(sql);
      statements.set(sql, stmt);
    }
    return stmt;
  },
};

/** Local development: open a file from disk */
export const openLocal = (file: string) => open(file);

/**
 * Lambda: download the timetable from S3 into /tmp on cold start, and swap
 * in a fresh copy when the daily import has uploaded a new one.
 */
export const ensureDb = async (bucket: string) => {
  if (conn && Date.now() - checkedAt < CHECK_INTERVAL_MS) return;

  const s3 = new S3Client({});
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: KEY }));
    checkedAt = Date.now();
    if (conn && head.ETag === etag) return;

    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: KEY }));
    const next = `/tmp/timetable-${Date.now()}.sqlite`;
    await pipeline(
      res.Body as Readable,
      createZstdDecompress(),
      createWriteStream(next)
    );

    const prev = path;
    open(next);
    path = next;
    etag = res.ETag;
    if (prev) rmSync(prev, { force: true });
    console.log(`Loaded timetable ${etag}`);
  } catch (err) {
    // Keep serving the copy we have if the refresh fails
    if (!conn) throw err;
    console.error("Timetable refresh failed", err);
    checkedAt = Date.now();
  }
};
