import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import FavoriteSheet from '../components/FavoriteSheet'
import { StarIcon } from '../components/Icons'
import { favoriteId, useFavorites, type FavoriteDraft } from '../lib/favorites'
import { Link, useParams, useSearchParams } from 'react-router'
import AfterFilter, { useAfter } from '../components/AfterFilter'
import Alerts from '../components/Alerts'
import Departures, { MoreButton } from '../components/Departures'
import { ChevronIcon } from '../components/Icons'
import NavBar from '../components/NavBar'
import StopInfoCard from '../components/StopInfoCard'
import Timetable from '../components/Timetable'
import ViewToggle, { useView } from '../components/ViewToggle'
import { gql, STOP_QUERY, type StopDetails } from '../lib/api'
import { recordVisit } from '../lib/usage'
import { useDepartures, useSteadyLimit } from '../lib/useDepartures'
import type { Departure } from '../lib/api'
import { useT } from '../lib/i18n'
import { towardsOf } from '../lib/favorites'

/** One platform: its lines, then departures or the combined timetable. */
export default function StopPage() {
  const t = useT()
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
  const { after, picked } = useAfter()
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
          headsign: towardsOf(stop.headsigns),
        })),
      ]
    : []
  const favorite = favoriteOptions.some((o) => has(favoriteId(o)))

  const [more, setMore] = useState(0)
  // One stop: show 10, fetch just enough spare (see useSteadyLimit)
  const limit = 10 + more * 20
  const [fetched, setFetched] = useState<Departure[] | undefined>()
  const fetchLimit = useSteadyLimit(limit, fetched, !!after)
  const departures = useDepartures([stopId], { limit: fetchLimit, after })
  useEffect(() => setFetched(departures.data?.departures), [departures.data])

  return (
    <div className="min-h-dvh">
      <NavBar
        back={{ label: t('common.back') }}
        trailing={
          favoriteOptions.length > 0 && (
            <>
              <ViewToggle />
              <button
              type="button"
              onClick={() => setSheet(true)}
              aria-label={t('common.favourites')}
              className={`rounded-md p-2 active:opacity-50 ${favorite ? 'text-accent' : 'text-label'}`}
            >
              <StarIcon filled={favorite} className="h-6 w-6" />
              </button>
            </>
          )
        }
      />
      <main className="mx-auto max-w-2xl space-y-section px-gutter pt-gutter pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        {query.isPending && <div className="h-24 animate-pulse rounded-2xl bg-surface" />}
        {query.isError && (
          <p className="p-6 text-center text-secondary">
            {t('station.loadError')}{' '}
            <button type="button" className="font-medium text-accent" onClick={() => query.refetch()}>
              {t('common.retry')}
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
                className="flex items-center justify-between rounded-2xl bg-surface px-gutter py-row active:bg-fill"
              >
                <span className="text-secondary">
                  {t.rich('stop.everythingAt', { name: <span className="font-medium text-label">{stop.name}</span> })}
                </span>
                <ChevronIcon className="h-4 w-4 text-secondary/60" />
              </Link>
            </div>

            <Alerts routeIds={routes.map((r) => r.routeId)} stopIds={[stopId]} />

            {routes.length === 0 ? (
              <p className="p-6 text-center text-secondary">{t('stop.noLines')}</p>
            ) : (
              <>
                {view === 'departures' ? (
                  <Departures
                    reference={picked}
                    toolbar={<AfterFilter stopIds={[stopId]} />}
                    show={limit}
                footer={(departures.data?.departures.length ?? 0) >= fetchLimit ? <MoreButton onClick={() => setMore((m) => m + 1)} /> : null}
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
