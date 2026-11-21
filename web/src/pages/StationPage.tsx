import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import FavoriteSheet from '../components/FavoriteSheet'
import { StarIcon } from '../components/Icons'
import { favoriteId, useFavorites, type FavoriteDraft } from '../lib/favorites'
import { useParams, useSearchParams } from 'react-router'
import AfterFilter, { useAfter } from '../components/AfterFilter'
import Alerts from '../components/Alerts'
import Departures, { MoreButton } from '../components/Departures'
import LineBoard from '../components/LineBoard'
import NavBar from '../components/NavBar'
import StationStops from '../components/StationStops'
import StopInfoCard from '../components/StopInfoCard'
import { gql, STATION_QUERY, type StationDetails } from '../lib/api'
import { recordVisit } from '../lib/usage'
import { findCachedStation, stationKey } from '../lib/prefetch'
import { useDepartures, useSteadyLimit } from '../lib/useDepartures'
import type { Departure } from '../lib/api'
import { useT } from '../lib/i18n'

/**
 * A stop group (e.g. Széll Kálmán tér): every line at the top, departures
 * from the platform you arrived at (or all of them), then each platform,
 * then a small map. `:stationId` may also be any platform's stop id.
 */
export default function StationPage() {
  const t = useT()
  const { stationId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const from = params.get('from')
  // Several lines picked together (Routes → long-press → Shared stops)
  const lineIds = (params.get('lines') ?? '').split(',').filter(Boolean)
  const lineSet = new Set(lineIds)
  const multi = lineIds.length > 0
  const servesLines = (s: { routes?: ({ routeId: string } | null)[] | null }) => !multi || (s.routes ?? []).some((r) => r && lineSet.has(r.routeId))

  const qc = useQueryClient()
  const query = useQuery({
    queryKey: stationKey(stationId),
    queryFn: () => gql<StationDetails>(STATION_QUERY, { id: stationId }),
    staleTime: 60 * 60_000,
    // Name and lines from whichever list you tapped it in, so the header is there at once
    placeholderData: () => {
      const cached = findCachedStation(qc, stationId)
      return cached ? ({ station: cached } as StationDetails) : undefined
    },
  })
  const station = query.data?.station
  useEffect(() => {
    if (station) recordVisit(`station:${station.stationId}`)
  }, [station])
  const platforms = (station?.stops ?? []).filter((s) => (s.routes ?? []).some(Boolean) && servesLines(s))
  const selectedLines = multi ? (station?.routes ?? []).filter((r): r is NonNullable<typeof r> => !!r && lineSet.has(r.routeId)) : []
  const fromPlatform = platforms.find((s) => s.stopId === from) ?? station?.stops?.find((s) => s.stopId === from)

  const { has } = useFavorites()
  const [sheet, setSheet] = useState(false)
  const favStop = fromPlatform ?? (platforms.length === 1 ? platforms[0] : undefined)
  const favoriteOptions: FavoriteDraft[] = multi
    ? station && selectedLines.length > 0
      ? [
          {
            kind: 'lines' as const,
            routes: selectedLines,
            stationId: station.stationId,
            stopIds: fromPlatform ? [fromPlatform.stopId] : platforms.map((p) => p.stopId),
            from: fromPlatform?.stopId ?? null,
            name: fromPlatform?.name ?? station.name,
            headsigns: fromPlatform?.headsigns ?? [],
          },
        ]
      : []
    : favStop
    ? [
        {
          kind: 'stop' as const,
          stopId: favStop.stopId,
          stationId: station?.stationId ?? stationId,
          name: favStop.name ?? favStop.stopId,
          headsigns: favStop.headsigns ?? [],
          routes: (favStop.routes ?? []).filter((r) => r != null),
        },
        ...(favStop.routes ?? []).filter((r) => r != null).map((route) => ({
          kind: 'lineStop' as const,
          route,
          stopId: favStop.stopId,
          stationId: station?.stationId ?? stationId,
          stopName: favStop.name ?? favStop.stopId,
          headsign: null,
        })),
      ]
    : []
  const favorite = favoriteOptions.some((o) => has(favoriteId(o)))

  // The selected stop (from ?from=) narrows the departures; none selected = every stop in the group
  const ids = from ? [from] : platforms.map((s) => s.stopId)
  const { after } = useAfter()
  const arrivedOn = useSearchParams()[0].get('trip')
  // With ?from= the stop is already known, so departures load in parallel with the stop group (no waterfall)
  // A whole stop group shows more than one platform; each "Show more" adds 20
  const [more, setMore] = useState(0)
  // Show 20 for a whole stop group, 10 for one platform; fetch just enough spare (see useSteadyLimit)
  const limit = (from ? 10 : 20) + more * 20
  const [fetched, setFetched] = useState<Departure[] | undefined>()
  const fetchLimit = useSteadyLimit(limit, fetched, !!after)
  // Arrivals too: always on a terminus platform (nothing departs there), otherwise via the switch
  const terminus = !!fromPlatform && (fromPlatform.headsigns ?? []).length === 0 && (fromPlatform.routes ?? []).some(Boolean)
  const arrivals = terminus || params.get('arrivals') === '1'
  // A whole stop group shows a board (one row per line + direction) unless "Time order" is on
  const board = !from && !multi && params.get('view') !== 'time'
  // A single platform always asks for arrivals (we don't know yet if it's a terminus when the request
  // starts, in parallel with the stop group); rows that end here are dropped below unless wanted
  const departures = useDepartures(ids, { perLine: board ? 4 : null, limit: board ? 300 : fetchLimit, enabled: !!station || !!from, after, routeIds: multi ? lineIds : null, arrivals: arrivals || !!from })
  const shownDepartures = useMemo(
    () => (departures.data?.departures ?? []).filter((d) => arrivals || !d.terminates),
    [departures.data, arrivals],
  )
  useEffect(() => setFetched(departures.data?.departures), [departures.data])

  return (
    <div className="min-h-dvh">
      <NavBar
        back={{ label: t('common.back') }}
        trailing={
          <>
            {favoriteOptions.length > 0 && (
              <button
              type="button"
              onClick={() => setSheet(true)}
              aria-label={t('common.favourites')}
              className={`rounded-md p-2 active:opacity-50 ${favorite ? 'text-accent' : 'text-label'}`}
            >
              <StarIcon filled={favorite} className="h-6 w-6" />
            </button>
            )}
          </>
        }
      />
      <main className="mx-auto max-w-2xl space-y-section px-gutter pt-gutter pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        {query.isPending && (
          // Shaped like the page: info card, then the departures card
          <>
            <div className="rounded-2xl bg-surface p-gutter">
              <div className="h-7 w-2/3 animate-pulse rounded-md bg-fill" />
              <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-fill" />
              <div className="mt-3 flex gap-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="h-6 w-10 animate-pulse rounded-md bg-fill" />
                ))}
              </div>
            </div>
            <div className="space-y-2 rounded-2xl bg-surface p-gutter">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-fill" />
              ))}
            </div>
          </>
        )}
        {query.isError && (
          <p className="p-6 text-center text-secondary">
            {t('station.loadError')}{' '}
            <button type="button" className="font-medium text-accent" onClick={() => query.refetch()}>
              {t('common.retry')}
            </button>
          </p>
        )}

        {station && (
          <>
            {multi && !fromPlatform ? (
              <StopInfoCard
                name={station.name}
                note={
                  platforms.length > 1
                    ? t('station.platformsNote', { n: platforms.length })
                    : t('station.samePlatform')
                }
                routes={selectedLines}
              />
            ) : fromPlatform ? (
              <StopInfoCard
                id={fromPlatform.code && fromPlatform.code !== fromPlatform.stopId ? fromPlatform.code : fromPlatform.stopId}
                name={fromPlatform.name ?? station.name}
                headsigns={fromPlatform.headsigns}
                routes={(fromPlatform.routes ?? []).filter((r): r is NonNullable<typeof r> => r != null && servesLines({ routes: [r] }))}
              />
            ) : (
              <StopInfoCard
                name={station.name}
                note={t('station.groupNote', { n: platforms.length })}
                routes={station.routes}
                // Whole group: kinds of transport as pictograms, not dozens of badges
                compact
              />
            )}

            <Alerts
              routeIds={multi ? lineIds : (fromPlatform?.routes ?? station.routes).filter((r) => r != null).map((r) => r!.routeId)}
              stopIds={fromPlatform ? [fromPlatform.stopId] : platforms.map((p) => p.stopId)}
            />

            <section className="space-y-2">
              <Departures
                toolbar={
                  <AfterFilter
                    stopIds={ids}
                    routeIds={multi ? lineIds : null}
                    extra={
                      <>
                      {!from && !multi && (
                        <button
                          type="button"
                          aria-pressed={!board}
                          onClick={() =>
                            setParams(
                              (p) => {
                                if (board) p.set('view', 'time')
                                else p.delete('view')
                                return p
                              },
                              { replace: true },
                            )
                          }
                          className={`rounded-full px-2.5 py-0.5 text-[13px] font-medium whitespace-nowrap ${!board ? 'bg-accent text-white' : 'bg-fill'}`}
                        >
                          {t('departures.timeOrder')}
                        </button>
                      )}
                      {!terminus && (
                        <button
                          type="button"
                          aria-pressed={arrivals}
                          onClick={() =>
                            setParams(
                              (p) => {
                                if (arrivals) p.delete('arrivals')
                                else p.set('arrivals', '1')
                                return p
                              },
                              { replace: true },
                            )
                          }
                          className={`rounded-full px-2.5 py-0.5 text-[13px] font-medium ${arrivals ? 'bg-accent text-white' : 'bg-fill'}`}
                        >
                          {t('departures.showArrivals')}
                        </button>
                      )}
                      </>
                    }
                  />
                }
                board={board && shownDepartures.length > 0 ? <LineBoard departures={shownDepartures} stationPath={`/stations/${encodeURIComponent(station.stationId)}`} /> : undefined}
                show={limit}
                footer={!board && (departures.data?.departures.length ?? 0) >= fetchLimit ? <MoreButton onClick={() => setMore((m) => m + 1)} /> : null}
                includePast={!!after}
                highlightTrip={arrivedOn}
                title={null}
                departures={shownDepartures}
                isPending={departures.isPending}
                error={departures.isError}
                onRetry={() => departures.refetch()}
              />
            </section>

            <StationStops
              id={station.stationId}
              current={from}
              lines={multi ? lineIds : undefined}
              onSelect={(stopId) => {
                // Opens that stop as a new view (slides in, Back returns). The chosen
                // time (?after / ?at) is kept so checking a connection still works.
                setParams((p) => {
                  if (stopId && stopId !== from) p.set('from', stopId)
                  else p.delete('from')
                  p.delete('trip')
                  p.delete('earlier')
                  return p
                })
              }}
            />
          </>
        )}
      </main>
      {sheet && <FavoriteSheet options={favoriteOptions} onClose={() => setSheet(false)} />}
    </div>
  )
}
