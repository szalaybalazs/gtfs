import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { RouteRef } from './api'

/**
 * Favourites, kept in this browser only. Three kinds:
 * - line: just the line (a small badge)
 * - lineStop: one line from one stop (its next departures)
 * - stop: a stop with all its lines and departures
 */
export type Favorite =
  | { kind: 'line'; id: string; route: RouteRef }
  | { kind: 'lineStop'; id: string; route: RouteRef; stopId: string; stationId: string; stopName: string; headsign: string | null }
  | { kind: 'stop'; id: string; stopId: string; stationId: string; name: string; headsigns: string[]; routes: RouteRef[] }

type Draft<K extends Favorite['kind']> = Omit<Extract<Favorite, { kind: K }>, 'id'>
export type FavoriteDraft = Draft<'line'> | Draft<'lineStop'> | Draft<'stop'>

export function favoriteId(f: FavoriteDraft): string {
  if (f.kind === 'line') return `line:${f.route.routeId}`
  if (f.kind === 'lineStop') return `lineStop:${f.route.routeId}:${f.stopId}`
  return `stop:${f.stopId}`
}

const KEY = 'favorites-v2'
const LEGACY_KEY = 'favorite-routes'
const listeners = new Set<() => void>()
let cache: Favorite[] | null = null

function read(): Favorite[] {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) cache = JSON.parse(raw) as Favorite[]
    else {
      // One-time move of the old "favourite routes" list into line favourites
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? '[]') as RouteRef[]
      cache = legacy.map((route) => ({ kind: 'line' as const, id: `line:${route.routeId}`, route }))
      if (legacy.length) write(cache)
    }
  } catch {
    cache = []
  }
  return cache!
}

function write(next: Favorite[]) {
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // Storage unavailable (private mode): keep the in-memory copy for this session
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const EMPTY: Favorite[] = []

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, read, () => EMPTY)
  const has = useCallback((id: string) => favorites.some((f) => f.id === id), [favorites])
  const toggle = useCallback((draft: FavoriteDraft) => {
    const id = favoriteId(draft)
    const current = read()
    write(current.some((f) => f.id === id) ? current.filter((f) => f.id !== id) : [...current, { ...draft, id } as Favorite])
  }, [])
  const clear = useCallback(() => write([]), [])
  const groups = useMemo(
    () => ({
      lines: favorites.filter((f): f is Extract<Favorite, { kind: 'line' }> => f.kind === 'line'),
      lineStops: favorites.filter((f): f is Extract<Favorite, { kind: 'lineStop' }> => f.kind === 'lineStop'),
      stops: favorites.filter((f): f is Extract<Favorite, { kind: 'stop' }> => f.kind === 'stop'),
    }),
    [favorites],
  )
  return { favorites, ...groups, has, toggle, clear }
}
