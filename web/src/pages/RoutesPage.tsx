import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import NavBar from '../components/NavBar'
import CategoryIcon from '../components/CategoryIcon'
import CategoryChips from '../components/CategoryChips'
import SearchInput from '../components/SearchInput'
import { gql, ROUTES_QUERY, type RouteSummary, type RoutesPage as RoutesData } from '../lib/api'
import RouteBadge from '../components/RouteBadge'
import { linesUrl } from './LinesPage'
import { CATEGORIES, categoryOf, replacesCategory } from '../lib/categories'
import RouteTile from '../components/RouteTile'
import { useT } from '../lib/i18n'
import { score } from '../lib/search'
import { rank } from '../lib/usage'


export default function RoutesPage() {
  const t = useT()
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const category = CATEGORIES.find((c) => c.key === params.get('type')) ?? null
  const navigate = useNavigate()
  // Long-press a line to start picking several, then see their shared stops
  const [selected, setSelected] = useState<RouteSummary[]>([])
  const selecting = selected.length > 0
  const isSelected = (id: string) => selected.some((r) => r.routeId === id)
  const toggle = (route: RouteSummary) =>
    setSelected((list) => (list.some((r) => r.routeId === route.routeId) ? list.filter((r) => r.routeId !== route.routeId) : [...list, route]))
  const tile = (route: RouteSummary) => (
    <RouteTile route={route} selecting={selecting} selected={isSelected(route.routeId)} onSelect={() => toggle(route)} />
  )

  const setParam = (key: string, value: string | null) =>
    setParams(
      (p) => {
        if (value) p.set(key, value)
        else p.delete(key)
        return p
      },
      { replace: true },
    )

  // Every line in one request (a few hundred small rows), so the page renders once instead of growing page by page
  const query = useQuery({
    queryKey: ['routes', 'all'],
    queryFn: () => gql<RoutesData>(ROUTES_QUERY, { limit: 1000, page: 0 }),
    staleTime: 60 * 60_000,
  })

  const allRoutes = useMemo(() => query.data?.routes.data ?? [], [query.data])

  // Replacement buses count as part of the tram / metro they replace
  const groupOf = (r: (typeof allRoutes)[number]) => replacesCategory(r) ?? categoryOf(r).key
  const routes = useMemo(() => {
    const inCategory = allRoutes.filter((r) => !category || groupOf(r) === category.key)
    if (!search.trim()) return inCategory
    // Accent-insensitive, fuzzy, and lines you open often rank first
    return rank(inCategory, search, (r) => [r.shortName ?? '', r.desc ?? '', r.longName ?? ''], (r) => `route:${r.routeId}`, score)
  }, [allRoutes, search, category])

  // Grouped in BKK's order: metro, tram, trolleybus, bus, night, boat, other
  const groups = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        category: c,
        routes: routes.filter((r) => categoryOf(r).key === c.key && !replacesCategory(r)),
        replacements: routes.filter((r) => replacesCategory(r) === c.key),
      })).filter((g) => g.routes.length + g.replacements.length > 0),
    [routes],
  )



  return (
    <div className="min-h-dvh">
      <NavBar
        title={t('nav.routes')}
        menu
      >
        <div className="pb-2">
          <SearchInput value={search} onChange={(v) => setParam('q', v || null)} />
        </div>
        <CategoryChips routes={allRoutes} value={category?.key ?? null} keep={category?.key ?? null} onChange={(k) => setParam('type', k)} />
      </NavBar>

      <main className="mx-auto max-w-2xl pb-[env(safe-area-inset-bottom)]">
        {query.isError && (
          <p className="p-6 text-center text-secondary">
            {t('routes.loadError')}{' '}
            <button type="button" className="text-accent" onClick={() => query.refetch()}>
              {t('common.retry')}
            </button>
          </p>
        )}

        {search.trim() && (
          <section className="px-gutter pt-section">
            <h2 className="pb-2 text-xl font-bold">{t('routes.bestMatches')}</h2>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
              {routes.slice(0, 40).map((route) => (
                <li key={route.routeId}>{tile(route)}</li>
              ))}
            </ul>
          </section>
        )}
        {!search.trim() && groups.map(({ category: c, routes: list, replacements }) => (
          <section key={c.key} className="px-gutter pt-section">
            <h2 className="flex items-center gap-2 pb-2 text-xl font-bold">
              <CategoryIcon category={c} className="h-7 w-7" />
              {t(`category.${c.key}`)}
              <span className="text-[15px] font-normal text-secondary">{list.length}</span>
            </h2>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
              {list.map((route) => (
                <li key={route.routeId}>{tile(route)}</li>
              ))}
            </ul>
            {replacements.length > 0 && (
              <>
                {/* Pótlóbuszok: blue bus tiles, under the tram/metro lines they stand in for */}
                <h3 className="pt-4 pb-2 text-[15px] font-semibold text-secondary">
                  {t('routes.replacements')} <span className="font-normal">{replacements.length}</span>
                </h3>
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
                  {replacements.map((route) => (
                    <li key={route.routeId}>{tile(route)}</li>
                  ))}
                </ul>
              </>
            )}
          </section>
        ))}

        {query.isPending ? (
          // Tile-shaped placeholder: the grid appears in one go when the lines arrive
          <section className="px-gutter pt-section">
            <div className="mb-3 h-7 w-32 animate-pulse rounded-md bg-fill" />
            <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
              {Array.from({ length: 24 }, (_, i) => (
                <div key={i} className="aspect-[2/1] animate-pulse rounded-[10px] bg-fill" />
              ))}
            </div>
          </section>
        ) : (
          routes.length === 0 &&
          !query.isError && <p className="p-6 text-center text-secondary">{t('routes.none')}</p>
        )}
        {!selecting && allRoutes.length > 0 && (
          <p className="px-gutter pt-2 pb-6 text-center text-[13px] text-secondary">{t('routes.tip')}</p>
        )}
        {selecting && <div className="h-28" />}
      </main>

      {selecting && (
        <div className="fixed inset-x-0 bottom-[var(--tabbar-total,0px)] z-30 border-t border-separator bg-canvas/95 px-gutter pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
              {selected.map((r) => (
                <button key={r.routeId} type="button" onClick={() => toggle(r)} aria-label={t('routes.remove', { line: r.shortName ?? r.routeId })} className="shrink-0">
                  <RouteBadge route={r} fit />
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setSelected([])} className="shrink-0 px-1 text-[15px] font-medium text-accent">
              {t('common.clear')}
            </button>
            <button
              type="button"
              disabled={selected.length < 2}
              onClick={() => navigate(linesUrl(selected.map((r) => r.routeId)))}
              className="shrink-0 rounded-full bg-accent px-gutter py-2 text-[15px] font-semibold text-white disabled:opacity-40"
            >
              {selected.length < 2 ? t('routes.pickOneMore') : t('lines.title')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


