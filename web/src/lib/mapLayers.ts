import { useCallback, useSyncExternalStore } from 'react'
import type { Category } from './categories'

/**
 * What the transit map shows (the layers menu), remembered in this browser.
 * Lines are off by default: they're context, and the network is dense.
 */
export type MapLayers = { vehicles: boolean; stops: boolean; lines: Category['key'][] }

const KEY = 'map-layers'
const DEFAULT: MapLayers = { vehicles: true, stops: true, lines: [] }
const listeners = new Set<() => void>()
let cache: MapLayers | null = null

function read(): MapLayers {
  if (cache) return cache
  try {
    cache = { ...DEFAULT, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<MapLayers>) }
  } catch {
    cache = DEFAULT
  }
  return cache
}

export function useMapLayers() {
  const layers = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    read,
    () => DEFAULT,
  )
  const set = useCallback((next: Partial<MapLayers>) => {
    cache = { ...read(), ...next }
    try {
      localStorage.setItem(KEY, JSON.stringify(cache))
    } catch {
      // Storage unavailable: keep it for this session
    }
    listeners.forEach((l) => l())
  }, [])
  return [layers, set] as const
}
