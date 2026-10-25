import { useCallback, useEffect, useState } from 'react'

export type Coords = { lat: number; lon: number }

type State = {
  coords: Coords | null
  error: string | null
  loading: boolean
}

/**
 * One-shot location lookup, like the app's LocationManager. Requests the
 * position on mount when `auto` is set, otherwise only when `request` is
 * called.
 */
export function useGeolocation(auto = false) {
  const [state, setState] = useState<State>({ coords: null, error: null, loading: false })

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState((s) => ({ ...s, error: 'Location is not available in this browser' }))
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setState({
          coords: { lat: pos.coords.latitude, lon: pos.coords.longitude },
          error: null,
          loading: false,
        }),
      (err) =>
        setState((s) => ({
          ...s,
          loading: false,
          error: err.code === err.PERMISSION_DENIED ? 'Location access is not allowed' : err.message,
        })),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }, [])

  useEffect(() => {
    if (auto) request()
  }, [auto, request])

  return { ...state, request }
}
