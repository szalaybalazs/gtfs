import type { RouteRef, Station } from './api'
import { CATEGORIES, categoryOf, type Category } from './categories'
import { hex } from './geo'
import type { HtmlMarker } from './glmap'

/** Zoom levels (MapLibre, 512 px tiles): stop groups from GROUPS_ZOOM, single stops + outline from STOPS_ZOOM. */
export const GROUPS_ZOOM = 14
export const BADGES_ZOOM = 15
export const STOPS_ZOOM = 16

/** HTML for map markers: stop groups, single stops, vehicles. Shared by every map. */
/** The most prominent vehicle type at a stop decides its colour and pictogram. */
export function mainCategory(routes: RouteRef[]): Category {
  const keys = new Set(routes.map((r) => categoryOf(r).key))
  return CATEGORIES.find((c) => keys.has(c.key)) ?? CATEGORIES[CATEGORIES.length - 1]
}

const esc = (s: string) => s.replace(/[<>&"]/g, '')

/** Variants (56A, 56É…) are left out when the base line (56) is there too. */
export function baseLines(routes: RouteRef[]): RouteRef[] {
  const names = new Set(routes.map((r) => r.shortName))
  // Custom: with 4, 6 and 4-6 all here, just 4-6
  const merged46 = names.has('4') && names.has('6') && names.has('4-6')
  return routes.filter((r) => {
    if (merged46 && (r.shortName === '4' || r.shortName === '6')) return false
    const m = /^(\d+)\p{L}$/u.exec(r.shortName ?? '')
    return !(m && names.has(m[1]))
  })
}

/** Tiny badges (HTML, for map markers): one row up to four, else two even rows; a grey "…" badge when there are more than fit. */
function badgesHtml(allRoutes: RouteRef[], max = 8, justify = 'center') {
  const routes = baseLines(allRoutes)
  const shown = routes.slice(0, max)
  const more = routes.length - shown.length
  const badge = (r: RouteRef) =>
    `<span style="background:${hex(r.color, '#000')};color:${hex(r.textColor, '#fff')};font:700 10px/14px system-ui;padding:0 4px;min-width:14px;text-align:center;border-radius:3px">${esc(r.shortName ?? '')}</span>`
  const ellipsis = `<span style="background:#6b7280;color:#fff;font:700 10px/14px system-ui;padding:0 4px;min-width:14px;text-align:center;border-radius:3px">…</span>`
  const perRow = shown.length > 4 ? Math.ceil(shown.length / 2) : Math.max(shown.length, 1)
  const rows: string[][] = []
  for (let i = 0; i < shown.length; i += perRow) rows.push(shown.slice(i, i + perRow).map(badge))
  if (more > 0 && rows.length) rows[rows.length - 1].push(ellipsis)
  return `<div style="display:flex;flex-direction:column;gap:2px;align-items:${justify === 'center' ? 'center' : 'flex-start'};white-space:nowrap">${rows
    .map((r) => `<div style="display:flex;gap:2px">${r.join('')}</div>`)
    .join('')}</div>`
}

export type Icon = Pick<HtmlMarker, 'html' | 'size' | 'anchor'>

/**
 * Stop group or platform, like the iOS map: zoomed out just the dot; closer in a small dot with its first few
 * line badges under it (the name and direction are on the card once tapped). Coloured by the main kind of vehicle there.
 */
export function groupIcon(station: Pick<Station, 'name' | 'routes'>, withBadges: boolean, selected = false): Icon {
  const c = mainCategory(station.routes)
  // Coloured by the stop's first line (a metro platform is metro-coloured), else by the main kind of vehicle there
  const first = baseLines(station.routes)[0]
  const color = first ? hex(first.color, c.color) : c.color
  // Selection scales only the dot (glmap, through data-dot), so the dot grows and the labels stay put
  const d = 15
  void selected
  return {
    // Zoomed out the badges are left off: just the dot
    html:
      `<div data-dot="1" style="position:absolute;left:${-d / 2}px;top:${-d / 2}px;width:${d}px;height:${d}px;box-sizing:border-box;border-radius:50%;background:${color};border:2px solid #fff;transition:transform .2s cubic-bezier(.34,1.56,.64,1)"></div>` +
      (withBadges ? `<div style="position:absolute;left:0;top:${d / 2 + 2}px;transform:translateX(-50%);padding:4px">${badgesHtml(station.routes)}</div>` : ''),
  }
}

/** Vehicle: a round marker in the line's colour with its number; an arrow on the rim shows the heading. */
export function vehicleIcon(route: RouteRef | null, bearing: number | null, compact: boolean, selected: boolean): Icon {
  const c = route ? categoryOf(route) : CATEGORIES[CATEGORIES.length - 1]
  const bg = hex(route?.color, c.color)
  const fg = hex(route?.textColor, '#ffffff')
  // Collapsed to a dot below the group zoom (the caller passes the live zoom band, not the settled zoom)
  if (compact)
    return {
      html: `<div style="width:14px;height:14px;box-sizing:border-box;border-radius:50%;background:${bg};border:2px solid #fff"></div>`,
      size: [14, 14],
    }
  const label = esc(route?.shortName ?? '')
  const size = label.length > 3 ? 34 : 28
  const arrow =
    bearing != null
      ? `<div style="position:absolute;inset:-7px;transform:rotate(${Math.round(bearing)}deg)"><div style="margin:0 auto;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:7px solid ${bg}"></div></div>`
      : ''
  // The halo is always here (hidden); selecting it only changes its style (glmap), so it grows in instead of appearing
  void selected
  return {
    html:
      `<div style="position:relative;width:${size}px;height:${size}px;">${arrow}` +
      `<div data-halo="1" style="position:absolute;inset:-7px;border-radius:50%;background:${bg};opacity:0;transform:scale(0.6);transition:transform .25s cubic-bezier(.34,1.56,.64,1),opacity .2s ease;pointer-events:none"></div>` +
      `<div style="position:absolute;inset:0;border-radius:50%;background:${bg};color:${fg};border:2px solid #fff;display:flex;align-items:center;justify-content:center;font:700 ${label.length > 3 ? 9 : 11}px system-ui">${label}</div></div>`,
    size: [size, size],
  }
}

