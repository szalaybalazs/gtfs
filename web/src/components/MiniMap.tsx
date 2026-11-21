import maplibregl from 'maplibre-gl'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { roundedHull } from '../lib/geo'
import { useGeoJson, useGlMap, useMarkers, type HtmlMarker, type LngLat } from '../lib/glmap'
import { CloseIcon } from './Icons'
import { useT } from '../lib/i18n'

export type MapPoint = { lat: number; lon: number; label?: string; strong?: boolean }

type Props = {
  /** Shade the convex hull of the points, e.g. a stop group's footprint. */
  area?: boolean
  points: MapPoint[]
  line?: [number, number][] // [lat, lon]
  color?: string
  vehicle?: { lat: number; lon: number; label: string; bg: string; fg: string; info?: ReactNode } | null
  height?: number
  /** Tap opens a full-screen, interactive copy of the map. */
  expandable?: boolean
}

/** Small, static-feeling map: an optional line, some points, an optional vehicle. */
export default function MiniMap(props: Props) {
  const t = useT()
  const [full, setFull] = useState(false)
  const { height = 260, expandable } = props
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
        createPortal(
          <div className="fixed inset-0 z-[1150] bg-canvas">
            <MapView {...props} interactive />
            <button
              type="button"
              onClick={() => setFull(false)}
              aria-label={t('map.close')}
              className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] left-3 z-20 rounded-full bg-surface p-2.5 shadow-lg active:opacity-60"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>,
          document.body,
        )}
    </>
  )
}

function MapView({ points, line, color = '#2563eb', vehicle, area, interactive }: Props & { interactive: boolean }) {
  const container = useRef<HTMLDivElement>(null)
  const [info, setInfo] = useState(false)
  // Everything that must be in view; with an area, its rounded outline (not just the stops)
  const all = useMemo<LngLat[]>(() => {
    const pts = points.map((p) => [p.lat, p.lon] as [number, number])
    const outline = area && pts.length > 1 ? roundedHull(pts, 28) : []
    return [...(line ?? []), ...pts, ...outline].map(([lat, lon]) => [lon, lat])
  }, [line, points, area])
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
    'mini-area',
    area && points.length > 1
      ? ({
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [roundedHull(points.map((p) => [p.lat, p.lon]), 28).map(([lat, lon]) => [lon, lat])] },
        } as GeoJSON.Feature)
      : null,
    [
      // Soft, rounded footprint of the stop group: light fill, thin translucent edge
      { id: 'mini-area-fill', type: 'fill', paint: { 'fill-color': color, 'fill-opacity': 0.1 } },
      { id: 'mini-area-line', type: 'line', layout: { 'line-join': 'round' }, paint: { 'line-color': color, 'line-width': 1.5, 'line-opacity': 0.45 } },
    ],
  )
  useGeoJson(
    map,
    'mini-points',
    {
      type: 'FeatureCollection',
      features: points.map((p) => ({ type: 'Feature', properties: { strong: !!p.strong }, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } })),
    },
    [
      {
        id: 'mini-points',
        type: 'circle',
        paint: {
          // Small dots; the stop you came from is the bigger, filled one
          'circle-radius': ['case', ['get', 'strong'], 6.5, 4.5],
          'circle-color': ['case', ['get', 'strong'], color, '#ffffff'],
          'circle-stroke-width': ['case', ['get', 'strong'], 3, 2],
          'circle-stroke-color': ['case', ['get', 'strong'], '#ffffff', color],
        },
      },
    ],
  )

  const markers = useMemo<HtmlMarker[]>(
    () =>
      vehicle
        ? [
            {
              key: 'vehicle',
              at: [vehicle.lon, vehicle.lat],
              html: `<div style="background:${vehicle.bg};color:${vehicle.fg};font:700 13px/24px system-ui;border-radius:12px;text-align:center;box-shadow:0 1px 6px rgb(0 0 0/.4)">${vehicle.label.replace(/[<>&"]/g, '')}</div>`,
              size: [40, 24],
              z: 10,
              onClick: () => setInfo((v) => !v),
            },
          ]
        : [],
    [vehicle],
  )
  useMarkers(map, markers)

  return (
    <>
      <div className="absolute inset-0">
          <div ref={container} className="h-full w-full bg-canvas" />
        </div>
      {/* Vehicle details as an app card over the map */}
      {interactive && info && vehicle?.info && (
        <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-20 rounded-2xl bg-surface p-4 shadow-xl">{vehicle.info}</div>
      )}
    </>
  )
}
