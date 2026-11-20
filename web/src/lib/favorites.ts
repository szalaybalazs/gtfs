import { useCallback, useSyncExternalStore } from 'react'
import type { RouteSummary } from './api'

/** Favourite routes, kept in this browser only. */
export type FavoriteRoute = Pick<RouteSummary, 'routeId' | 'shortName' | 'color' | 'textColor'>

const KEY = 'favorite-routes'
const listeners = new Set<() => void>()
let cache: FavoriteRoute[] | null = null

function read(): FavoriteRoute[] {
  if (cache) return cache
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? '[]') as FavoriteRoute[]
  } catch {
    cache = []
  }
  return cache
}

function write(next: FavoriteRoute[]) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage unavailable (private mode): keep the in-memory copy for this session.
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, read, () => [])
  const isFavorite = useCallback((id: string) => favorites.some((f) => f.routeId === id), [favorites])
  const toggle = useCallback((route: FavoriteRoute) => {
    const current = read()
    const { routeId, shortName, color, textColor } = route
    write(
      current.some((f) => f.routeId === routeId)
        ? current.filter((f) => f.routeId !== routeId)
        : [...current, { routeId, shortName, color, textColor }],
    )
  }, [])
  return { favorites, isFavorite, toggle }
}
