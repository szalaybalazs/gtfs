import { Link } from 'react-router'
import type { StopSummary } from '../lib/api'
import { formatDistance } from '../lib/geo'
import { ChevronIcon } from './Icons'
import RouteBadge from './RouteBadge'

/** One stop in a list: name, optional distance, and the routes that serve it. */
export default function StopRow({
  stop,
  distance,
  highlighted,
  onSelect,
}: {
  stop: StopSummary & { headsigns?: string[] }
  distance?: number
  highlighted?: boolean
  /** Make the row a selector instead of a link */
  onSelect?: () => void
}) {
  const routes = (stop.routes ?? []).filter((r) => r != null)
  return (
    <li className="border-b border-separator last:border-b-0">
      {onSelect ? (
        <button type="button" onClick={onSelect} aria-pressed={highlighted} className={`flex w-full items-center gap-3 px-4 py-3 text-left active:bg-fill ${highlighted ? 'bg-fill' : ''}`}>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold">
            {stop.name ?? stop.stopId}
            {stop.code && stop.code !== stop.stopId && <span className="ml-2 text-[13px] font-normal text-secondary">#{stop.code}</span>}
            {distance != null && <span className="ml-2 font-normal text-secondary">{formatDistance(distance)}</span>}
          </p>
          {stop.headsigns && stop.headsigns.length > 0 && (
            <p className="truncate text-[15px] text-secondary">towards {stop.headsigns.join(' / ')}</p>
          )}
          {routes.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {routes.map((route) => (
                <RouteBadge key={route.routeId} route={route} />
              ))}
            </div>
          )}
        </div>
        <ChevronIcon className="h-4 w-4 shrink-0 text-secondary/60" />
      </button>
      ) : (
        <Link to={`/stops/${encodeURIComponent(stop.stopId)}`} className={`flex w-full items-center gap-3 px-4 py-3 text-left active:bg-fill ${highlighted ? 'bg-fill' : ''}`}>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold">
            {stop.name ?? stop.stopId}
            {stop.code && stop.code !== stop.stopId && <span className="ml-2 text-[13px] font-normal text-secondary">#{stop.code}</span>}
            {distance != null && <span className="ml-2 font-normal text-secondary">{formatDistance(distance)}</span>}
          </p>
          {stop.headsigns && stop.headsigns.length > 0 && (
            <p className="truncate text-[15px] text-secondary">towards {stop.headsigns.join(' / ')}</p>
          )}
          {routes.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {routes.map((route) => (
                <RouteBadge key={route.routeId} route={route} />
              ))}
            </div>
          )}
        </div>
        <ChevronIcon className="h-4 w-4 shrink-0 text-secondary/60" />
      </Link>
      )}
    </li>
  )
}
