import maplibregl, { type GeoJSONSourceSpecification, type LayerSpecification, type LngLatBoundsLike, type Map as GlMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { BASEMAP_ATTRIBUTION, useBasemapStyle } from './basemap'

/**
 * Native MapLibre maps. Everything we draw (lines, outlines, stops, vehicles)
 * lives inside MapLibre itself, so it moves with the map in the same frame
 * when panning and pinching (the old Leaflet overlays lagged behind).
 */
export type { GlMap }
export type LngLat = [number, number] // [lon, lat]

type Options = {
  center?: LngLat
  zoom?: number
  bounds?: LngLatBoundsLike
  padding?: number
  interactive?: boolean
}

/** Creates the map once the style has loaded; follows light/dark by swapping the style. */
export function useGlMap(container: RefObject<HTMLDivElement | null>, { center, zoom, bounds, padding = 24, interactive = true }: Options) {
  const style = useBasemapStyle()
  const [map, setMap] = useState<GlMap | null>(null)
  const ref = useRef<GlMap | null>(null)
  const applied = useRef<unknown>(null)

  useEffect(() => {
    if (!style || !container.current || applied.current === style) return
    applied.current = style
    if (ref.current) {
      // Theme changed: new colours, same view. Our sources/layers re-add on 'style.load'.
      // diff: false so 'style.load' fires and our sources/layers get re-added (the diff path drops them silently)
      ref.current.setStyle(style, { diff: false })
      return
    }
    const m = new maplibregl.Map({
      container: container.current,
      style,
      center: center ?? [19.0402, 47.4979],
      zoom: zoom ?? 13,
      bounds,
      fitBoundsOptions: { padding, maxZoom: 16 },
      interactive,
      attributionControl: { compact: true, customAttribution: BASEMAP_ATTRIBUTION },
      dragRotate: false,
      pitchWithRotate: false,
      // Crisp on phones without rendering more than needed
      pixelRatio: Math.min(window.devicePixelRatio, 2),
    })
    m.touchZoomRotate.disableRotation()
    ref.current = m
    if (import.meta.env.DEV) (window as unknown as { __map?: GlMap }).__map = m
    m.on('load', () => {
      // Credits stay behind the small ⓘ button instead of a strip that flickers while moving
      m.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
      setMap(m)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style])

  useEffect(
    () => () => {
      ref.current?.remove()
      ref.current = null
      applied.current = null
    },
    [],
  )
  return map
}

/** A GeoJSON source with its layers, kept up to date and re-added after a style swap. */
export function useGeoJson(map: GlMap | null, id: string, data: GeoJSON.GeoJSON | null, layers: Omit<LayerSpecification, 'source'>[], before?: string) {
  const latest = useRef({ data, layers })
  latest.current = { data, layers }

  useEffect(() => {
    if (!map) return
    const add = () => {
      const { data, layers } = latest.current
      const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
      const source = map.getSource(id) as maplibregl.GeoJSONSource | undefined
      if (source) source.setData(data ?? empty)
      else map.addSource(id, { type: 'geojson', data: data ?? empty } as GeoJSONSourceSpecification)
      for (const l of layers) if (!map.getLayer(l.id)) map.addLayer({ ...l, source: id } as LayerSpecification, before && map.getLayer(before) ? before : undefined)
    }
    add()
    map.on('style.load', add)
    return () => {
      map.off('style.load', add)
      if (!map.getStyle()) return
      for (const l of latest.current.layers) if (map.getLayer(l.id)) map.removeLayer(l.id)
      if (map.getSource(id)) map.removeSource(id)
    }
  }, [map, id, before])

  useEffect(() => {
    if (!map) return
    const source = map.getSource(id) as maplibregl.GeoJSONSource | undefined
    source?.setData(data ?? { type: 'FeatureCollection', features: [] })
  }, [map, id, data])
}

export type HtmlMarker = {
  key: string
  at: LngLat
  html: string
  /** Box size and the point inside it that sits on the coordinate (like Leaflet's iconSize/iconAnchor). */
  size?: [number, number]
  anchor?: [number, number]
  z?: number
  onClick?: () => void
  /** When the position changes, glide there along whichever of these paths ([lon, lat]) it's on, instead of jumping (vehicles) */
  paths?: LngLat[][] | null
  /** Glide to new positions at all (straight line if there's no path) */
  animate?: boolean
  /** Where a new marker starts from, gliding to `at` (stops branching out of their group) */
  from?: LngLat
  glideMs?: number
  /** Selected: grows a little with a short spring (CSS transition on the existing element, so the marker isn't rebuilt) */
  selected?: boolean
}

const GLIDE_MS = 1500
const FADE_MS = 220

/** Distance along `path` of the point on it nearest to `p`, plus how far off the path `p` is (in degrees-ish, lat-scaled). */
function project(path: LngLat[], p: LngLat) {
  const k = Math.cos((p[1] * Math.PI) / 180)
  let best = { along: 0, off: Infinity }
  let acc = 0
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1], [bx, by] = path[i]
    const dx = (bx - ax) * k, dy = by - ay
    const len2 = dx * dx + dy * dy
    const tt = len2 ? Math.max(0, Math.min(1, (((p[0] - ax) * k) * dx + (p[1] - ay) * dy) / len2)) : 0
    const off = Math.hypot((ax + (bx - ax) * tt - p[0]) * k, ay + (by - ay) * tt - p[1])
    const seg = Math.sqrt(len2)
    if (off < best.off) best = { along: acc + seg * tt, off }
    acc += seg
  }
  return best
}

/** The point at distance `d` along `path` (same units as project) */
function pointAt(path: LngLat[], d: number): LngLat {
  const k = Math.cos((path[0][1] * Math.PI) / 180)
  let acc = 0
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1], [bx, by] = path[i]
    const seg = Math.hypot((bx - ax) * k, by - ay)
    if (acc + seg >= d) {
      const tt = seg ? (d - acc) / seg : 0
      return [ax + (bx - ax) * tt, ay + (by - ay) * tt]
    }
    acc += seg
  }
  return path[path.length - 1]
}

