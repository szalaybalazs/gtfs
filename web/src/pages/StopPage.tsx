import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router'
import AfterFilter, { useAfter } from '../components/AfterFilter'
import Departures from '../components/Departures'
import { ChevronIcon } from '../components/Icons'
import NavBar from '../components/NavBar'
import RouteBadge from '../components/RouteBadge'
import Segmented from '../components/Segmented'
import Timetable from '../components/Timetable'
import { gql, STOP_QUERY, type StopDetails } from '../lib/api'
import { useDepartures } from '../lib/useDepartures'

/** One platform: its lines, then departures or the combined timetable. */
export default function StopPage() {
  const { stopId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'timetable' ? 'timetable' : 'departures'

  const query = useQuery({
    queryKey: ['stop', stopId],
    queryFn: () => gql<StopDetails>(STOP_QUERY, { stopId }),
    staleTime: 60 * 60_000,
  })
  const stop = query.data?.stop
  const routes = (stop?.routes ?? []).filter((r) => r != null)
  const [after] = useAfter()
  const departures = useDepartures([stopId], { limit: 20, after })

  return (
    <div className="min-h-dvh">
      <NavBar back={{ label: 'Back' }} title={stop?.name ?? (query.isPending ? '' : stopId)} />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        {query.isPending && <div className="h-24 animate-pulse rounded-2xl bg-surface" />}
        {query.isError && (
          <p className="p-6 text-center text-secondary">
            Couldn't load this stop.{' '}
            <button type="button" className="font-medium text-accent" onClick={() => query.refetch()}>
              Retry
            </button>
          </p>
        )}

        {stop && (
          <>
            <div className="space-y-3">
              {routes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {routes.map((r) => (
                    <Link key={r.routeId} to={`/routes/${encodeURIComponent(r.routeId)}?stop=${encodeURIComponent(stopId)}`}>
                      <RouteBadge route={r} />
                    </Link>
                  ))}
                </div>
              )}
              <Link
                to={`/stations/${encodeURIComponent(stopId)}?from=${encodeURIComponent(stopId)}`}
                className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 active:bg-fill"
              >
                <span>
                  <span className="text-secondary">Everything at </span>
                  <span className="font-medium">{stop.name}</span>
                </span>
                <ChevronIcon className="h-4 w-4 text-secondary/60" />
              </Link>
            </div>

            {routes.length === 0 ? (
              <p className="p-6 text-center text-secondary">No lines stop here.</p>
            ) : (
              <>
                <Segmented
                  label="View"
                  value={view}
                  onChange={(v) =>
                    setParams(
                      (p) => {
                        if (v === 'timetable') p.set('view', v)
                        else p.delete('view')
                        return p
                      },
                      { replace: true },
                    )
                  }
                  options={[
                    { value: 'departures', label: 'Departures' },
                    { value: 'timetable', label: 'Timetable' },
                  ]}
                />
                {view === 'departures' ? (
                  <Departures
                    toolbar={<AfterFilter />}
                    title={null}
                    departures={departures.data?.departures ?? []}
                    isPending={departures.isPending}
                    error={departures.isError}
                    onRetry={() => departures.refetch()}
                  />
                ) : (
                  <Timetable lines={routes.map((route) => ({ route, stopId }))} />
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
