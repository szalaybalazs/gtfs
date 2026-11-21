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
 * `label` is the English name; the UI shows t(`category.${key}`) (lib/i18n.ts).
 */
// Pictogram colours: BKK's palette, but tram a darker yellow than its badges (#FFD800) so the pictogram keeps contrast on white;
// highlights (e.g. the selected type chip) use the lines' own badge colour instead
export const CATEGORIES = [
  { key: 'metro', label: 'Metro', icon: metroIcon, color: '#000000', test: (r: Routeish) => r.type === 'SUBWAY' },
  { key: 'tram', label: 'Tram', icon: tramIcon, color: '#e8b800', test: (r: Routeish) => r.type === 'TRAM' },
  { key: 'trolley', label: 'Trolleybus', icon: trolleyIcon, color: '#e41f18', test: (r: Routeish) => r.type === 'TROLLEYBUS' },
  { key: 'bus', label: 'Bus', icon: busIcon, color: '#009EE3', test: (r: Routeish) => r.type === 'BUS' && !isNight(r) },
  { key: 'night', label: 'Night', icon: nightIcon, color: '#000000', test: (r: Routeish) => r.type === 'BUS' && isNight(r) },
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

/**
 * Replacement buses ("pótlóbusz") and the rail category they stand in for.
 * BKK marks them only by route id: VP… = villamospótló (tram), MP… = metró-
 * pótló. They stay buses (blue badges); this just lets lists group them with
 * the line they replace. (TP… exists too but is used by a night bus, so it's
 * not treated as a trolleybus replacement.)
 */
export function replacesCategory(r: { routeId: string }): Category['key'] | null {
  if (/^VP/i.test(r.routeId)) return 'tram'
  if (/^MP/i.test(r.routeId)) return 'metro'
  return null
}
