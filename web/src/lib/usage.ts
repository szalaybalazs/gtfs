/**
 * What this user opens, for ranking search results ("frecency": frequency
 * weighted by recency, as in Firefox's address bar). Kept in localStorage only.
 */
type Entry = { n: number; last: number }
type Store = Record<string, Entry>

const KEY = 'usage-v1'
const HALF_LIFE_DAYS = 14
const MAX_ENTRIES = 300

function load(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store
  } catch {
    return {}
  }
}

/** Record that the user opened something, e.g. `station:F02600` or `route:3010`. */
export function recordVisit(key: string) {
  try {
    const store = load()
    const e = store[key] ?? { n: 0, last: 0 }
    // Count at most one visit per 10 minutes, so refreshes don't inflate it
    if (Date.now() - e.last > 10 * 60_000) e.n += 1
    e.last = Date.now()
    store[key] = e
    const keys = Object.keys(store)
    if (keys.length > MAX_ENTRIES) {
      keys.sort((a, b) => store[a].last - store[b].last).slice(0, keys.length - MAX_ENTRIES).forEach((k) => delete store[k])
    }
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // storage unavailable: just don't learn
  }
}

/** 0 for never opened; grows with visits, halves every two weeks without one. */
export function frecency(key: string, store: Store = load()) {
  const e = store[key]
  if (!e) return 0
  const days = (Date.now() - e.last) / 86_400_000
  return e.n * Math.pow(0.5, days / HALF_LIFE_DAYS)
}

/**
 * Rank items by text match plus a boost for things the user opens often.
 * Items that don't match the query are dropped.
 */
export function rank<T>(items: T[], query: string, text: (t: T) => string[], key: (t: T) => string, score: (q: string, s: string) => number) {
  const store = load()
  return items
    .map((item, i) => {
      const match = Math.max(0, ...text(item).map((s) => score(query, s)))
      return { item, i, match, total: match + 20 * Math.log2(1 + frecency(key(item), store)) }
    })
    .filter((x) => x.match > 0)
    .sort((a, b) => b.total - a.total || a.i - b.i)
    .map((x) => x.item)
}
