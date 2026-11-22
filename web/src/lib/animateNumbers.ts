import { useCallback, useSyncExternalStore } from 'react'

/** Countdowns and "updated … ago" roll their digits when they change (a setting; on by default). */
const KEY = 'animate-numbers'
const listeners = new Set<() => void>()

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function useAnimateNumbers() {
  const on = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    read,
    () => true,
  )
  const set = useCallback((v: boolean) => {
    try {
      localStorage.setItem(KEY, v ? 'on' : 'off')
    } catch {
      // Storage unavailable: nothing to remember
    }
    listeners.forEach((l) => l())
  }, [])
  return [on, set] as const
}