/**
 * A function of t in [0, 1] giving the in-between position from `from` to `to`:
 * along the path when both lie on it and `to` is ahead (≤ ~3 km), otherwise a straight line.
 */
function glide(from: LngLat, to: LngLat, paths?: LngLat[][] | null): (t: number) => LngLat {
  for (const path of paths ?? []) {
    if (path.length < 2) continue
    const a = project(path, from), b = project(path, to)
    const near = 0.0008 // ~80 m off the path still counts as on it
    if (a.off < near && b.off < near && b.along >= a.along && b.along - a.along < 0.03) {
      return (t) => pointAt(path, a.along + (b.along - a.along) * t)
    }
  }
  return (t) => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]
}

/** Taps on markers shouldn't also count as taps on the empty map. */
let lastMarkerTap = 0
export const tappedMarker = () => Date.now() - lastMarkerTap < 300

/** HTML markers, diffed by key so panning doesn't rebuild them. */
export function useMarkers(map: GlMap | null, items: HtmlMarker[]) {
  const store = useRef(new Map<string, { marker: maplibregl.Marker; el: HTMLDivElement; inner: HTMLDivElement; html: string; item: HtmlMarker; at: LngLat; anim?: number; leaving?: number }>())

  useEffect(() => {
    if (!map) return
    const seen = new Set<string>()
    for (const item of items) {
      seen.add(item.key)
      let entry = store.current.get(item.key)
      if (!entry) {
        const el = document.createElement('div')
        el.style.cssText = 'width:0;height:0;overflow:visible;cursor:pointer'
        const inner = document.createElement('div')
        inner.style.position = 'absolute'
        // Fade and grow in from the pin point; reversed on removal
        inner.style.cssText += `;opacity:0;scale:.6;transition:opacity ${FADE_MS}ms,scale ${FADE_MS}ms,transform 200ms cubic-bezier(.34,1.56,.64,1);transform-origin:0 0`
        el.appendChild(inner)
        requestAnimationFrame(() => requestAnimationFrame(() => ((inner.style.opacity = '1'), (inner.style.scale = '1'))))
        const marker = new maplibregl.Marker({ element: el, anchor: 'top-left' }).setLngLat(item.from ?? item.at).addTo(map)
        entry = { marker, el, inner, html: '', item, at: item.from ?? item.at }
        const e = entry
        el.addEventListener('click', (ev) => {
          ev.stopPropagation()
          lastMarkerTap = Date.now()
          e.item.onClick?.()
        })
        store.current.set(item.key, entry)
      }
      if (entry.leaving) {
        // Came back while fading out
        clearTimeout(entry.leaving)
        entry.leaving = undefined
        entry.el.style.pointerEvents = ''
        entry.inner.style.opacity = '1'
        entry.inner.style.scale = '1'
      }
      entry.item = item
      const moved = entry.at[0] !== item.at[0] || entry.at[1] !== item.at[1]
      if (moved && item.animate && !document.hidden) {
        // Glide from where it is now (mid-glide included) to the new spot
        if (entry.anim) cancelAnimationFrame(entry.anim)
        const current = entry.marker.getLngLat()
        const at = glide([current.lng, current.lat], item.at, item.paths)
        const start = performance.now()
        const e = entry
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / (item.glideMs ?? GLIDE_MS))
          e.marker.setLngLat(at(1 - (1 - t) ** 3))
          e.anim = t < 1 ? requestAnimationFrame(step) : undefined
        }
        entry.anim = requestAnimationFrame(step)
      } else if (moved || !item.animate) {
        if (entry.anim) cancelAnimationFrame(entry.anim)
        entry.marker.setLngLat(item.at)
      }
      entry.at = item.at
      if (entry.html !== item.html) {
        entry.inner.innerHTML = item.html
        entry.html = item.html
      }
      const [w, h] = item.size ?? [0, 0]
      const [ax, ay] = item.anchor ?? [w / 2, h / 2]
      entry.inner.style.left = `${-ax}px`
      entry.inner.style.top = `${-ay}px`
      // Grow around the pin point; `scale` is the fade, `transform` the selection, so they don't fight
      entry.inner.style.transformOrigin = `${ax}px ${ay}px`
      entry.inner.style.transform = item.selected ? 'scale(1.3)' : 'scale(1)'
      if (w) entry.inner.style.width = `${w}px`
      if (h) entry.inner.style.height = `${h}px`
      entry.el.style.zIndex = String(item.z ?? 0)
    }
    for (const [key, entry] of store.current) {
      if (!seen.has(key) && !entry.leaving) {
        if (entry.anim) cancelAnimationFrame(entry.anim)
        entry.el.style.pointerEvents = 'none'
        entry.inner.style.opacity = '0'
        entry.inner.style.scale = '.6'
        entry.leaving = window.setTimeout(() => {
          entry.marker.remove()
          store.current.delete(key)
        }, FADE_MS)
      }
    }
  }, [map, items])

  useEffect(
    () => () => {
      for (const e of store.current.values()) e.marker.remove()
      store.current.clear()
    },
    [],
  )
}
