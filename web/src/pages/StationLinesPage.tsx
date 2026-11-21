import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import CategoryChips from '../components/CategoryChips'
import CategoryIcon from '../components/CategoryIcon'
import NavBar from '../components/NavBar'
import RouteTile from '../components/RouteTile'
import { gql, STATION_QUERY, type RouteRef, type StationDetails } from '../lib/api'
import { CATEGORIES, categoryOf, replacesCategory } from '../lib/categories'
import { useT } from '../lib/i18n'
import { findCachedStation, stationKey } from '../lib/prefetch'
import { useQueryClient } from '@tanstack/react-query'

/**
 * A stop group's lines, like the Routes page but only what stops here:
 * grouped by type (metro, tram, …), filterable. Tapping a line opens it with
 * this stop already chosen, so you only pick the direction. Reached from
 * Nearby stops; "Departures" goes to the usual departures board.
 */
export default function StationLinesPage() {
  const t = useT()
  const { stationId = '' } = useParams()
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: stationKey(stationId),
    queryFn: () => gql<StationDetails>(STATION_QUERY, { id: stationId }),
    staleTime: 60 * 60_000,
    placeholderData: () => {
      const cached = findCachedStation(qc, stationId)
      return cached ? ({ station: cached } as StationDetails) : undefined
    },
  })
  const station = query.data?.station
  const [type, setType] = useState<string | null>(null)

  const routes = useMemo(() => (station?.routes ?? []).filter((r): r is RouteRef => !!r), [station])
  const groupOf = (r: RouteRef) => replacesCategory(r) ?? categoryOf(r).key
  const groups = useMemo(
    () =>
      CATEGORIES.map((c) => ({ category: c, routes: routes.filter((r) => groupOf(r) === c.key) })).filter(
        (g) => g.routes.length > 0 && (!type || g.category.key === type),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [routes, type],
  )
  const types = CATEGORIES.filter((c) => routes.some((r) => groupOf(r) === c.key))

  // The platform of this group that the line uses, so the line page opens on this stop
  const platformFor = (routeId: string) =>
    station?.stops?.find((s) => (s.routes ?? []).some((r) => r?.routeId === routeId) && (s.headsigns ?? []).length > 0)?.stopId ??
    station?.stops?.find((s) => (s.routes ?? []).some((r) => r?.routeId === routeId))?.stopId

  return (
    <div className="min-h-dvh">
      <NavBar
        back={{ label: t('common.back') }}
        title={station?.name ?? ' '}
        trailing={
          station && (
            <Link to={`/stations/${encodeURIComponent(station.stationId)}`} className="rounded-full bg-fill px-3 py-1.5 text-[15px] font-semibold text-accent active:opacity-60">
              {t('stationLines.departures')}
            </Link>
          )
        }
      >
        {types.length > 1 && <CategoryChips routes={routes} value={type as never} onChange={(k) => setType(k)} />}
      </NavBar>

      <main className="mx-auto max-w-2xl px-gutter pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <p className="pt-3 text-[15px] text-secondary">{t('stationLines.pick')}</p>
        {query.isPending && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2 pt-4">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="aspect-[2/1] animate-pulse rounded-[10px] bg-fill" />
            ))}
          </div>
        )}
        {groups.map(({ category: c, routes: list }) => (
          <section key={c.key} className="pt-section">
            <h2 className="flex items-center gap-2 pb-2 text-xl font-bold">
              <CategoryIcon category={c} className="h-7 w-7" />
              {t(`category.${c.key}`)}
              <span className="text-[15px] font-normal text-secondary">{list.length}</span>
            </h2>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
              {list.map((route) => {
                const stop = platformFor(route.routeId)
                return (
                  <li key={route.routeId}>
                    <RouteTile route={route} to={`/routes/${encodeURIComponent(route.routeId)}${stop ? `?stop=${encodeURIComponent(stop)}` : ''}`} />
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </main>
    </div>
  )
}
