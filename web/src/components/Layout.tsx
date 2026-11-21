import { historyIdx, setPageTitle } from '../lib/pageTitles'
import { createContext, Suspense, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useNavigationType } from 'react-router'
import { CATEGORIES } from '../lib/categories'
import { useT, type MessageKey } from '../lib/i18n'
import { preloadMap } from '../lib/lazyPages'
import CategoryIcon from './CategoryIcon'
import { BusIcon, CloseIcon, GearIcon, HomeIcon, LocationIcon, MapIcon, PinIcon } from './Icons'

const MenuContext = createContext<() => void>(() => {})
export const useOpenMenu = () => useContext(MenuContext)

const LINKS: { to: string; label: MessageKey; icon: ReactNode }[] = [
  { to: '/', label: 'nav.home', icon: <HomeIcon className="h-5 w-5" /> },
  { to: '/routes', label: 'nav.routes', icon: <BusIcon className="h-5 w-5" /> },
  { to: '/stops', label: 'nav.allStops', icon: <PinIcon className="h-5 w-5" /> },
  { to: '/nearby', label: 'nav.nearby', icon: <PinIcon className="h-5 w-5" /> },
  { to: '/departures', label: 'tab.nearby', icon: <LocationIcon className="h-5 w-5" /> },
  { to: '/map', label: 'nav.map', icon: <MapIcon className="h-5 w-5" /> },
  { to: '/settings', label: 'nav.settings', icon: <GearIcon className="h-5 w-5" /> },
]

/** The five tabs along the bottom on phones. `also` are other paths that belong to the same tab. */
const TABS: { to: string; label: MessageKey; icon: ReactNode; also?: string[] }[] = [
  { to: '/', label: 'nav.home', icon: <HomeIcon className="h-6 w-6" /> },
  { to: '/stops', label: 'tab.stops', icon: <PinIcon className="h-6 w-6" />, also: ['/stations', '/nearby'] },
  { to: '/routes', label: 'nav.routes', icon: <BusIcon className="h-6 w-6" />, also: ['/lines'] },
  { to: '/map', label: 'nav.map', icon: <MapIcon className="h-6 w-6" /> },
  { to: '/departures', label: 'tab.nearby', icon: <LocationIcon className="h-6 w-6" /> },
]

export const TOP_LEVEL = new Set(LINKS.map((l) => l.to))
const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

