import L from 'leaflet'
import '@maplibre/maplibre-gl-leaflet'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import { BASEMAP_ATTRIBUTION, useBasemapStyle } from '../lib/basemap'

/** Vector basemap drawn by MapLibre underneath Leaflet's markers. */
export default function Basemap() {
  const map = useMap()
  const style = useBasemapStyle()
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layer = (L as any).maplibreGL({ style, attribution: BASEMAP_ATTRIBUTION })
    layer.addTo(map)
    // Drop the basemap's POI icons once loaded: our own stops and vehicles go on top
    const gl = layer.getMaplibreMap()
    const strip = () => {
      for (const l of gl.getStyle()?.layers ?? []) {
        if (/^poi|^airport$/.test(l.id) && gl.getLayer(l.id)) gl.removeLayer(l.id)
      }
    }
    gl.on('style.load', strip)
    return () => {
      gl.off('style.load', strip)
      layer.remove()
    }
  }, [map, style])
  return null
}
