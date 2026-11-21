import { useCallback, useSyncExternalStore } from 'react'
import type { Mark } from '../components/LineMarks'

/**
 * Which markers to show on departures and lines (a setting): someone who never
 * takes a bike can hide the bike icon, etc. Stored as the hidden ones, so a
 * marker added later shows by default.
 */
export type ShownMark = Mark | 'bikes'

const KEY = 'hidden-marks'
const listeners = new Set<() => void>()
let cache: { raw: string | null; set: Set<ShownMark> } = { raw: null, set: new Set() }

function read(): Set<ShownMark> {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    // Storage unavailable: show everything
  }
  if (raw !== cache.raw) {
    let list: ShownMark[] = []
    try {
      list = raw ? JSON.parse(raw) : []
    } catch {
      list = []
    }
    cache = { raw, set: new Set(Array.isArray(list) ? list : []) }
  }
  return cache.set
}

const EMPTY = new Set<ShownMark>()

export function useShownMarks() {
  const hidden = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    read,
    () => EMPTY,
  )
  const toggle = useCallback((m: ShownMark) => {
    const next = new Set(read())
    if (next.has(m)) next.delete(m)
    else next.add(m)
    try {
      localStorage.setItem(KEY, JSON.stringify([...next]))
    } catch {
      // Storage unavailable: nothing to remember
    }
    listeners.forEach((l) => l())
  }, [])
  return { shows: (m: ShownMark) => !hidden.has(m), toggle }
}
