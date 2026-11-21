import { useCallback, useSyncExternalStore } from 'react'

/** How far "Nearby stops" looks, in metres (a setting; wider helps where stops are sparse). */
export const RADII = [500, 1000, 2000, 5000] as const
export type Radius = (typeof RADII)[number]

const KEY = 'nearby-radius'
const DEFAULT: Radius = 1000
const listeners = new Set<() => void>()

function read(): Radius {
  try {
    const v = Number(localStorage.getItem(KEY))
    return (RADII as readonly number[]).includes(v) ? (v as Radius) : DEFAULT
  } catch {
    return DEFAULT
  }
}

export function useNearbyRadius() {
  const radius = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    read,
    () => DEFAULT,
  )
  const set = useCallback((r: Radius) => {
    try {
      localStorage.setItem(KEY, String(r))
    } catch {
      // Storage unavailable: nothing to remember
    }
    listeners.forEach((l) => l())
  }, [])
  return [radius, set] as const
}
