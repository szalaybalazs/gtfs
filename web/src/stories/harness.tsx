import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import Layout from '../components/Layout'
import { stationKey, tripKey } from '../lib/prefetch'
import { fresh, HERE, NEARBY_RADIUS, STATION_ID, STOP_ID, type Fixtures } from './fixtures'

type Seed = (qc: QueryClient, f: Fixtures) => void

export function makeClient(seed?: Seed) {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, refetchOnWindowFocus: false } } })
  seed?.(qc, fresh())
  return qc
}

/** The app's providers around any story: query cache (seeded), router, 375px phone frame by default. */
export function Providers({ children, seed, entry = '/' }: { children: ReactNode; seed?: Seed; entry?: string }) {
  const [qc] = useState(() => makeClient(seed))
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

/** A real page in the real app shell (Layout + route), at `entry`. */
export function Page({ path, entry, element, seed }: { path: string; entry: string; element: ReactNode; seed?: Seed }) {
  return (
    <Providers entry={entry} seed={seed}>
      <Routes>
        <Route element={<Layout />}>
          <Route path={path} element={element} />
        </Route>
      </Routes>
    </Providers>
  )
}

const platformIds = (f: Fixtures) =>
  (f.station.station!.stops ?? []).filter((s) => (s.routes ?? []).some(Boolean)).map((s) => s.stopId).sort()

/** ['departures', ids, routeIds, limit, after, arrivals, perLine] as useDepartures builds it */
const depKey = (ids: string[], limit: number, perLine: number | null, arrivals = false) =>
  ['departures', ids, null, limit, null, arrivals, perLine] as const

export const seeds = {
  station: (view: 'board' | 'time'): Seed => (qc, f) => {
    qc.setQueryData(stationKey(STATION_ID), f.station)
    qc.setQueryData(['station', STATION_ID], f.station)
    const ids = platformIds(f)
    if (view === 'board') qc.setQueryData(depKey(ids, 300, 4), f.board)
    // limit steps with useSteadyLimit: 25, 30, 35, 40
    else for (const l of [25, 30, 35, 40]) qc.setQueryData(depKey(ids, l, null), f.time)
  },
  stop: ((qc, f) => {
    qc.setQueryData(['stop', STOP_ID], f.stop)
    for (const l of [15, 20]) qc.setQueryData(depKey([STOP_ID], l, null), f.stopDepartures)
  }) as Seed,
  trip: ((qc, f) => {
    qc.setQueryData(tripKey(f.trip.trip!.tripId, undefined), f.trip)
    qc.setQueryData(['tripPath', f.trip.trip!.tripId, undefined], f.tripPath)
  }) as Seed,
  routes: ((qc, f) => qc.setQueryData(['routes', 'all'], f.routes)) as Seed,
  nearby: ((qc, f) => qc.setQueryData(['nearbyStations', HERE, NEARBY_RADIUS], f.nearby)) as Seed,
  alerts: ((qc, f) => {
    for (const lang of ['en', 'hu']) qc.setQueryData(['alerts', { routeIds: alertRouteIds(), stopIds: [] }, lang], f.alerts)
  }) as Seed,
}

export const alertRouteIds = () => [...new Set(fresh().alerts.alerts.flatMap((a) => a.routes.map((r) => r.routeId)))].sort()
