import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { prefetchStation } from '../lib/prefetch'
import type { Station } from '../lib/api'
import { formatDistance } from '../lib/geo'
import { useT } from '../lib/i18n'
import { ChevronIcon } from './Icons'
import RouteBadge from './RouteBadge'
import CategoryIcon from './CategoryIcon'
import { CATEGORIES, categoryOf } from '../lib/categories'

/**
 * A stop group in a list: the group itself (all its lines; opens the whole
 * group's departures), with its platforms indented under it (each "towards …"
 * with its lines; opens that platform).
 */
export default function StationRow({ station, distance }: { station: Station; distance?: number }) {
  const qc = useQueryClient()
  const t = useT()
  const stops = (station.stops ?? []).filter((s) => (s.routes ?? []).some(Boolean))
  if (stops.length === 0) return null
  const prefetch = () => void prefetchStation(qc, station.stationId)
  const platforms = stops.length > 1
  return (
    <li className="border-b border-separator last:border-b-0">
      <Link to={`/stations/${encodeURIComponent(station.stationId)}`} onPointerDown={prefetch} className="flex items-center gap-3 px-4 py-3 active:bg-fill">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold">
            {station.name}
            {distance != null && <span className="ml-2 font-normal text-secondary">{formatDistance(distance)}</span>}
          </p>
          {platforms ? (
            // The lines are listed once, per platform below; the group shows which kinds run here, like the menu
            <div className="mt-1 flex items-center gap-1.5">
              {CATEGORIES.filter((c) => station.routes.some((r) => r && categoryOf(r).key === c.key)).map((c) => (
                <CategoryIcon key={c.key} category={c} className="h-5 w-5" />
              ))}
              <span className="ml-0.5 text-[13px] text-secondary">{t('stations.summary', { dirs: stops.length, lines: station.routes.filter(Boolean).length })}</span>
            </div>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {station.routes.filter(Boolean).map((route) => (
                <RouteBadge key={route.routeId} route={route} />
              ))}
            </div>
          )}
        </div>
        <ChevronIcon className="h-4 w-4 shrink-0 text-secondary/60" />
      </Link>
      {/* Platforms in a tinted block under the group (the background groups them, no indent or tree lines) */}
      {platforms && (
        <ul className="mx-3 mb-3 divide-y divide-separator overflow-hidden rounded-xl bg-fill/60">
          {stops.map((stop) => (
            <li key={stop.stopId}>
              <Link
                to={`/stations/${encodeURIComponent(station.stationId)}?from=${encodeURIComponent(stop.stopId)}`}
                onPointerDown={prefetch}
                className="flex items-center gap-3 px-3 py-2.5 active:bg-fill"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">
                    {(stop.headsigns ?? []).length > 0 ? t('common.towards', { to: stop.headsigns!.join(' / ') }) : t('stop.terminus')}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(stop.routes ?? []).filter((r) => r != null).map((route) => (
                      <RouteBadge key={route.routeId} route={route} />
                    ))}
                  </div>
                </div>
                <ChevronIcon className="h-3.5 w-3.5 shrink-0 text-secondary/50" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
