import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { LocationIcon } from '../components/Icons'
import NavBar from '../components/NavBar'
import CategoryIcon from '../components/CategoryIcon'
import SearchInput from '../components/SearchInput'
import { gql, ROUTES_QUERY, type RoutesPage as RoutesData } from '../lib/api'
import { CATEGORIES, categoryOf } from '../lib/categories'
import RouteTile from '../components/RouteTile'
import { useFavorites } from '../lib/favorites'
import { score } from '../lib/search'
import { rank } from '../lib/usage'
import { useGeolocation } from '../lib/useGeolocation'

const PAGE_SIZE = 50

export default function RoutesPage() {
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const category = CATEGORIES.find((c) => c.key === params.get('type')) ?? null
  const location = useGeolocation()
  const { lines: favorites } = useFavorites()

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
    const inCategory = allRoutes.filter((r) => !category || categoryOf(r).key === category.key)
    if (!search.trim()) return inCategory
    // Accent-insensitive, fuzzy, and lines you open often rank first
    return rank(inCategory, search, (r) => [r.shortName ?? '', r.desc ?? '', r.longName ?? ''], (r) => `route:${r.routeId}`, score)
  }, [allRoutes, search, category])

  // Grouped in BKK's order: metro, tram, trolleybus, bus, night, boat, other
  const groups = useMemo(
    () => CATEGORIES.map((c) => ({ category: c, routes: routes.filter((r) => categoryOf(r).key === c.key) })).filter((g) => g.routes.length > 0),
    [routes],
  )

  // Grouping, search and filters are client side, so pull in every page (a few hundred lines)
  const narrowing = search.trim() !== '' || category !== null
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

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
        menu
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
          <SearchInput value={search} onChange={(v) => setParam('q', v || null)} />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => setParam('type', null)}
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${!category ? 'bg-accent text-white' : 'bg-fill text-label'}`}
          >
            All
          </button>
          {/* Only types that actually have lines (e.g. 'Other' is usually empty) */}
          {CATEGORIES.filter((c) => category?.key === c.key || allRoutes.some((r) => categoryOf(r).key === c.key)).map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setParam('type', c.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full py-1 pr-3 pl-1.5 text-sm font-medium ${
                category?.key === c.key ? 'bg-accent text-white' : 'bg-fill text-label'
              }`}
            >
              <CategoryIcon category={c} className="h-5 w-5" color={category?.key === c.key ? '#ffffff' : undefined} />
              {c.label}
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

        {favorites.length > 0 && !narrowing && (
          <section className="px-4 pt-4">
            <h2 className="pb-2 text-xl font-bold">Favourites</h2>
            <div className="flex flex-wrap gap-2">
              {favorites.map((route) => (
                <RouteTile key={route.id} route={route.route} compact />
              ))}
            </div>
          </section>
        )}

        {search.trim() && (
          <section className="px-4 pt-5">
            <h2 className="pb-2 text-xl font-bold">Best matches</h2>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
              {routes.slice(0, 40).map((route) => (
                <li key={route.routeId}>
                  <RouteTile route={route} />
                </li>
              ))}
            </ul>
          </section>
        )}
        {!search.trim() && groups.map(({ category: c, routes: list }) => (
          <section key={c.key} className="px-4 pt-5">
            <h2 className="flex items-center gap-2 pb-2 text-xl font-bold">
              <CategoryIcon category={c} className="h-7 w-7" />
              {c.label}
              <span className="text-[15px] font-normal text-secondary">{list.length}</span>
            </h2>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
              {list.map((route) => (
                <li key={route.routeId}>
                  <RouteTile route={route} />
                </li>
              ))}
            </ul>
          </section>
        ))}

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

