import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect } from 'react'
import AlertsPage from '../pages/AlertsPage'
import HomePage from '../pages/HomePage'
import NearbyPage from '../pages/NearbyPage'
import RoutesPage from '../pages/RoutesPage'
import StationPage from '../pages/StationPage'
import StopPage from '../pages/StopPage'
import TripPage from '../pages/TripPage'
import { useFavorites } from '../lib/favorites'
import { fresh, STATION_ID, STOP_ID } from './fixtures'
import { alertRouteIds, Page, seeds } from './harness'

const meta: Meta = { title: 'Pages', parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj

/** Real favourites for the Home story (a stop and two lines), added once on mount. */
function FavouritesSeed() {
  const { toggle, has } = useFavorites()
  useEffect(() => {
    const s = fresh().stop.stop!
    const routes = (s.routes ?? []).filter((r) => r != null)
    if (!has(`stop:${s.stopId}`)) toggle({ kind: 'stop', stopId: s.stopId, stationId: STATION_ID, name: s.name ?? '', headsigns: s.headsigns ?? [], routes })
    for (const route of routes.slice(0, 2)) if (!has(`line:${route.routeId}`)) toggle({ kind: 'line', route })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

export const Home: Story = {
  render: () => (
    <>
      <FavouritesSeed />
      <Page
        path="/"
        entry="/"
        element={<HomePage />}
        seed={(qc, f) => {
          seeds.nearby(qc, f)
          seeds.stop(qc, f)
          // Favourite cards ask for their own departures (limit 8 per line, 40 per stop)
          qc.setQueryData(['departures', [STOP_ID], null, 40, null, false, null], f.stopDepartures)
        }}
      />
    </>
  ),
}

export const Routes: Story = { render: () => <Page path="/routes" entry="/routes" element={<RoutesPage />} seed={seeds.routes} /> }

export const StationBoard: Story = {
  name: 'Station (board)',
  render: () => <Page path="/stations/:stationId" entry={`/stations/${STATION_ID}`} element={<StationPage />} seed={seeds.station('board')} />,
}

export const StationTimeOrder: Story = {
  name: 'Station (?view=time)',
  render: () => <Page path="/stations/:stationId" entry={`/stations/${STATION_ID}?view=time`} element={<StationPage />} seed={seeds.station('time')} />,
}

export const Stop: Story = {
  render: () => <Page path="/stops/:stopId" entry={`/stops/${STOP_ID}`} element={<StopPage />} seed={seeds.stop} />,
}

export const Trip: Story = {
  render: () => {
    const id = fresh().trip.trip!.tripId
    return <Page path="/trips/:tripId" entry={`/trips/${encodeURIComponent(id)}`} element={<TripPage />} seed={seeds.trip} />
  },
}

export const Alerts: Story = {
  render: () => <Page path="/alerts" entry={`/alerts?routes=${alertRouteIds().join(',')}`} element={<AlertsPage />} seed={seeds.alerts} />,
}

export const Nearby: Story = {
  render: () => <Page path="/nearby" entry="/nearby" element={<NearbyPage />} seed={seeds.nearby} />,
}
