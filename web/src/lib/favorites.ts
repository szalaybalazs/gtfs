import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { RouteRef } from './api'

/**
 * Favourites, kept in this browser only. Three kinds:
 * - line: just the line (a small badge)
 * - lineStop: one line from one stop (its next departures)
 * - stop: a stop with all its lines and departures
 * - lines: several lines from one stop group (or one of its stops), e.g. "4 or 6 from Blaha"
 */
export type Favorite =
  | { kind: 'line'; id: string; route: RouteRef }
  | { kind: 'lineStop'; id: string; route: RouteRef; stopId: string; stationId: string; stopName: string; headsign: string | null }
  | { kind: 'stop'; id: string; stopId: string; stationId: string; name: string; headsigns: string[]; routes: RouteRef[] }
  | { kind: 'lines'; id: string; routes: RouteRef[]; stationId: string; stopIds: string[]; from: string | null; name: string; headsigns: string[] }

type Draft<K extends Favorite['kind']> = Omit<Extract<Favorite, { kind: K }>, 'id'>
export type FavoriteDraft = Draft<'line'> | Draft<'lineStop'> | Draft<'stop'> | Draft<'lines'>

export function favoriteId(f: FavoriteDraft): string {
  if (f.kind === 'line') return `line:${f.route.routeId}`
  if (f.kind === 'lineStop') return `lineStop:${f.route.routeId}:${f.stopId}`
  if (f.kind === 'lines') return `lines:${f.routes.map((r) => r.routeId).sort().join(',')}:${f.from ?? f.stationId}`
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
  /** All favourites as JSON (to copy to another device or browser) */
  const exportJson = useCallback(() => JSON.stringify({ app: 'budapestgone', version: 2, favorites: read() }), [])
  /**
   * Adds favourites from exported JSON (the object above, or a bare list); ones already
   * here are skipped. Returns how many were added, or null if it isn't valid.
   */
  const importJson = useCallback((text: string): number | null => {
    let data: unknown
    try {
      data = JSON.parse(text.trim())
    } catch {
      return null
    }
    const list = Array.isArray(data) ? data : (data as { favorites?: unknown })?.favorites
    if (!Array.isArray(list)) return null
    const kinds = new Set(['line', 'lineStop', 'stop', 'lines'])
    const valid = list.filter((f): f is Favorite => !!f && typeof f === 'object' && kinds.has((f as Favorite).kind) && typeof (f as Favorite).id === 'string')
    if (valid.length === 0 && list.length > 0) return null
    const current = read()
    const known = new Set(current.map((f) => f.id))
    const added = valid.filter((f) => !known.has(f.id) && (known.add(f.id), true))
    if (added.length) write([...current, ...added])
    return added.length
  }, [])
  const groups = useMemo(
    () => ({
      lines: favorites.filter((f): f is Extract<Favorite, { kind: 'line' }> => f.kind === 'line'),
      lineStops: favorites.filter((f): f is Extract<Favorite, { kind: 'lineStop' }> => f.kind === 'lineStop'),
      stops: favorites.filter((f): f is Extract<Favorite, { kind: 'stop' }> => f.kind === 'stop'),
      multiLines: favorites.filter((f): f is Extract<Favorite, { kind: 'lines' }> => f.kind === 'lines'),
    }),
    [favorites],
  )
  return { favorites, ...groups, has, toggle, clear, exportJson, importJson }
}
