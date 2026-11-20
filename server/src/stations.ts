import { db, generation } from "./db";

/**
 * Stop groups ("stations"). The BKK feed has no parent_station, so stops are
 * grouped by normalised name, then split into clusters of stops within
 * CLUSTER_RADIUS_M of each other (the same street name can exist in several
 * districts). A station's id is its lowest stop_id, so it stays stable as
 * long as that stop exists.
 */

const CLUSTER_RADIUS_M = 400;

export type Station = {
  stationId: string;
  name: string;
  lat: number;
  lon: number;
  stopIds: string[];
};

type Index = {
  generation: number;
  stations: Station[];
  byId: Map<string, Station>;
  byStop: Map<string, Station>;
};

let cache: Index | undefined;

/** "Budapest, Széll Kálmán tér M (Csaba utca)" -> "Széll Kálmán tér" */
export function normaliseName(name: string) {
  return name
    .replace(/^Budapest,\s*/i, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+(M\+H|M|H|HÉV)$/u, "")
    .trim();
}

export function distanceM(aLat: number, aLon: number, bLat: number, bLon: number) {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(h));
}

function build(): Index {
  const rows = db
    .query(
      "SELECT stop_id, stop_name, stop_lat, stop_lon FROM stops WHERE stop_lat IS NOT NULL AND (location_type IS NULL OR location_type = 0 OR location_type = '')"
    )
    .all() as { stop_id: string; stop_name: string | null; stop_lat: number; stop_lon: number }[];

  const byName = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = normaliseName(row.stop_name ?? row.stop_id).toLocaleLowerCase("hu");
    const list = byName.get(key);
    if (list) list.push(row);
    else byName.set(key, [row]);
  }

  const stations: Station[] = [];
  for (const group of byName.values()) {
    const clusters: (typeof rows)[] = [];
    for (const row of group) {
      const cluster = clusters.find((c) =>
        c.some((s) => distanceM(s.stop_lat, s.stop_lon, row.stop_lat, row.stop_lon) <= CLUSTER_RADIUS_M)
      );
      if (cluster) cluster.push(row);
      else clusters.push([row]);
    }
    for (const cluster of clusters) {
      const ids = cluster.map((s) => s.stop_id).sort();
      // Display name: the shortest normalised spelling in the cluster
      const name = cluster
        .map((s) => normaliseName(s.stop_name ?? s.stop_id))
        .sort((a, b) => a.length - b.length)[0];
      stations.push({
        stationId: ids[0],
        name,
        lat: cluster.reduce((sum, s) => sum + s.stop_lat, 0) / cluster.length,
        lon: cluster.reduce((sum, s) => sum + s.stop_lon, 0) / cluster.length,
        stopIds: ids,
      });
    }
  }
  stations.sort((a, b) => a.name.localeCompare(b.name, "hu"));

  const byId = new Map(stations.map((s) => [s.stationId, s]));
  const byStop = new Map<string, Station>();
  for (const station of stations) for (const id of station.stopIds) byStop.set(id, station);
  return { generation, stations, byId, byStop };
}

/** Built once per loaded timetable, then reused. */
export function stationIndex(): Index {
  if (!cache || cache.generation !== generation) cache = build();
  return cache;
}
