import { useRef } from 'react'
import { Link } from 'react-router'
import type { RouteSummary } from '../lib/api'
import { hex } from '../lib/geo'

type TileRoute = Pick<RouteSummary, 'routeId' | 'shortName' | 'color' | 'textColor'> &
  Partial<Pick<RouteSummary, 'desc' | 'longName'>>

const LONG_PRESS_MS = 450

/**
 * Big coloured line button with BKK badge proportions. `compact`: smaller, for favourites.
 * With `onSelect`: long-press selects the line; while `selecting`, a tap toggles it instead of opening it.
 */
export default function RouteTile({
  route,
  compact,
  selected,
  selecting,
  onSelect,
}: {
  route: TileRoute
  compact?: boolean
  selected?: boolean
  selecting?: boolean
  onSelect?: () => void
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const pressed = useRef(false)
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  return (
    <Link
      to={`/routes/${encodeURIComponent(route.routeId)}`}
      title={route.desc ?? route.longName ?? undefined}
      aria-pressed={selecting ? !!selected : undefined}
      onPointerDown={(e) => {
        if (!onSelect) return
        pressed.current = false
        start.current = { x: e.clientX, y: e.clientY }
        cancel()
        timer.current = setTimeout(() => {
          pressed.current = true
          navigator.vibrate?.(15)
          onSelect()
        }, LONG_PRESS_MS)
      }}
      onPointerMove={(e) => {
        // A scroll is not a long-press
        if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) cancel()
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onContextMenu={(e) => onSelect && e.preventDefault()}
      onClick={(e) => {
        if (pressed.current) {
          // The long-press already selected it
          e.preventDefault()
          pressed.current = false
        } else if (selecting && onSelect) {
          e.preventDefault()
          onSelect()
        }
      }}
      // Same proportions as the badge (2:1, 5/24 radius), just larger
      className={`relative flex aspect-[2/1] items-center justify-center rounded-[10px] px-1 text-lg font-bold select-none [-webkit-touch-callout:none] active:opacity-70 ${
        compact ? 'h-10' : 'w-full'
      } ${selected ? 'ring-[3px] ring-accent ring-offset-2 ring-offset-canvas' : ''} ${selecting && !selected ? 'opacity-60' : ''}`}
      style={{ backgroundColor: hex(route.color, '#000000'), color: hex(route.textColor, '#ffffff') }}
    >
      <span className="truncate">{route.shortName ?? route.routeId}</span>
      {selected && (
        <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] text-white ring-2 ring-canvas">
          ✓
        </span>
      )}
    </Link>
  )
}
