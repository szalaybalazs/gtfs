import busIcon from '../assets/bkk/bus_full.svg'
import boatIcon from '../assets/bkk/duna_full.svg'
import otherIcon from '../assets/bkk/funicular_full.svg'
import metroIcon from '../assets/bkk/metro_full.svg'
import nightIcon from '../assets/bkk/suburbanbus_outer.svg'
import tramIcon from '../assets/bkk/tram_outer.svg'
import trolleyIcon from '../assets/bkk/trolley_full.svg'
import type { RouteType } from './api'

type Routeish = { type?: RouteType | null; color?: string | null }

/**
 * Line categories in BKK's order, with official BKK pictograms
 * (BKK-Icon-Pack, bkk.hu) and BKK's colour coding.
 */
export const CATEGORIES = [
  { key: 'metro', label: 'Metro', icon: metroIcon, color: '#4a4a4a', test: (r: Routeish) => r.type === 'SUBWAY' },
  { key: 'tram', label: 'Tram', icon: tramIcon, color: '#e8b800', test: (r: Routeish) => r.type === 'TRAM' },
  { key: 'trolley', label: 'Trolleybus', icon: trolleyIcon, color: '#e41f18', test: (r: Routeish) => r.type === 'TROLLEYBUS' },
  { key: 'bus', label: 'Bus', icon: busIcon, color: '#009fe3', test: (r: Routeish) => r.type === 'BUS' && !isNight(r) },
  { key: 'night', label: 'Night', icon: nightIcon, color: '#1c1c1e', test: (r: Routeish) => r.type === 'BUS' && isNight(r) },
  { key: 'boat', label: 'Boat', icon: boatIcon, color: '#2b5ba8', test: (r: Routeish) => r.type === 'FERRY' },
  { key: 'other', label: 'Other', icon: otherIcon, color: '#7a6a58', test: () => true },
] as const

export type Category = (typeof CATEGORIES)[number]

/** BKK night buses are the black ones. */
function isNight(r: Routeish) {
  const c = (r.color ?? '').replace('#', '').toLowerCase()
  return c === '000000' || c === '1e1e1e' || c === '231f20'
}

export function categoryOf(r: Routeish): Category {
  return CATEGORIES.find((c) => c.test(r))!
}
