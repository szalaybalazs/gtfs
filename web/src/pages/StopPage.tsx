import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import FavoriteSheet from '../components/FavoriteSheet'
import { StarIcon } from '../components/Icons'
import { favoriteId, useFavorites, type FavoriteDraft } from '../lib/favorites'
import { Link, useParams, useSearchParams } from 'react-router'
import AfterFilter, { TimeControl, useAfter } from '../components/AfterFilter'
import Alerts from '../components/Alerts'
import Departures from '../components/Departures'
import { ChevronIcon } from '../components/Icons'
import NavBar from '../components/NavBar'
import StopInfoCard from '../components/StopInfoCard'
import Timetable from '../components/Timetable'
import ViewToggle, { useView } from '../components/ViewToggle'
import { gql, STOP_QUERY, type StopDetails } from '../lib/api'
import { recordVisit } from '../lib/usage'
import { useDepartures } from '../lib/useDepartures'

/** One platform: its lines, then departures or the combined timetable. */
export default function StopPage() {
  const { stopId = '' } = useParams()
  const [view] = useView()

  const query = useQuery({
    queryKey: ['stop', stopId],
    queryFn: () => gql<StopDetails>(STOP_QUERY, { stopId }),
    staleTime: 60 * 60_000,
  })
  const stop = query.data?.stop
  // Visits count towards the stop's group, which is what search lists
  useEffect(() => recordVisit(`station:${stopId}`), [stopId])
  const routes = (stop?.routes ?? []).filter((r) => r != null)
  const { after } = useAfter()
  const arrivedOn = useSearchParams()[0].get('trip')
  const { has } = useFavorites()
  const [sheet, setSheet] = useState(false)
  const favoriteOptions: FavoriteDraft[] = stop
    ? [
        {
          kind: 'stop' as const,
          stopId: stop.stopId,
          stationId: stopId,
          name: stop.name ?? stop.stopId,
          headsigns: stop.headsigns ?? [],
          routes: (stop.routes ?? []).filter((r) => r != null),
        },
        ...(stop.routes ?? []).filter((r) => r != null).map((route) => ({
          kind: 'lineStop' as const,
          route,
          stopId: stop.stopId,
          stationId: stopId,
          stopName: stop.name ?? stop.stopId,
          headsign: null,
        })),
      ]
    : []
  const favorite = favoriteOptions.some((o) => has(favoriteId(o)))

  const departures = useDepartures([stopId], { limit: 20, after })

  return (
    <div className="min-h-dvh">
      <NavBar
        back={{ label: 'Back' }}
        trailing={
          favoriteOptions.length > 0 && (
            <>
              <TimeControl />
              <ViewToggle />
              <button
              type="button"
              onClick={() => setSheet(true)}
              aria-label="Favourites"
              className={`rounded-md p-2 active:opacity-50 ${favorite ? 'text-accent' : 'text-label'}`}
            >
              <StarIcon filled={favorite} className="h-6 w-6" />
              </button>
            </>
          )
        }
      />
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
              <StopInfoCard
                id={stop.code && stop.code !== stop.stopId ? stop.code : stop.stopId}
                name={stop.name ?? stopId}
                headsigns={stop.headsigns}
                routes={routes}
              />
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

            <Alerts routeIds={routes.map((r) => r.routeId)} stopIds={[stopId]} />

            {routes.length === 0 ? (
              <p className="p-6 text-center text-secondary">No lines stop here.</p>
            ) : (
              <>
                {view === 'departures' ? (
                  <Departures
                    toolbar={<AfterFilter />}
                includePast={!!after}
                highlightTrip={arrivedOn}
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
      {sheet && <FavoriteSheet options={favoriteOptions} onClose={() => setSheet(false)} />}
    </div>
  )
}
