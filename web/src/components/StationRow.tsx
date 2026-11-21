import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { prefetchStation } from '../lib/prefetch'
import type { Station } from '../lib/api'
import { formatDistance } from '../lib/geo'
import { useT } from '../lib/i18n'
import { ChevronIcon } from './Icons'
import RouteBadge from './RouteBadge'

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
            // The lines are listed once, per direction below; the group just says how much is here
            <p className="text-[13px] text-secondary">{t('stations.summary', { dirs: stops.length, lines: station.routes.filter(Boolean).length })}</p>
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
      {/* Platforms as branches off the group: a trunk line, a short branch to each, a divider between them */}
      {platforms && (
        <ul className="pb-2 pl-7">
          {stops.map((stop, i) => (
            <li key={stop.stopId} className="relative">
              {/* trunk (stops halfway down the last one) + branch */}
              <span aria-hidden className={`absolute left-0 w-0.5 bg-separator ${i === stops.length - 1 ? 'top-0 h-1/2' : 'inset-y-0'}`} />
              <span aria-hidden className="absolute top-1/2 left-0 h-0.5 w-3 bg-separator" />
              <Link
                to={`/stations/${encodeURIComponent(station.stationId)}?from=${encodeURIComponent(stop.stopId)}`}
                onPointerDown={prefetch}
                className={`ml-5 flex items-center gap-3 py-2.5 pr-4 active:bg-fill ${i > 0 ? 'border-t border-separator' : ''}`}
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
