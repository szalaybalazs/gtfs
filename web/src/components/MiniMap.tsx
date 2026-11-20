import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import Basemap from './Basemap'
import { hull } from '../lib/geo'
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, useMap } from 'react-leaflet'

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
        <Basemap />
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
