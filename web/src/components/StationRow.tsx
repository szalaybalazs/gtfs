import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { prefetchStation } from '../lib/prefetch'
import type { Station } from '../lib/api'
import { formatDistance } from '../lib/geo'
import { useT } from '../lib/i18n'
import { ChevronIcon } from './Icons'
import RouteBadge from './RouteBadge'

/**
 * A stop group as list rows: one row per stop that something departs from
 * (usually one per direction), each reading "towards …" with its lines.
 */
export default function StationRow({ station, distance }: { station: Station; distance?: number }) {
  const qc = useQueryClient()
  const t = useT()
  const stops = (station.stops ?? []).filter((s) => (s.routes ?? []).some(Boolean) && (s.headsigns ?? []).length > 0)
  if (stops.length === 0) return null
  return (
    <>
      {stops.map((stop) => (
        <li key={stop.stopId} className="border-b border-separator last:border-b-0">
          <Link
            to={`/stations/${encodeURIComponent(station.stationId)}?from=${encodeURIComponent(stop.stopId)}`}
            // Start loading the stop group as the finger goes down
            onPointerDown={() => void prefetchStation(qc, station.stationId)}
            className="flex items-center gap-3 px-4 py-3 active:bg-fill"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-semibold">
                {station.name}
                {distance != null && <span className="ml-2 font-normal text-secondary">{formatDistance(distance)}</span>}
              </p>
              <p className="truncate text-[15px] text-secondary">{t('common.towards', { to: stop.headsigns!.join(' / ') })}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {(stop.routes ?? []).filter((r) => r != null).map((route) => (
                  <RouteBadge key={route.routeId} route={route} />
                ))}
              </div>
            </div>
            <ChevronIcon className="h-4 w-4 shrink-0 text-secondary/60" />
          </Link>
        </li>
      ))}
    </>
  )
}
