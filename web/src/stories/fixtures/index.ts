import type { Alert, Departures, NearbyStations, RouteDetails, RoutesPage, StationDetails, StopDetails, TripDetails, TripPath } from '../../lib/api'
import alertsRaw from './alerts.json'
import boardRaw from './departures-board.json'
import stopDeparturesRaw from './departures-stop.json'
import timeRaw from './departures-time.json'
import nearbyRaw from './nearby.json'
import routeRaw from './route.json'
import routesRaw from './routes.json'
import stationRaw from './station.json'
import stopRaw from './stop.json'
import tripPathRaw from './trip-path.json'
import tripRaw from './trip.json'

/**
 * Real data captured once from the API (Kelenföld vasútállomás, 007896), kept as JSON.
 * Times are made relative at render: `fresh()` shifts every timestamp so the first
 * departure is ~2 min from now.
 */
export const STATION_ID = '007896'
export const STOP_ID = '061277'
export const HERE = { lat: 47.4897, lon: 19.0623 }
export const NEARBY_RADIUS = 1000

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
/** Deep copy with every ISO timestamp moved by `delta` ms. */
export function shift<T>(data: T, delta: number): T {
  return JSON.parse(JSON.stringify(data), (_k, v) => (typeof v === 'string' && ISO.test(v) ? new Date(Date.parse(v) + delta).toISOString() : v))
}

const firstDeparture = (d: { departure: string }[]) => Math.min(...d.map((x) => Date.parse(x.departure)))
const ALERTS_MADE = Date.parse('2026-11-21T14:38:45Z')

export function fresh() {
  const now = Date.now()
  const board = boardRaw as unknown as Departures
  const boardDelta = now + 2 * 60_000 - firstDeparture(board.departures)
  const stopDeps = stopDeparturesRaw as unknown as Departures
  const trip = tripRaw as unknown as TripDetails
  // Trip: the vehicle is about to leave its 9th stop
  const tripDelta = now + 2 * 60_000 - Date.parse(trip.trip!.stops[8].departure)
  return {
    station: stationRaw as unknown as StationDetails,
    board: shift(board, boardDelta),
    time: shift(timeRaw as unknown as Departures, boardDelta),
    stop: stopRaw as unknown as StopDetails,
    stopDepartures: shift(stopDeps, now + 2 * 60_000 - firstDeparture(stopDeps.departures)),
    routes: routesRaw as unknown as RoutesPage,
    route: routeRaw as unknown as RouteDetails,
    trip: shift(trip, tripDelta),
    tripPath: tripPathRaw as unknown as TripPath,
    alerts: shift(alertsRaw as unknown as { alerts: Alert[] }, now - ALERTS_MADE),
    nearby: nearbyRaw as unknown as NearbyStations,
  }
}
export type Fixtures = ReturnType<typeof fresh>
