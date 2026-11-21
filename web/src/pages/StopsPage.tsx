import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import NavBar from '../components/NavBar'
import SearchInput from '../components/SearchInput'
import StationRow from '../components/StationRow'
import { gql, STATIONS_QUERY, type StationsPage } from '../lib/api'
import { useT } from '../lib/i18n'
import { score } from '../lib/search'
import { rank } from '../lib/usage'

const PAGE_SIZE = 20

/** Every stop group, searchable by name, loaded page by page. */
export default function StopsPage() {
  const t = useT()
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  // Debounce typing so each keystroke doesn't hit the API
  const [debounced, setDebounced] = useState(search)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(id)
  }, [search])

  const query = useInfiniteQuery({
    queryKey: ['stations', debounced],
    queryFn: ({ pageParam }) =>
      gql<StationsPage>(STATIONS_QUERY, { limit: PAGE_SIZE, page: pageParam, search: debounced || null }),
    initialPageParam: 0,
    getNextPageParam: ({ stations }) => (stations.page + 1 < stations.pages ? stations.page + 1 : undefined),
    staleTime: 60 * 60_000,
    placeholderData: (prev) => prev,
  })
  const stations = useMemo(
    () => {
      const list = (query.data?.pages.flatMap((p) => p.stations.data) ?? []).filter((s) => s.routes.length > 0)
      // The server ranks by text match; stops you open often move up
      return debounced ? rank(list, debounced, (s) => [s.name], (s) => `station:${s.stationId}`, score) : list
    },
    [query.data, debounced],
  )

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && hasNextPage && !isFetchingNextPage && fetchNextPage(),
      { rootMargin: '600px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div className="min-h-dvh">
      <NavBar title={t('nav.allStops')} menu>
        <div className="pb-2">
          <SearchInput
            placeholder={t('search.stops')}
            value={search}
            onChange={(v) =>
              setParams(
                (p) => {
                  if (v) p.set('q', v)
                  else p.delete('q')
                  return p
                },
                { replace: true },
              )
            }
          />
        </div>
      </NavBar>
      <main className="mx-auto max-w-2xl px-gutter pt-gutter pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        {query.isError && (
          <p className="p-6 text-center text-secondary">
            {t('nearby.loadError')}{' '}
            <button type="button" className="font-medium text-accent" onClick={() => query.refetch()}>
              {t('common.retry')}
            </button>
          </p>
        )}
        {stations.length > 0 && (
          <ul className="overflow-hidden rounded-2xl bg-surface">
            {stations.map((station) => (
              <StationRow key={station.stationId} station={station} />
            ))}
          </ul>
        )}
        {!query.isPending && !query.isError && stations.length === 0 && !hasNextPage && (
          <p className="p-6 text-center text-secondary">{t('search.noStopMatch', { q: debounced })}</p>
        )}
        {(query.isPending || isFetchingNextPage) && <p className="p-6 text-center text-sm text-secondary">{t('common.loading')}</p>}
        <div ref={sentinel} />
      </main>
    </div>
  )
}
