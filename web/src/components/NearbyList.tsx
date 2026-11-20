import { LocationIcon } from './Icons'
import { useNearbyStations } from '../lib/useNearbyStops'
import StationRow from './StationRow'

/** Nearby stops, or a clear message about why there are none. */
export default function NearbyList({ radius, limit }: { radius: number; limit?: number }) {
  const { location, query, stations } = useNearbyStations(radius)
  const shown = limit ? stations.slice(0, limit) : stations

  let message: React.ReactNode = null
  if (location.error)
    message = (
      <>
        {location.error}.
        <span className="mt-1 block text-[13px]">
          On iPhone, allow it in Settings → Privacy &amp; Security → Location Services → Safari Websites.
        </span>
      </>
    )
  else if (location.loading || !location.coords) message = 'Finding your location…'
  else if (query.isPending) message = 'Loading stops…'
  else if (query.isError)
    message = (
      <>
        Couldn't load stops.{' '}
        <button type="button" className="font-medium text-accent" onClick={() => query.refetch()}>
          Retry
        </button>
      </>
    )
  else if (shown.length === 0) message = `No stops within ${radius} m.`

  return (
    <div className="overflow-hidden rounded-2xl bg-surface">
      {/* Always-visible location control: asks for permission or refreshes the position */}
      <button
        type="button"
        onClick={location.request}
        className="flex w-full items-center gap-2 border-b border-separator px-4 py-2.5 text-left text-[15px] active:bg-fill"
      >
        <LocationIcon filled={!!location.coords} className={`h-5 w-5 text-accent ${location.loading ? 'animate-pulse' : ''}`} />
        <span className="flex-1 text-secondary">
          {location.loading ? 'Finding your location…' : location.coords ? 'Using your location' : 'Location off'}
        </span>
        <span className="font-medium text-accent">{location.coords ? 'Update' : 'Use my location'}</span>
      </button>
      {message ? (
        <p className="p-6 text-center text-secondary">{message}</p>
      ) : (
        <ul>
          {shown.map(({ station, distance }) => (
            <StationRow key={station.stationId} station={station} distance={distance} />
          ))}
        </ul>
      )}
    </div>
  )
}
