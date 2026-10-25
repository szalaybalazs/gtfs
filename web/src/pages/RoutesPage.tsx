import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChevronIcon, LocationIcon, SearchIcon } from '../components/Icons'
import NavBar from '../components/NavBar'
import RouteBadge from '../components/RouteBadge'
import { gql, ROUTES_QUERY, type RoutesPage as RoutesData, type RouteType } from '../lib/api'
import { useGeolocation } from '../lib/useGeolocation'

const PAGE_SIZE = 50

const FILTERS: { label: string; types: RouteType[] | null }[] = [
  { label: 'All', types: null },
  { label: 'Buses', types: ['BUS'] },
  { label: 'Trams', types: ['TRAM'] },
  { label: 'Trolleybuses', types: ['TROLLEYBUS'] },
  { label: 'Subway', types: ['SUBWAY'] },
  { label: 'Rail', types: ['RAIL'] },
  { label: 'Ferry', types: ['FERRY'] },
]

export default function RoutesPage() {
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const filter = FILTERS.find((f) => f.label === params.get('type')) ?? FILTERS[0]
  const location = useGeolocation()

  const setParam = (key: string, value: string | null) =>
    setParams(
      (p) => {
        if (value) p.set(key, value)
        else p.delete(key)
        return p
      },
      { replace: true },
    )

  const query = useInfiniteQuery({
    queryKey: ['routes'],
    queryFn: ({ pageParam }) => gql<RoutesData>(ROUTES_QUERY, { limit: PAGE_SIZE, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: ({ routes }) => (routes.page + 1 < routes.pages ? routes.page + 1 : undefined),
    staleTime: 60 * 60_000,
  })

  const allRoutes = useMemo(() => query.data?.pages.flatMap((p) => p.routes.data) ?? [], [query.data])

  const routes = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return allRoutes.filter((r) => {
      if (filter.types && (!r.type || !filter.types.includes(r.type))) return false
      if (!needle) return true
      return [r.shortName, r.desc, r.longName].some((v) => v?.toLowerCase().includes(needle))
    })
  }, [allRoutes, search, filter])

  // Searching and filtering happen client side, so pull in every page.
  const narrowing = search.trim() !== '' || filter.types !== null
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
  useEffect(() => {
    if (narrowing && hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [narrowing, hasNextPage, isFetchingNextPage, fetchNextPage])

  // Infinite scroll, like the app's onAppear trigger near the end of the list.
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
      },
      { rootMargin: '600px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div className="min-h-dvh">
      <NavBar
        title="Routes"
        leading={
          <button
            type="button"
            onClick={location.request}
            title={location.error ?? (location.coords ? 'Location enabled' : 'Use my location')}
            className="-ml-2 rounded-md p-2 text-accent active:opacity-50"
          >
            <LocationIcon
              filled={!!location.coords}
              className={`h-5 w-5 ${location.loading ? 'animate-pulse' : ''} ${location.error ? 'text-secondary' : ''}`}
            />
          </button>
        }
      >
        <div className="pb-2">
          <div className="flex h-9 items-center gap-1.5 rounded-[10px] bg-fill px-2 text-secondary">
            <SearchIcon className="h-4 w-4 shrink-0" />
            <input
              type="search"
              value={search}
              onChange={(e) => setParam('q', e.target.value || null)}
              placeholder="Search"
              className="w-full bg-transparent text-[17px] text-label outline-none placeholder:text-secondary"
            />
          </div>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none]">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => setParam('type', f.types ? f.label : null)}
              className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                f === filter ? 'bg-accent text-white' : 'bg-fill text-label'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </NavBar>

      <main className="mx-auto max-w-2xl pb-[env(safe-area-inset-bottom)]">
        {query.isError && (
          <p className="p-6 text-center text-secondary">
            Couldn't load routes.{' '}
            <button type="button" className="text-accent" onClick={() => query.refetch()}>
              Retry
            </button>
          </p>
        )}

        <ul className="bg-surface sm:my-4 sm:rounded-xl sm:mx-4 sm:overflow-hidden">
          {routes.map((route) => (
            <li key={route.routeId} className="border-b border-separator last:border-b-0">
              <Link
                to={`/routes/${encodeURIComponent(route.routeId)}`}
                className="flex min-h-11 items-center gap-3 px-4 py-2 active:bg-fill"
              >
                <RouteBadge route={route} />
                <span className="min-w-0 flex-1 truncate text-[15px]">{route.desc ?? route.longName ?? ''}</span>
                <ChevronIcon className="h-4 w-4 shrink-0 text-secondary/60" />
              </Link>
            </li>
          ))}
        </ul>

        {query.isPending || isFetchingNextPage ? (
          <p className="p-6 text-center text-sm text-secondary">Loading…</p>
        ) : (
          routes.length === 0 &&
          !query.isError && <p className="p-6 text-center text-secondary">No routes found</p>
        )}
        <div ref={sentinel} />
      </main>
    </div>
  )
}
