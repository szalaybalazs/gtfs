import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'
import NavBar from '../components/NavBar'
import StopRow from '../components/StopRow'
import { gql, STOPS_QUERY, type StopsPage as StopsData } from '../lib/api'

const PAGE_SIZE = 100

/**
 * Every stop, loaded page by page as you scroll. There is no server-side
 * search yet, and there are tens of thousands of stops, so no search box.
 */
export default function StopsPage() {
  const query = useInfiniteQuery({
    queryKey: ['stops'],
    queryFn: ({ pageParam }) => gql<StopsData>(STOPS_QUERY, { limit: PAGE_SIZE, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: ({ stops }) => (stops.page + 1 < stops.pages ? stops.page + 1 : undefined),
    staleTime: 60 * 60_000,
  })
  const stops = useMemo(() => query.data?.pages.flatMap((p) => p.stops.data) ?? [], [query.data])

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
      <NavBar title="All stops" menu />
      <main className="mx-auto max-w-2xl px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        {query.isError && (
          <p className="p-6 text-center text-secondary">
            Couldn't load stops.{' '}
            <button type="button" className="font-medium text-accent" onClick={() => query.refetch()}>
              Retry
            </button>
          </p>
        )}
        {stops.length > 0 && (
          <ul className="overflow-hidden rounded-2xl bg-surface">
            {stops.map((stop) => (
              <StopRow key={stop.stopId} stop={stop} />
            ))}
          </ul>
        )}
        {(query.isPending || isFetchingNextPage) && <p className="p-6 text-center text-sm text-secondary">Loading…</p>}
        <div ref={sentinel} />
      </main>
    </div>
  )
}
