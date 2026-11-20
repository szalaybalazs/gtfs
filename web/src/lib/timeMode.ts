import { useCallback, useSyncExternalStore } from 'react'

/** How favourites show times: relative ("3'", "45s") or absolute ("13:05"). Kept in this browser. */
export type TimeMode = 'relative' | 'absolute'

const KEY = 'favorite-time-mode'
const listeners = new Set<() => void>()

function read(): TimeMode {
  try {
    return localStorage.getItem(KEY) === 'absolute' ? 'absolute' : 'relative'
  } catch {
    return 'relative'
  }
}

export function useTimeMode(): [TimeMode, (m: TimeMode) => void] {
  const mode = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    read,
    () => 'relative' as TimeMode,
  )
  const set = useCallback((m: TimeMode) => {
    try {
      localStorage.setItem(KEY, m)
    } catch {
      // ignore: falls back to relative
    }
    listeners.forEach((l) => l())
  }, [])
  return [mode, set]
}

/** "45s" under a minute, otherwise whole minutes with an apostrophe: "3'". */
export function shortRelative(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}'`
}
