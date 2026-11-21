import { useT } from '../lib/i18n'
import { LocationIcon } from './Icons'
import { useNearbyStations } from '../lib/useNearbyStops'
import { useNearbyRadius } from '../lib/nearbyRadius'
import StationRow from './StationRow'

/** Nearby stops, or a clear message about why there are none. */
export default function NearbyList({ limit }: { limit?: number }) {
  const [radius] = useNearbyRadius()
  const t = useT()
  const { location, query, stations } = useNearbyStations(radius)
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
          {/* Same rows as All stops: the group (opens its lines: pick a line, then a direction) with its platforms under it */}
          {shown.map(({ station, distance }) => (
            <StationRow key={station.stationId} station={station} distance={distance} />
          ))}
        </ul>
      )}
    </div>
  )
}
