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
    const ok = (pos: GeolocationPosition) =>
      setState({ coords: { lat: pos.coords.latitude, lon: pos.coords.longitude }, error: null, loading: false })
    const fail = (err: GeolocationPositionError) =>
      setState((s) => ({
        ...s,
        loading: false,
        // Distinguish the cases: home screen apps on iOS often fail with a timeout, not a denial
        error:
          err.code === err.PERMISSION_DENIED
            ? 'Location access is not allowed'
            : err.code === err.TIMEOUT
              ? 'Location timed out (no GPS fix yet)'
              : `Location unavailable${err.message ? `: ${err.message}` : ''}`,
      }))
    // High accuracy first; iOS home screen apps frequently time out or report
    // "unavailable" with it, so fall back to a coarse fix before giving up.
    navigator.geolocation.getCurrentPosition(
      ok,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) return fail(err)
        navigator.geolocation.getCurrentPosition(ok, fail, { enableHighAccuracy: false, timeout: 20_000, maximumAge: 5 * 60_000 })
      },
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 60_000 },
    )
  }, [])

  useEffect(() => {
    if (auto) request()
  }, [auto, request])

  return { ...state, request }
}
