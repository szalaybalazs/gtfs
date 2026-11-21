import { useT } from '../lib/i18n'
import { LocationIcon } from './Icons'
import { useNearbyStations } from '../lib/useNearbyStops'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { formatDistance } from '../lib/geo'
import { useNearbyRadius } from '../lib/nearbyRadius'
import { prefetchStation } from '../lib/prefetch'
import { ChevronIcon } from './Icons'
import RouteBadge from './RouteBadge'

/** Nearby stops, or a clear message about why there are none. */
export default function NearbyList({ limit }: { limit?: number }) {
  const [radius] = useNearbyRadius()
  const t = useT()
  const { location, query, stations } = useNearbyStations(radius)
  const qc = useQueryClient()
  const shown = limit ? stations.slice(0, limit) : stations

  let message: React.ReactNode = null
  if (location.error)
    message = (
      <>
        {location.error}.
        {location.denied ? (
          <span className="mt-1 block text-[13px]">{t('nearby.iphoneHint')}</span>
        ) : (
          <span className="mt-1 block text-[13px]">{t('nearby.tryAgain')}</span>
        )}
      </>
    )
  else if (location.loading || !location.coords) message = t('nearby.finding')
  else if (query.isPending) message = t('nearby.loadingStops')
  else if (query.isError)
    message = (
      <>
        {t('nearby.loadError')}{' '}
        <button type="button" className="font-medium text-accent" onClick={() => query.refetch()}>
          {t('common.retry')}
        </button>
      </>
    )
  else if (shown.length === 0) message = t('nearby.none', { n: radius })

  return (
    <div className="overflow-hidden rounded-2xl bg-surface">
      {/* Always-visible location control: asks for permission or refreshes the position */}
      <button
        type="button"
        onClick={location.request}
        className="flex w-full items-center gap-2 border-b border-separator px-gutter py-2.5 text-left text-[15px] active:bg-fill"
      >
        <LocationIcon filled={!!location.coords} className={`h-5 w-5 text-accent ${location.loading ? 'animate-pulse' : ''}`} />
        <span className="flex-1 text-secondary">
          {location.loading ? t('nearby.finding') : location.coords ? t('nearby.using') : t('nearby.off')}
        </span>
        <span className="font-medium text-accent">{location.coords ? t('nearby.update') : t('nearby.useMyLocation')}</span>
      </button>
      {message ? (
        <p className="p-6 text-center text-secondary">{message}</p>
      ) : (
        <ul>
          {/* One row per stop (the whole group), not per platform: tap it to pick a line */}
          {shown.map(({ station, distance }) => (
            <li key={station.stationId} className="border-b border-separator last:border-b-0">
              <Link
                to={`/stations/${encodeURIComponent(station.stationId)}/lines`}
                onPointerDown={() => void prefetchStation(qc, station.stationId)}
                className="flex items-center gap-3 px-gutter py-row active:bg-fill"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] font-semibold">
                    {station.name}
                    <span className="ml-2 font-normal text-secondary">{formatDistance(distance)}</span>
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {station.routes.filter(Boolean).map((r) => (
                      <RouteBadge key={r.routeId} route={r} />
                    ))}
                  </div>
                </div>
                <ChevronIcon className="h-4 w-4 shrink-0 text-secondary/60" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
