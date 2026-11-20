import { Link } from 'react-router'
import type { RouteSummary } from '../lib/api'
import { hex } from '../lib/geo'

type TileRoute = Pick<RouteSummary, 'routeId' | 'shortName' | 'color' | 'textColor'> &
  Partial<Pick<RouteSummary, 'desc' | 'longName'>>

/** Big coloured route button, square or round. */
export default function RouteTile({ route, round }: { route: TileRoute; round?: boolean }) {
  return (
    <Link
      to={`/routes/${encodeURIComponent(route.routeId)}`}
      title={route.desc ?? route.longName ?? undefined}
      className={`flex h-14 items-center justify-center px-1 text-lg font-bold active:opacity-70 ${
        round ? 'w-14 rounded-full' : 'w-full rounded-2xl'
      }`}
      style={{ backgroundColor: hex(route.color, '#000000'), color: hex(route.textColor, '#ffffff') }}
    >
      <span className="truncate">{route.shortName ?? route.routeId}</span>
    </Link>
  )
}
