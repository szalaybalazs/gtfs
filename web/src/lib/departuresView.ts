import { useCallback, useSyncExternalStore } from 'react'

/**
 * How a stop group's departures are shown, remembered across pages and visits:
 * - 'lines': the line board, one row per line + direction (default)
 * - 'timeline': every departure in time order
 * A ?view= in the URL (a shared link) wins over the remembered choice.
 */
export type DeparturesView = 'lines' | 'timeline'

const KEY = 'departures-view'
const listeners = new Set<() => void>()

function read(): DeparturesView {
  try {
    return localStorage.getItem(KEY) === 'timeline' ? 'timeline' : 'lines'
  } catch {
    return 'lines'
  }
}

export function useDeparturesView() {
  const view = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    read,
    () => 'lines' as const,
  )
  const set = useCallback((v: DeparturesView) => {
    try {
      localStorage.setItem(KEY, v)
    } catch {
      // Storage unavailable: it just won't be remembered
    }
    listeners.forEach((l) => l())
  }, [])
  return [view, set] as const
}
