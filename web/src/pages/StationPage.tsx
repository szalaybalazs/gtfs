import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router'
import AfterFilter, { useAfter } from '../components/AfterFilter'
import Departures from '../components/Departures'
import MiniMap from '../components/MiniMap'
import NavBar from '../components/NavBar'
import RouteBadge from '../components/RouteBadge'
import Segmented from '../components/Segmented'
import StopRow from '../components/StopRow'
import { gql, STATION_QUERY, type StationDetails } from '../lib/api'
import { useDepartures } from '../lib/useDepartures'

/**
 * A stop group (e.g. Széll Kálmán tér): every line at the top, departures
 * from the platform you arrived at (or all of them), then each platform,
 * then a small map. `:stationId` may also be any platform's stop id.
 */
export default function StationPage() {
  const { stationId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const from = params.get('from')
  const scope = params.get('scope') === 'all' || !from ? 'all' : 'platform'

  const query = useQuery({
    queryKey: ['station', stationId],
    queryFn: () => gql<StationDetails>(STATION_QUERY, { id: stationId }),
    staleTime: 60 * 60_000,
  })
  const station = query.data?.station
  const platforms = (station?.stops ?? []).filter((s) => (s.routes ?? []).some(Boolean))
  const fromPlatform = platforms.find((s) => s.stopId === from) ?? station?.stops?.find((s) => s.stopId === from)

  const ids = scope === 'platform' && from ? [from] : platforms.map((s) => s.stopId)
  const [after] = useAfter()
  const departures = useDepartures(ids, { limit: 8, enabled: !!station, after })

  return (
    <div className="min-h-dvh">
      <NavBar back={{ label: 'Back' }} title={station?.name ?? (query.isPending ? '' : stationId)} />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        {query.isPending && <div className="h-32 animate-pulse rounded-2xl bg-surface" />}
        {query.isError && (
          <p className="p-6 text-center text-secondary">
            Couldn't load this stop.{' '}
            <button type="button" className="font-medium text-accent" onClick={() => query.refetch()}>
              Retry
            </button>
          </p>
        )}

        {station && (
          <>
            {station.routes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {station.routes.map((r) => (
                  <RouteBadge key={r.routeId} route={r} />
                ))}
              </div>
            )}

            <section className="space-y-2">
              {from && (
                <Segmented
                  label="Departures from"
                  value={scope}
                  onChange={(v) =>
                    setParams(
                      (p) => {
                        if (v === 'all') p.set('scope', 'all')
                        else p.delete('scope')
                        return p
                      },
                      { replace: true },
                    )
                  }
                  options={[
                    {
                      value: 'platform',
                      ariaLabel: 'Lines at the stop you came from',
                      label: (
                        <span className="flex flex-wrap justify-center gap-1">
                          {(fromPlatform?.routes ?? []).filter((r) => r != null).slice(0, 5).map((r) => (
                            <RouteBadge key={r.routeId} route={r} />
                          ))}
                        </span>
                      ),
                    },
                    { value: 'all', label: <span className="truncate">{station.name}</span> },
                  ]}
                />
              )}
              <Departures
                toolbar={<AfterFilter />}
                title={null}
                departures={departures.data?.departures ?? []}
                isPending={departures.isPending}
                error={departures.isError}
                onRetry={() => departures.refetch()}
              />
            </section>

            <section>
              <h2 className="px-1 pb-2 text-xl font-bold">Stops here</h2>
              <ul className="overflow-hidden rounded-2xl bg-surface">
                {platforms.map((stop) => (
                  <StopRow key={stop.stopId} stop={stop} highlighted={stop.stopId === from} />
                ))}
              </ul>
            </section>

            <section>
              <h2 className="px-1 pb-2 text-xl font-bold">Map</h2>
              <MiniMap
                area
                height={220}
                points={platforms
                  .filter((s) => s.lat != null && s.lon != null)
                  .map((s) => ({ lat: s.lat!, lon: s.lon!, strong: s.stopId === from }))}
              />
            </section>
          </>
        )}
      </main>
    </div>
  )
}
