import { Link } from 'react-router'
import type { RouteSummary } from '../lib/api'
import { hex } from '../lib/geo'

type TileRoute = Pick<RouteSummary, 'routeId' | 'shortName' | 'color' | 'textColor'> &
  Partial<Pick<RouteSummary, 'desc' | 'longName'>>

/** Big coloured line button with BKK badge proportions. `compact`: smaller, for favourites. */
export default function RouteTile({ route, compact }: { route: TileRoute; compact?: boolean }) {
  return (
    <Link
      to={`/routes/${encodeURIComponent(route.routeId)}`}
      title={route.desc ?? route.longName ?? undefined}
      // Same proportions as the badge (2:1, 5/24 radius), just larger
      className={`flex aspect-[2/1] items-center justify-center rounded-[10px] px-1 text-lg font-bold active:opacity-70 ${
        compact ? 'h-10' : 'w-full'
      }`}
      style={{ backgroundColor: hex(route.color, '#000000'), color: hex(route.textColor, '#ffffff') }}
    >
      <span className="truncate">{route.shortName ?? route.routeId}</span>
    </Link>
  )
}
