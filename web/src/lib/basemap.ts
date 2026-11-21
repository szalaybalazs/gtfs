import type { StyleSpecification } from 'maplibre-gl'
import { useEffect, useState } from 'react'

/**
 * Basemap: OpenFreeMap's "Liberty" vector style (free, no key, OpenStreetMap
 * data), recoloured to read like Apple Maps: warm grey land, soft green parks,
 * light blue water, white streets, yellow motorways, no POI clutter. One base
 * style, two palettes, so light and dark match exactly.
 */
export const BASEMAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'

const SOURCE = 'https://tiles.openfreemap.org/styles/liberty'

type Palette = {
  land: string
  park: string
  wood: string
  water: string
  waterLabel: string
  building: string
  street: string
  streetCasing: string
  major: string
  majorCasing: string
  motorway: string
  motorwayCasing: string
  path: string
  rail: string
  label: string
  minorLabel: string
  halo: string
  special: string
}

const LIGHT: Palette = {
  land: '#f4f2ed',
  park: '#d3ebc4',
  wood: '#c9e5b6',
  water: '#a7d3f3',
  waterLabel: '#4a7fae',
  building: '#e7e4de',
  street: '#ffffff',
  streetCasing: '#dddad3',
  major: '#ffffff',
  majorCasing: '#d2cec5',
  motorway: '#f8d878',
  motorwayCasing: '#e2b84f',
  path: '#ffffff',
  rail: '#c8c8cc',
  label: '#3a3a3c',
  minorLabel: '#6e6e73',
  halo: '#ffffff',
  special: '#ebe8e1',
}

const DARK: Palette = {
  land: '#232326',
  park: '#1e3124',
  wood: '#1c2e21',
  water: '#1a3850',
  waterLabel: '#7fb2dc',
  building: '#2e2e32',
  street: '#3d3d42',
  streetCasing: '#2a2a2e',
  major: '#4a4a50',
  majorCasing: '#2f2f33',
  motorway: '#6e5d2c',
  motorwayCasing: '#4d4120',
  path: '#38383c',
  rail: '#4b4b50',
  label: '#e5e5ea',
  minorLabel: '#a1a1a6',
  halo: '#1c1c1e',
  special: '#29292d',
}

let base: Promise<StyleSpecification> | null = null
/** One recoloured style object per theme, so re-renders never hand MapLibre a "new" style mid-load */
const recoloured: { light?: StyleSpecification; dark?: StyleSpecification } = {}
const fetchBase = () =>
  (base ??= fetch(SOURCE)
    .then((r) => {
      if (!r.ok) throw new Error(`basemap ${r.status}`)
      return r.json() as Promise<StyleSpecification>
    })
    .catch((e) => {
      base = null
      throw e
    }))

/** Liberty, recoloured with `p`. Unknown layers keep their own colours. */
function recolour(style: StyleSpecification, p: Palette): StyleSpecification {
  const layers = style.layers
    // Our stops and vehicles are the points of interest; 3D buildings fight the markers
    .filter((l) => !/^poi|^airport$|^building-3d$|one_way_arrow|hatching$|^natural_earth$/.test(l.id))
    .map((l) => {
      const paint = { ...((l as { paint?: Record<string, unknown> }).paint ?? {}) }
      const id = l.id
      const set = (key: string, value: unknown) => (paint[key] = value)
      if (l.type === 'background') set('background-color', p.land)
      else if (l.type === 'fill') {
        if (id === 'water') set('fill-color', p.water)
        else if (id === 'park' || id === 'landcover_grass' || id === 'landuse_pitch' || id === 'landuse_cemetery') {
          set('fill-color', p.park)
          delete paint['fill-outline-color']
        } else if (id === 'landcover_wood') set('fill-color', p.wood)
        else if (id === 'building') {
          set('fill-color', p.building)
          set('fill-outline-color', p.building)
        } else if (/^landuse_|^aeroway|landcover_(sand|ice|wetland)/.test(id)) set('fill-color', p.special)
      } else if (l.type === 'line') {
        if (/waterway/.test(id)) set('line-color', p.water)
        else if (id === 'park_outline') set('line-color', p.park)
        else if (/rail/.test(id)) set('line-color', p.rail)
        else if (/motorway/.test(id)) set('line-color', /casing/.test(id) ? p.motorwayCasing : p.motorway)
        else if (/path_pedestrian/.test(id)) set('line-color', /casing/.test(id) ? p.streetCasing : p.path)
        else if (/secondary|trunk|primary|link/.test(id)) set('line-color', /casing/.test(id) ? p.majorCasing : p.major)
        else if (/minor|street|service|track/.test(id)) set('line-color', /casing/.test(id) ? p.streetCasing : p.street)
        else if (/^aeroway/.test(id)) set('line-color', p.special)
        else if (/^boundary/.test(id)) set('line-color', p.minorLabel)
        if (/^tunnel/.test(id)) set('line-opacity', 0.5)
      } else if (l.type === 'symbol') {
        if (/water/.test(id)) set('text-color', p.waterLabel)
        else if (/highway-name|road/.test(id)) set('text-color', p.minorLabel)
        else set('text-color', p.label)
        if ('text-halo-color' in paint || l.type === 'symbol') set('text-halo-color', p.halo)
      }
      return { ...l, paint } as typeof l
    })
  return { ...style, layers }
}

function isDark() {
  const forced = document.documentElement.dataset.theme
  if (forced) return forced === 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** The recoloured style for the app's current light/dark theme (null while loading). */
export function useBasemapStyle() {
  const [dark, setDark] = useState(isDark)
  const [style, setStyle] = useState<StyleSpecification | null>(null)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setDark(isDark())
    mq.addEventListener('change', update)
    const obs = new MutationObserver(update)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      mq.removeEventListener('change', update)
      obs.disconnect()
    }
  }, [])
  useEffect(() => {
    let live = true
    fetchBase()
      .then((s) => {
        const key = dark ? 'dark' : 'light'
        recoloured[key] ??= recolour(s, dark ? DARK : LIGHT)
        if (live) setStyle(recoloured[key]!)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [dark])
  return style
}
