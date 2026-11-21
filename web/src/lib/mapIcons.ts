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

/** Tiny badges row (HTML, for map markers). */
function badgesHtml(routes: RouteRef[], max = 4, justify = 'center') {
  const shown = routes.slice(0, max)
  const more = routes.length - shown.length
  return (
    `<div style="display:flex;gap:2px;justify-content:${justify};white-space:nowrap">` +
    shown
      .map(
        (r) =>
          `<span style="background:${hex(r.color, '#000')};color:${hex(r.textColor, '#fff')};font:700 10px/14px system-ui;padding:0 4px;min-width:14px;text-align:center;border-radius:3px">${esc(r.shortName ?? '')}</span>`,
      )
      .join('') +
    (more > 0 ? `<span style="font:600 10px/14px system-ui;color:#555">+${more}</span>` : '') +
    `</div>`
  )
}

export type Icon = Pick<HtmlMarker, 'html' | 'size' | 'anchor'>

/**
 * Stop group or platform, like the iOS map: zoomed out a pictogram dot; closer in a small dot with its first few
 * line badges under it (the name and direction are on the card once tapped). A single platform's dot is grey.
 */
export function groupIcon(station: Pick<Station, 'name' | 'routes'>, withBadges: boolean, selected = false, platform = false): Icon {
  const c = mainCategory(station.routes)
  if (!withBadges)
    return {
      html: `<div style="width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgb(0 0 0/.3);display:flex;align-items:center;justify-content:center"><span style="width:20px;height:20px;background:${c.color};${maskCss(c.icon)}"></span></div>`,
      size: [22, 22],
      anchor: [11, 11],
    }
  const d = selected ? 14 : 10
  return {
    html:
      `<div style="position:absolute;left:${-d / 2}px;top:${-d / 2}px;width:${d}px;height:${d}px;box-sizing:border-box;border-radius:50%;background:${platform ? '#6b7280' : c.color};border:2px solid #fff;box-shadow:0 1px 2px rgb(0 0 0/.3)"></div>` +
      `<div style="position:absolute;left:0;top:${d / 2 + 2}px;transform:translateX(-50%)">${badgesHtml(station.routes, 4)}</div>`,
  }
}

/** Vehicle: a round marker in the line's colour with its number; an arrow on the rim shows the heading. */
export function vehicleIcon(route: RouteRef | null, bearing: number | null, zoom: number, selected: boolean): Icon {
  const c = route ? categoryOf(route) : CATEGORIES[CATEGORIES.length - 1]
  const bg = hex(route?.color, c.color)
  const fg = hex(route?.textColor, '#ffffff')
  if (zoom < GROUPS_ZOOM || !route)
    return {
      html: `<div style="width:14px;height:14px;box-sizing:border-box;border-radius:50%;background:${bg};border:2px solid #fff;box-shadow:0 1px 3px rgb(0 0 0/.35)"></div>`,
      size: [14, 14],
    }
  const label = esc(route.shortName ?? '')
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

