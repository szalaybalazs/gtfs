import { useEffect, useState } from 'react'

/**
 * Clean vector basemap close to Apple Maps' look: OpenFreeMap "Liberty"
 * (light) / "Dark". Free, no API key; OpenStreetMap data.
 * (CARTO now needs a key; Apple MapKit JS needs an Apple Developer token.)
 */
export const BASEMAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'

const LIGHT = 'https://tiles.openfreemap.org/styles/liberty'
const DARK = 'https://tiles.openfreemap.org/styles/dark'

function isDark() {
  const forced = document.documentElement.dataset.theme
  if (forced) return forced === 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Style URL that follows the app's light/dark theme. */
export function useBasemapStyle() {
  const [dark, setDark] = useState(isDark)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setDark(isDark())
    mq.addEventListener('change', update)
    const obs = new MutationObserver(update)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      mq.removeEventListener('change', update)
      obs.disconnect()
    }
  }, [])
  return dark ? DARK : LIGHT
}
