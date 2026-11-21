import { useCallback, useEffect, useState } from 'react'
import { useT } from './i18n'

export type Coords = { lat: number; lon: number }

type Failure = { code: 'unsupported' | 'denied' | 'timeout' | 'unavailable'; detail?: string }

type State = {
  coords: Coords | null
  failure: Failure | null
  loading: boolean
}

/**
 * One-shot location lookup, like the app's LocationManager. Requests the
 * position on mount when `auto` is set, otherwise only when `request` is
 * called.
 */
/**
 * Dev only: a fake position for testing far from any stop.
 * Open the app once with ?mockLocation=kalvin (or =47.4897,19.0613), and =off to stop.
 * Remembered in localStorage; never active in production builds.
 */
const MOCK_PLACES: Record<string, Coords> = {
  kalvin: { lat: 47.4897, lon: 19.0613 },
  deak: { lat: 47.4977, lon: 19.0544 },
  szell: { lat: 47.5073, lon: 19.0236 },
}
function mockLocation(): Coords | null {
  if (!import.meta.env.DEV) return null
  try {
    const param = new URLSearchParams(window.location.search).get('mockLocation')
    if (param === 'off') localStorage.removeItem('mock-location')
    else if (param) {
      const named = MOCK_PLACES[param.toLowerCase()]
      const [lat, lon] = param.split(',').map(Number)
      const coords = named ?? (Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null)
      if (coords) localStorage.setItem('mock-location', JSON.stringify(coords))
    }
    const saved = localStorage.getItem('mock-location')
    return saved ? (JSON.parse(saved) as Coords) : null
  } catch {
    return null
  }
}

export function useGeolocation(auto = false) {
  const t = useT()
  const [state, setState] = useState<State>({ coords: null, failure: null, loading: false })

  const request = useCallback(() => {
    const mock = mockLocation()
    if (mock) {
      setState({ coords: mock, failure: null, loading: false })
      return
    }
    if (!('geolocation' in navigator)) {
      setState((s) => ({ ...s, failure: { code: 'unsupported' } }))
      return
    }
    setState((s) => ({ ...s, loading: true, failure: null }))
    const ok = (pos: GeolocationPosition) =>
      setState({ coords: { lat: pos.coords.latitude, lon: pos.coords.longitude }, failure: null, loading: false })
    const fail = (err: GeolocationPositionError) =>
      setState((s) => ({
        ...s,
        loading: false,
        // Distinguish the cases: home screen apps on iOS often fail with a timeout, not a denial
        failure:
          err.code === err.PERMISSION_DENIED
            ? { code: 'denied' }
            : err.code === err.TIMEOUT
              ? { code: 'timeout' }
              : { code: 'unavailable', detail: err.message || undefined },
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

  // Message in the current language, worked out at render so it follows a language switch
  const f = state.failure
  const error = !f
    ? null
    : f.code === 'unavailable' && f.detail
      ? t('geo.unavailableDetail', { detail: f.detail })
      : t(`geo.${f.code}`)
  return { coords: state.coords, loading: state.loading, error, denied: f?.code === 'denied', request }
}
