import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import Departures from '../components/Departures'
import { LocationIcon } from '../components/Icons'
import NavBar from '../components/NavBar'
import { gql, NEARBY_STATIONS_QUERY, type NearbyStations } from '../lib/api'
import { distance } from '../lib/geo'
import { useT } from '../lib/i18n'
import { useDepartures } from '../lib/useDepartures'
import { useGeolocation } from '../lib/useGeolocation'

/** Platforms this close count as "here". */
const HERE_M = 200

/**
 * Nearby tab: by GPS alone, the platforms right around you and what leaves from them next, soonest first
 * (line badge, destination, time to go). No choosing a stop first.
 */
export default function NearbyDeparturesPage() {
  const t = useT()
  const location = useGeolocation(true)
  const here = location.coords
  const stations = useQuery({
    queryKey: ['hereStations', here && [Math.round(here.lat * 2000), Math.round(here.lon * 2000)]],
    queryFn: () => gql<NearbyStations>(NEARBY_STATIONS_QUERY, { ...here!, radius: HERE_M + 100 }),
    enabled: !!here,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  })
  const stopIds = useMemo(() => {
    if (!here) return []
    return (stations.data?.stationsByRadius ?? [])
      .flatMap((s) => s.stops ?? [])
      .filter((p) => p.lat != null && p.lon != null && (p.routes ?? []).some(Boolean) && distance(here, { lat: p.lat, lon: p.lon }) <= HERE_M)
      .map((p) => p.stopId)
  }, [stations.data, here])
  const departures = useDepartures(stopIds, { limit: 40 })

  const pin = (
    <button type="button" onClick={location.request} aria-label={t('nearby.update')} className="-m-1.5 rounded-full p-1.5 text-accent active:bg-fill">
      <LocationIcon filled={!!here} className={`h-5 w-5 ${location.loading ? 'animate-pulse' : ''}`} />
    </button>
  )
  const message = location.error ? location.error : !here ? t('nearby.finding') : stations.isSuccess && stopIds.length === 0 ? t('nearbyDep.none', { n: HERE_M }) : null

  return (
    <div className="min-h-dvh">
      <NavBar title={t('tab.nearby')} menu />
      <main className="mx-auto max-w-2xl px-gutter pt-gutter pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <div className="flex items-center gap-2 px-1 pb-2">
          <h2 className="text-xl font-bold">{t('nearbyDep.title')}</h2>
          {pin}
        </div>
        {message ? (
          <p className="rounded-2xl bg-surface p-gutter text-secondary">{message}</p>
        ) : (
          <Departures departures={departures.data?.departures ?? []} isPending={departures.isPending || stations.isPending} error={departures.isError} onRetry={() => departures.refetch()} show={20} />
        )}
      </main>
    </div>
  )
}
