import * as fs from "fs";
import * as https from "https";
import * as http from "http";
import { URL } from "url";
import * as unzipper from "unzipper";
import * as path from "path";
import csv from "csv-parser";
import sqlite3 from "sqlite3";

console.log("Creating timetable database...");
const db = new sqlite3.Database("timetable");
db;

const DOWNLOAD_URL =
  "https://go.bkk.hu/api/static/v1/public-gtfs/budapest_gtfs.zip";

/**
 * Downloads a file from the given URL and saves it to the specified path.
 * @param url - The URL of the file to download.
 * @param savePath - The local path where the file should be saved.
 * @returns A promise that resolves when the download is complete.
 */
function download(url: string, savePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === "https:" ? https : http;

    const request = protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        return;
      }

      const fileStream = fs.createWriteStream(savePath);
      response.pipe(fileStream);

      fileStream.on("finish", () => {
        fileStream.close(() => resolve());
      });

      fileStream.on("error", (err) => {
        fs.unlink(savePath, () => reject(err)); // Delete the file if there is an error
      });
    });

    request.on("error", (err) => {
      reject(err);
    });
  });
}

async function unzipFile(
  zipFilePath: string,
  outputDir: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.createReadStream(zipFilePath)
      .pipe(unzipper.Extract({ path: outputDir }))
      .on("close", resolve)
      .on("error", reject);
  });
}

async function processGtfs(csvFilePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const results: Record<string, any>[] = [];
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on("data", (data: any) => results.push(data))
      .on("end", async () => {
        // Create table if it doesn't exist
        const tableName = path.basename(csvFilePath, path.extname(csvFilePath));
        const columns = Object.keys(results[0]);
        const createTableQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns
          .map((column) => `${column} TEXT`)
          .join(", ")})`;
        await new Promise((res) => db.run(createTableQuery, res));

        // wait for the table to be created

        // Insert data into the table
        const insertQuery = `INSERT INTO ${tableName} (${columns.join(
          ", "
        )}) VALUES (${columns.map(() => "?").join(", ")})`;
        const insertStatement = db.prepare(insertQuery);
        results.forEach((row) => {
          insertStatement.run(Object.values(row));
        });
        insertStatement.finalize();
        resolve();
      })
      .on("error", (err: any) => {
        reject(err);
      });
  });
}

async function convertGtfsToJson(gtfsDir: string): Promise<void> {
  const files = fs.readdirSync(gtfsDir);
  const csvFiles = files.filter((file) => file.endsWith(".txt"));
  const promises = csvFiles.map((csvFile) =>
    processGtfs(path.join(gtfsDir, csvFile))
  );
  await Promise.all(promises);
}

console.log("Downloading GTFS file...");
// Download the GTFS zip file
await download(DOWNLOAD_URL, "./budapest_gtfs.zip");

console.log("Unzipping GTFS file...");
// Unzip the file
await unzipFile("./budapest_gtfs.zip", "./gtfs");

console.log("Converting CSV files to JSON...");
// Convert the CSV files to JSON
await convertGtfsToJson("./gtfs");
