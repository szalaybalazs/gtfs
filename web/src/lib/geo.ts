import type { Coords } from './useGeolocation'

/** Great-circle distance in metres. */
export function distance(a: Coords, b: Coords) {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 6_371_000 * 2 * Math.asin(Math.sqrt(h))
}

export function formatDistance(metres: number) {
  return metres < 1000 ? `${Math.round(metres / 10) * 10} m` : `${(metres / 1000).toFixed(1)} km`
}

/** Feed colour → "#rrggbb"; anything else falls back (values end up in inline HTML styles). */
export const hex = (value: string | null | undefined, fallback: string) =>
  value && /^#?[0-9a-f]{6}$/i.test(value) ? (value.startsWith('#') ? value : `#${value}`) : fallback

/** Convex hull (monotone chain) of [lat, lon] points, padded slightly. */
export function hull(points: [number, number][]): [number, number][] {
  const pts = [...points].sort((a, b) => a[1] - b[1] || a[0] - b[0])
  const cross = (o: number[], a: number[], b: number[]) => (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1])
  const lower: [number, number][] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: [number, number][] = []
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  const ring = [...lower.slice(0, -1), ...upper.slice(0, -1)]
  // Push each corner ~15 m away from the centre so platform dots sit inside
  const c = ring.reduce((acc, p) => [acc[0] + p[0] / ring.length, acc[1] + p[1] / ring.length], [0, 0])
  return ring.map(([lat, lon]) => {
    const dLat = lat - c[0]
    const dLon = lon - c[1]
    const len = Math.hypot(dLat, dLon) || 1
    return [lat + (dLat / len) * 0.00014, lon + (dLon / len) * 0.0002]
  })
}
