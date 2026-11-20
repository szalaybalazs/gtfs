import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'
import Departures from '../components/Departures'
import NavBar from '../components/NavBar'
import RouteBadge from '../components/RouteBadge'
import { gql, STOP_QUERY, type StopDetails } from '../lib/api'

/** One stop: the next departures of every route that serves it. */
export default function StopPage() {
  const { stopId = '' } = useParams()
  const navigate = useNavigate()
  const query = useQuery({
    queryKey: ['stop', stopId],
    queryFn: () => gql<StopDetails>(STOP_QUERY, { stopId }),
    staleTime: 60 * 60_000,
  })
  const stop = query.data?.stop
  const routes = (stop?.routes ?? []).filter((r) => r != null)

  return (
    <div className="min-h-dvh">
      <NavBar back={{ to: '/nearby', label: 'Stops' }} title={stop?.name ?? (query.isPending ? '' : stopId)} />
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
        {stop && routes.length === 0 && <p className="p-6 text-center text-secondary">No routes stop here.</p>}
        {routes.map((route) => (
          <Departures
            key={route.routeId}
            routeId={route.routeId}
            stopId={stopId}
            count={3}
            title={
              <button
                type="button"
                onClick={() => navigate(`/routes/${encodeURIComponent(route.routeId)}?stop=${encodeURIComponent(stopId)}`)}
                className="active:opacity-70"
              >
                <RouteBadge route={route} size="lg" />
              </button>
            }
          />
        ))}
      </main>
    </div>
  )
}
