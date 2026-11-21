import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import FavoriteSheet from '../components/FavoriteSheet'
import { StarIcon } from '../components/Icons'
import { favoriteId, useFavorites, type FavoriteDraft } from '../lib/favorites'
import { useParams, useSearchParams } from 'react-router'
import AfterFilter, { useAfter } from '../components/AfterFilter'
import Alerts from '../components/Alerts'
import Departures from '../components/Departures'
import NavBar from '../components/NavBar'
import StationStops from '../components/StationStops'
import StopInfoCard from '../components/StopInfoCard'
import { gql, STATION_QUERY, type StationDetails } from '../lib/api'
import { recordVisit } from '../lib/usage'
import { useDepartures } from '../lib/useDepartures'
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

  const query = useQuery({
    queryKey: ['station', stationId],
    queryFn: () => gql<StationDetails>(STATION_QUERY, { id: stationId }),
    staleTime: 60 * 60_000,
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
  const departures = useDepartures(ids, { limit: multi ? 20 : 8, enabled: !!station, after, routeIds: multi ? lineIds : null })

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
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        {query.isPending && <div className="h-32 animate-pulse rounded-2xl bg-surface" />}
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
              />
            )}

            <Alerts
              routeIds={multi ? lineIds : (fromPlatform?.routes ?? station.routes).filter((r) => r != null).map((r) => r!.routeId)}
              stopIds={fromPlatform ? [fromPlatform.stopId] : platforms.map((p) => p.stopId)}
            />

            <section className="space-y-2">
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
