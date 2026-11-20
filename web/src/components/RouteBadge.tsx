import type { CSSProperties } from 'react'
import type { RouteSummary } from '../lib/api'
import { hex } from '../lib/geo'

/** Badge height in px; BKK's "vh-size". */
const SIZES = { sm: 24, lg: 32 } as const

/**
 * Line badge with BKK's proportions (bkk.hu .bkk-grid-vh-num): a 2s × s
 * rounded rectangle with a 5px radius at s = 24px. Always rectangular; round
 * shapes are for vehicle-type pictograms, not line numbers.
 * Uses the app's system font (BKK's Open Sans looked worse here).
 */
export default function RouteBadge({
  route,
  size = 'sm',
  fit = false,
}: {
  /** Hug the label instead of the fixed 2:1 width (for dense rows) */
  fit?: boolean
  route: Pick<RouteSummary, 'shortName' | 'routeId' | 'color' | 'textColor'> & { type?: RouteSummary['type'] }
  size?: 'sm' | 'lg'
}) {
  const s = SIZES[size]
  const label = route.shortName ?? route.routeId
  // Shrink long labels so they fit the 2s width
  const base = s * 0.58
  const fontSize = fit ? base : Math.min(base, (s * 1.75) / (label.length * 0.62))
  const style: CSSProperties = {
    backgroundColor: hex(route.color, '#000000'),
    color: hex(route.textColor, '#ffffff'),
    height: s,
    lineHeight: `${s}px`,
    width: fit ? undefined : s * 2,
    minWidth: fit ? s * 1.25 : undefined,
    paddingInline: fit ? s * 0.25 : undefined,
    borderRadius: (5 * s) / 24,
    fontSize,
    fontWeight: 700,
    letterSpacing: label.length > 3 ? '-0.02em' : undefined,
  }
  return (
    <span className="inline-flex shrink-0 items-center justify-center font-sans whitespace-nowrap tabular-nums" style={style}>
      {label}
    </span>
  )
}
