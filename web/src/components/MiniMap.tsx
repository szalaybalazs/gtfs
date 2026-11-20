import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, TileLayer, useMap } from 'react-leaflet'

export type MapPoint = { lat: number; lon: number; label?: string; strong?: boolean }

/** Small, static-feeling map: an optional line, some points, an optional vehicle. */
export default function MiniMap({
  points,
  line,
  color = '#2563eb',
  vehicle,
  height = 260,
  area,
}: {
  /** Shade the convex hull of the points, e.g. a stop group's footprint. */
  area?: boolean
  points: MapPoint[]
  line?: [number, number][] // [lat, lon]
  color?: string
  vehicle?: { lat: number; lon: number; label: string; bg: string; fg: string } | null
  height?: number
}) {
  const all: [number, number][] = [...(line ?? []), ...points.map((p) => [p.lat, p.lon] as [number, number])]
  if (all.length === 0) return null

  return (
    <div className="overflow-hidden rounded-2xl" style={{ height }}>
      <MapContainer
        bounds={L.latLngBounds(all)}
        boundsOptions={{ padding: [24, 24], maxZoom: 17 }}
        className="h-full w-full"
        zoomControl={false}
        scrollWheelZoom={false}
      >
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBounds points={all} />
        {area && points.length > 2 && (
          <Polygon positions={hull(points.map((p) => [p.lat, p.lon]))} pathOptions={{ color, weight: 2, fillOpacity: 0.15 }} />
        )}
        {line && line.length > 1 && <Polyline positions={line} pathOptions={{ color, weight: 5, opacity: 0.8 }} />}
        {points.map((p, i) => (
          <CircleMarker
            key={`${p.lat},${p.lon},${i}`}
            center={[p.lat, p.lon]}
            radius={p.strong ? 7 : 5}
            pathOptions={{ color: p.strong ? '#111827' : color, weight: 2, fillColor: '#ffffff', fillOpacity: 1 }}
          />
        ))}
        {vehicle && (
          <Marker
            position={[vehicle.lat, vehicle.lon]}
            icon={L.divIcon({
              className: '',
              iconSize: [40, 24],
              iconAnchor: [20, 12],
              html: `<div style="background:${vehicle.bg};color:${vehicle.fg};font:700 13px/24px system-ui;border-radius:12px;text-align:center;box-shadow:0 1px 6px rgb(0 0 0/.4)">${vehicle.label.replace(/[<>&"]/g, '')}</div>`,
            })}
          />
        )}
      </MapContainer>
    </div>
  )
}

/** Refit when the data changes (the bounds prop only applies on mount). */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  const key = points.length ? `${points[0]}|${points[points.length - 1]}|${points.length}` : ''
  useEffect(() => {
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 17 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}

/** Convex hull (monotone chain) of [lat, lon] points, padded slightly. */
function hull(points: [number, number][]): [number, number][] {
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
