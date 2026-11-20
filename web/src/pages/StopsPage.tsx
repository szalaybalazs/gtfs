import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { SearchIcon } from '../components/Icons'
import NavBar from '../components/NavBar'
import StationRow from '../components/StationRow'
import { gql, STATIONS_QUERY, type StationsPage } from '../lib/api'

const PAGE_SIZE = 20

/** Every stop group, searchable by name, loaded page by page. */
export default function StopsPage() {
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
    () => (query.data?.pages.flatMap((p) => p.stations.data) ?? []).filter((s) => s.routes.length > 0),
    [query.data],
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
      <NavBar title="All stops" menu>
        <div className="pb-2">
          <div className="flex h-9 items-center gap-1.5 rounded-[10px] bg-fill px-2 text-secondary">
            <SearchIcon className="h-4 w-4 shrink-0" />
            <input
              type="search"
              value={search}
              onChange={(e) =>
                setParams(
                  (p) => {
                    if (e.target.value) p.set('q', e.target.value)
                    else p.delete('q')
                    return p
                  },
                  { replace: true },
                )
              }
              placeholder="Search stops"
              className="w-full bg-transparent text-[17px] text-label outline-none placeholder:text-secondary"
            />
          </div>
        </div>
      </NavBar>
      <main className="mx-auto max-w-2xl px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        {query.isError && (
          <p className="p-6 text-center text-secondary">
            Couldn't load stops.{' '}
            <button type="button" className="font-medium text-accent" onClick={() => query.refetch()}>
              Retry
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
          <p className="p-6 text-center text-secondary">No stops match “{debounced}”.</p>
        )}
        {(query.isPending || isFetchingNextPage) && <p className="p-6 text-center text-sm text-secondary">Loading…</p>}
        <div ref={sentinel} />
      </main>
    </div>
  )
}
