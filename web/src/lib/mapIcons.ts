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

/** CSS mask for a pictogram inside an HTML string (inlined data URLs contain quotes). */
const maskCss = (url: string) => {
  const u = url.replace(/"/g, '%22').replace(/'/g, '%27')
  return `-webkit-mask:url('${u}') center/contain no-repeat;mask:url('${u}') center/contain no-repeat`
}

/** Tiny badges (HTML, for map markers): one row up to four, else two even rows; a grey "…" badge when there are more than fit. */
function badgesHtml(routes: RouteRef[], max = 8, justify = 'center') {
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
 * Stop group or platform, like the iOS map: zoomed out a pictogram dot; closer in a small dot with its first few
 * line badges under it (the name and direction are on the card once tapped). Coloured by the main kind of vehicle there.
 */
export function groupIcon(station: Pick<Station, 'name' | 'routes'>, withBadges: boolean, selected = false): Icon {
  const c = mainCategory(station.routes)
  if (!withBadges)
    return {
      html: `<div style="width:28px;height:28px;box-sizing:border-box;border-radius:50%;background:${c.color};border:2px solid #fff;box-shadow:0 1px 3px rgb(0 0 0/.3);display:flex;align-items:center;justify-content:center"><span style="width:16px;height:16px;background:#fff;${maskCss(c.icon)}"></span></div>`,
      size: [28, 28],
      anchor: [14, 14],
    }
  const d = selected ? 20 : 15
  return {
    html:
      // Invisible larger tap area around the dot (the dot alone is too small to hit)
      `<div style="position:absolute;left:-22px;top:-22px;width:44px;height:44px;border-radius:50%"></div>` +
      `<div style="position:absolute;left:${-d / 2}px;top:${-d / 2}px;width:${d}px;height:${d}px;box-sizing:border-box;border-radius:50%;background:${c.color};border:2px solid #fff;box-shadow:0 1px 2px rgb(0 0 0/.3)"></div>` +
      `<div style="position:absolute;left:0;top:${d / 2 + 2}px;transform:translateX(-50%);padding:4px">${badgesHtml(station.routes)}</div>`,
  }
}

/** Vehicle: a round marker in the line's colour with its number; an arrow on the rim shows the heading. */
export function vehicleIcon(route: RouteRef | null, bearing: number | null, zoom: number, selected: boolean): Icon {
  const c = route ? categoryOf(route) : CATEGORIES[CATEGORIES.length - 1]
  const bg = hex(route?.color, c.color)
  const fg = hex(route?.textColor, '#ffffff')
  if (zoom < GROUPS_ZOOM)
    return {
      html: `<div style="width:14px;height:14px;box-sizing:border-box;border-radius:50%;background:${bg};border:2px solid #fff;box-shadow:0 1px 3px rgb(0 0 0/.35)"></div>`,
      size: [14, 14],
    }
  const label = esc(route?.shortName ?? '')
  const size = label.length > 3 ? 34 : 28
  const arrow =
    bearing != null
      ? `<div style="position:absolute;inset:-7px;transform:rotate(${Math.round(bearing)}deg)"><div style="margin:0 auto;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:7px solid ${bg}"></div></div>`
      : ''
  return {
    html:
      // Selected: a soft halo in the line's own colour and slightly bigger (scaled, so it stays on the GPU)
      `<div style="position:relative;width:${size}px;height:${size}px;${selected ? 'transform:scale(1.15)' : ''}">${arrow}` +
      `<div style="position:absolute;inset:0;border-radius:50%;background:${bg};color:${fg};border:2px solid #fff;box-shadow:${selected ? `0 0 0 7px ${bg}40,0 2px 6px rgb(0 0 0/.35)` : '0 1px 4px rgb(0 0 0/.4)'};display:flex;align-items:center;justify-content:center;font:700 ${label.length > 3 ? 10 : 12}px system-ui">${label}</div></div>`,
    size: [size, size],
  }
}

