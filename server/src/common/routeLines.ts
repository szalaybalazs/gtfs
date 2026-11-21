import { routeTypeName } from "../constants";

/**
 * The map's Lines layer: every BKK line's path, one per direction (the shape
 * most of its trips use), simplified (~8 m) and rounded, so the whole network
 * is a few hundred KB. Built by the nightly import into route_lines; the API
 * only reads it. Takes a query function so it runs on both the import's
 * better-sqlite3 and the API's node:sqlite.
 */
type All = (sql: string, ...params: unknown[]) => any[];

export function buildRouteLines(all: All): { type: string; feature: any }[] {
  const picks = all(
    `SELECT t.route_id, t.direction_id, t.shape_id, COUNT(*) AS n
     FROM trips t JOIN routes r ON r.route_id = t.route_id
     WHERE r.agency_id = 'BKK' AND t.shape_id IS NOT NULL
     GROUP BY t.route_id, t.direction_id, t.shape_id
     ORDER BY n DESC`
  );
  const chosen = new Map<string, any>();
  for (const p of picks) {
    const key = `${p.route_id}|${p.direction_id}`;
    if (!chosen.has(key)) chosen.set(key, p);
  }
  const out: { type: string; feature: any }[] = [];
  for (const p of chosen.values()) {
    const [r] = all("SELECT route_id, route_short_name, route_type, route_color FROM routes WHERE route_id = ?", p.route_id);
    if (!r) continue;
    const pts = all("SELECT shape_pt_lat AS lat, shape_pt_lon AS lon FROM shapes WHERE shape_id = ? ORDER BY shape_pt_sequence", p.shape_id).map(
      (x) => [x.lon, x.lat] as [number, number]
    );
    if (pts.length < 2) continue;
    const coords = simplify(pts, 0.00008).map(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]);
    const type = routeTypeName(r.route_type) ?? "BUS";
    out.push({
      type,
      feature: {
        type: "Feature",
        properties: { routeId: String(r.route_id), name: r.route_short_name, type, color: `#${r.route_color || "888888"}` },
        geometry: { type: "LineString", coordinates: coords },
      },
    });
  }
  return out;
}

/** Douglas–Peucker on [lon, lat] points; tolerance in degrees (~0.00008 ≈ 8 m) */
export function simplify(points: [number, number][], tolerance: number): [number, number][] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = points[a], [bx, by] = points[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-12;
    let max = 0, at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * points[i][0] - dx * points[i][1] + bx * ay - by * ax) / len;
      if (d > max) { max = d; at = i; }
    }
    if (max > tolerance && at > 0) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  return points.filter((_, i) => keep[i]);
}
