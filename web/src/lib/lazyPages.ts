import { lazy } from 'react'

/** Pages that pull in MapLibre load as separate chunks, so the first load stays light. */
const loaders = {
  map: () => import('../pages/MapPage'),
  station: () => import('../pages/StationPage'),
  route: () => import('../pages/RouteDetailsPage'),
  trip: () => import('../pages/TripPage'),
}
export const MapPage = lazy(loaders.map)
export const StationPage = lazy(loaders.station)
export const RouteDetailsPage = lazy(loaders.route)
export const TripPage = lazy(loaders.trip)
export const UxMapPage = lazy(() => import('../pages/UxMapPage'))
export const PhonePreviewPage = lazy(() => import('../pages/PhonePreviewPage'))

let warmed = false
/** Fetches the map chunks ahead of need (they also land in the service worker cache for offline). */
export function preloadMap() {
  if (warmed) return
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  if (c?.saveData || /(^|-)2g$/.test(c?.effectiveType ?? '')) return
  warmed = true
  for (const load of Object.values(loaders)) load().catch(() => (warmed = false))
}

/** Warm up once the first screen has settled. */
export function preloadMapWhenIdle() {
  const run = () => preloadMap()
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 })
  else setTimeout(run, 2000)
}