/** App shell: page content plus a slide-in side menu. */
export default function Layout() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const activeType = location.pathname === '/routes' ? new URLSearchParams(location.search).get('type') : null
  // Lock page scroll while the menu is open (html and body both, for iOS standalone)
  useEffect(() => {
    if (!open) return
    const html = document.documentElement
    const prev = [html.style.overflow, document.body.style.overflow]
    html.style.overflow = document.body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prev[0]
      document.body.style.overflow = prev[1]
    }
  }, [open])
  // Close on Escape (links close it on click).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Pages slide in from the right when opened and from the left when going
  // back. Replace-navigations (search typing, filters, time picker) keep the
  // page as is, so inputs keep focus.
  const navType = useNavigationType()
  const slides = standalone()
  // Remember this page's heading under its history position, for the Back button's hint
  useEffect(() => {
    const idx = historyIdx()
    let frame = 0
    const read = () => {
      const text = document.querySelector('header h1')?.textContent?.trim() || document.querySelector('main h1')?.textContent?.trim()
      if (text) setPageTitle(idx, text)
    }
    read()
    const obs = new MutationObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(read)
    })
    obs.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => {
      cancelAnimationFrame(frame)
      obs.disconnect()
    }
  }, [location.key])

  const [page, setPage] = useState({ key: location.key, dir: 'none' as 'none' | 'forward' | 'back' })
  if (navType !== 'REPLACE' && page.key !== location.key) setPage({ key: location.key, dir: navType === 'POP' ? 'back' : 'forward' })
  useLayoutEffect(() => {
    if (page.dir === 'forward') window.scrollTo(0, 0)
  }, [page])

  // Left-edge swipe: on Home it opens the menu; on every other page (Routes and Map included) it
  // goes back, like iOS, so Back and the menu never get mixed up. Only in the home
  // screen app: in a browser tab the browser's own back swipe already does this.
  // Swipe left closes the menu.
  const navigate = useNavigate()
  const isHome = location.pathname === '/'
  const swipe = useRef<{ x: number; y: number; opening: boolean } | null>(null)
  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (e.touches.length !== 1) return
      // Not while panning the map (the very edge still works, for Back)
      if (t.clientX >= 24 && (e.target as Element | null)?.closest?.('.maplibregl-map')) return
      if (!open && !standalone()) return
      // Phones have the tab bar, no side menu to swipe open
      if (!open && !window.matchMedia('(min-width: 768px)').matches && !standalone()) return
      if (open || t.clientX < 24) swipe.current = { x: t.clientX, y: t.clientY, opening: !open }
    }
    const onMove = (e: TouchEvent) => {
      const s = swipe.current
      if (!s) return
      const dx = e.touches[0].clientX - s.x
      const dy = e.touches[0].clientY - s.y
      if (Math.abs(dy) > 30 && Math.abs(dy) > Math.abs(dx)) swipe.current = null
      else if (s.opening && dx > 50) {
        if (isHome) { if (window.matchMedia('(min-width: 768px)').matches) setOpen(true) }
        else if (historyIdx() > 0) navigate(-1)
        else navigate('/')
        swipe.current = null
      } else if (!s.opening && dx < -50) {
        setOpen(false)
        swipe.current = null
      }
    }
    const onEnd = () => (swipe.current = null)
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchcancel', onEnd)
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [open, isHome, navigate])

  return (
    <MenuContext.Provider value={() => setOpen(true)}>
      {/* On phones the tab bar sits after the page and sticks to the bottom of the screen; --tabbar-total is its height (0 on wide screens,
          which keep the side menu). Pages that fill the screen use it. */}
      <div className="flex min-h-dvh flex-col [--tabbar-total:calc(3.25rem+1px+env(safe-area-inset-bottom))] md:[--tabbar-total:0px]">
      {/* Slide transitions only in the installed app: a browser tab already animates its own back swipe */}
      <div key={page.key} className={`flex-1 ${!slides ? '' : page.dir === 'forward' ? 'page-forward' : page.dir === 'back' ? 'page-back' : ''}`}>
        <Suspense fallback={<div className="min-h-dvh bg-canvas" />}>
          <Outlet />
        </Suspense>
      </div>
      <nav
        aria-label={t('nav.mainMenu')}
        className="sticky bottom-0 z-[1000] border-t border-separator bg-canvas/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <ul className="mx-auto flex max-w-2xl">
          {TABS.map((tab) => (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                end={tab.to === '/'}
                onPointerDown={tab.to === '/map' ? preloadMap : undefined}
                onPointerEnter={tab.to === '/map' ? preloadMap : undefined}
                className={({ isActive }) => {
                  const on = isActive || (tab.also ?? []).some((p) => location.pathname.startsWith(p))
                  return `flex h-[3.25rem] flex-col items-center justify-center gap-0.5 text-[10px] font-medium active:opacity-60 ${on ? 'text-accent' : 'text-secondary'}`
                }}
              >
                {tab.icon}
                {t(tab.label)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      </div>
      <div
        className={`fixed inset-0 z-[1100] touch-none bg-black/30 transition-opacity ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <nav
        aria-label={t('nav.mainMenu')}
        inert={!open}
        className={`fixed inset-y-0 left-0 z-[1101] flex w-72 overflow-y-auto overscroll-contain pb-6 max-w-[85vw] flex-col bg-canvas pt-[env(safe-area-inset-top)] shadow-2xl transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Tall header pushes the links down into easy thumb reach; icon is a placeholder until we have a logo */}
        <div className="relative flex min-h-[22dvh] flex-col justify-end px-gutter pb-4">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t('nav.closeMenu')}
            className="absolute top-3 right-3 rounded-md p-2 active:opacity-50"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
          <img src="/icon.svg" alt="" className="h-14 w-14 rounded-2xl" />
          <span className="mt-2 text-2xl font-bold">{t('app.name')}</span>
          <span className="text-[13px] text-secondary">{t('app.city')}</span>
        </div>
        <ul className="mx-3 space-y-0.5 rounded-2xl bg-surface p-2">
          {LINKS.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.to === '/' || link.to === '/routes'}
                onClick={() => setOpen(false)}
                onPointerDown={link.to === '/map' ? preloadMap : undefined}
                onPointerEnter={link.to === '/map' ? preloadMap : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[17px] active:bg-fill ${
                    isActive ? 'bg-fill font-semibold text-accent' : ''
                  }`
                }
              >
                {link.icon}
                {t(link.label)}
              </NavLink>
              {link.to === '/routes' && (
                // Vehicle types, with BKK's round pictograms
                <ul className="mt-0.5 mb-1 ml-5 border-l border-separator pl-2">
                  {CATEGORIES.filter((c) => c.key !== 'other').map((c) => (
                    <li key={c.key}>
                      <Link
                        to={`/routes?type=${c.key}`}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-[15px] active:bg-fill ${
                          activeType === c.key ? 'bg-fill font-semibold' : ''
                        }`}
                      >
                        <CategoryIcon category={c} className="h-6 w-6" />
                        {t(`category.${c.key}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </MenuContext.Provider>
  )
}
