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

export const hex = (value: string | null | undefined, fallback: string) =>
  value ? (value.startsWith('#') ? value : `#${value}`) : fallback
