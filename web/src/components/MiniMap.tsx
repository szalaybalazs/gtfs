import maplibregl from 'maplibre-gl'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { RouteRef } from '../lib/api'
import { vehicleIcon } from '../lib/mapIcons'
import { useGeoJson, useGlMap, useMarkers, type HtmlMarker, type LngLat } from '../lib/glmap'
import { useT } from '../lib/i18n'

export type MapPoint = { lat: number; lon: number; label?: string; strong?: boolean; color?: string }

type Props = {
  points: MapPoint[]
  line?: [number, number][] // [lat, lon]
  color?: string
  /** The vehicle, drawn exactly like on the main map */
  vehicle?: { lat: number; lon: number; route: RouteRef | null; bearing: number | null } | null
  height?: number
  /** Tap opens this full screen (e.g. the transit map with the trip on it); it gets a close callback. */
  expand?: (close: () => void) => ReactNode
}

/** Small, static-feeling map: an optional line, some points, an optional vehicle. */
export default function MiniMap(props: Props) {
  const t = useT()
  const [full, setFull] = useState(false)
  const { height = 260, expand } = props
  const expandable = !!expand
  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFull(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [full])
  if (props.points.length === 0 && !(props.line && props.line.length > 0)) return null
  return (
    <>
      <div className="relative overflow-hidden rounded-2xl" style={{ height }}>
        <MapView {...props} interactive={!expandable} />
        {expandable && (
          <button type="button" onClick={() => setFull(true)} aria-label={t('map.openFullScreen')} className="absolute inset-0 z-10 cursor-zoom-in">
            <span className="absolute right-2 bottom-2 rounded-full bg-surface/90 px-3 py-1 text-[13px] font-semibold shadow">{t('map.tapToExplore')}</span>
          </button>
        )}
      </div>
      {full &&
        expand &&
        createPortal(<div className="fixed inset-0 z-[1150] bg-canvas">{expand(() => setFull(false))}</div>, document.body)}
    </>
  )
}

function MapView({ points, line, color = '#2563eb', vehicle, interactive }: Props & { interactive: boolean }) {
  const container = useRef<HTMLDivElement>(null)
  // Everything that must be in view
  const all = useMemo<LngLat[]>(
    () => [...(line ?? []), ...points.map((p) => [p.lat, p.lon] as [number, number])].map(([lat, lon]) => [lon, lat]),
    [line, points],
  )
  const bounds = useMemo(() => {
    const b = new maplibregl.LngLatBounds(all[0], all[0])
    for (const p of all) b.extend(p)
    return b
  }, [all])
  const map = useGlMap(container, { bounds, interactive })

  // Refit when the data changes (the bounds option only applies on creation)
  const key = all.length ? `${all[0]}|${all[all.length - 1]}|${all.length}` : ''
  useEffect(() => {
    if (map && all.length) map.fitBounds(bounds, { padding: 24, maxZoom: 16, animate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key])

  useGeoJson(
    map,
    'mini-line',
    line && line.length > 1 ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line.map(([lat, lon]) => [lon, lat]) } } : null,
    [{ id: 'mini-line', type: 'line', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': color, 'line-width': 5, 'line-opacity': 0.85 } }],
  )
  useGeoJson(
    map,
    'mini-points',
    {
      type: 'FeatureCollection',
      features: points.map((p) => ({ type: 'Feature', properties: { strong: !!p.strong, color: p.color ?? color }, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } })),
    },
    [
      {
        id: 'mini-points',
        type: 'circle',
        paint: {
          // Pins in each stop's own colour; the stop you came from is the bigger, filled one
          'circle-radius': ['case', ['get', 'strong'], 7, 5],
          'circle-color': ['case', ['get', 'strong'], ['get', 'color'], '#ffffff'],
          'circle-stroke-width': ['case', ['get', 'strong'], 3, 2.5],
          'circle-stroke-color': ['case', ['get', 'strong'], '#ffffff', ['get', 'color']],
        },
      },
    ],
  )

  const markers = useMemo<HtmlMarker[]>(
    () => (vehicle ? [{ key: 'vehicle', at: [vehicle.lon, vehicle.lat], ...vehicleIcon(vehicle.route, vehicle.bearing, 16, false), z: 10 }] : []),
    [vehicle],
  )
  useMarkers(map, markers)

  return (
    <>
      <div className="absolute inset-0">
          <div ref={container} className="h-full w-full bg-canvas" />
        </div>
    </>
  )
}
