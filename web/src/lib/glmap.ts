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
      ref.current.setStyle(style)
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
}

/** Taps on markers shouldn't also count as taps on the empty map. */
let lastMarkerTap = 0
export const tappedMarker = () => Date.now() - lastMarkerTap < 300

/** HTML markers, diffed by key so panning doesn't rebuild them. */
export function useMarkers(map: GlMap | null, items: HtmlMarker[]) {
  const store = useRef(new Map<string, { marker: maplibregl.Marker; el: HTMLDivElement; inner: HTMLDivElement; html: string; item: HtmlMarker }>())

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
        el.appendChild(inner)
        const marker = new maplibregl.Marker({ element: el, anchor: 'top-left' }).setLngLat(item.at).addTo(map)
        entry = { marker, el, inner, html: '', item }
        const e = entry
        el.addEventListener('click', (ev) => {
          ev.stopPropagation()
          lastMarkerTap = Date.now()
          e.item.onClick?.()
        })
        store.current.set(item.key, entry)
      }
      entry.item = item
      entry.marker.setLngLat(item.at)
      if (entry.html !== item.html) {
        entry.inner.innerHTML = item.html
        entry.html = item.html
      }
      const [w, h] = item.size ?? [0, 0]
      const [ax, ay] = item.anchor ?? [w / 2, h / 2]
      entry.inner.style.left = `${-ax}px`
      entry.inner.style.top = `${-ay}px`
      if (w) entry.inner.style.width = `${w}px`
      if (h) entry.inner.style.height = `${h}px`
      entry.el.style.zIndex = String(item.z ?? 0)
    }
    for (const [key, entry] of store.current) {
      if (!seen.has(key)) {
        entry.marker.remove()
        store.current.delete(key)
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
