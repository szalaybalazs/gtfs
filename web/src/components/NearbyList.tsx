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
        {location.error}.{' '}
        <button type="button" className="font-medium text-accent" onClick={location.request}>
          Try again
        </button>
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
