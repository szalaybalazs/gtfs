import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { CATEGORIES } from '../lib/categories'
import CategoryIcon from './CategoryIcon'
import { BusIcon, CloseIcon, GearIcon, HomeIcon, MapIcon, PinIcon } from './Icons'

const MenuContext = createContext<() => void>(() => {})
export const useOpenMenu = () => useContext(MenuContext)

const LINKS: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/', label: 'Home', icon: <HomeIcon className="h-5 w-5" /> },
  { to: '/routes', label: 'Routes', icon: <BusIcon className="h-5 w-5" /> },
  { to: '/stops', label: 'All stops', icon: <PinIcon className="h-5 w-5" /> },
  { to: '/nearby', label: 'Nearby', icon: <PinIcon className="h-5 w-5" /> },
  { to: '/map', label: 'Map', icon: <MapIcon className="h-5 w-5" /> },
  { to: '/settings', label: 'Settings', icon: <GearIcon className="h-5 w-5" /> },
]

/** App shell: page content plus a slide-in side menu. */
export default function Layout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const activeType = location.pathname === '/routes' ? new URLSearchParams(location.search).get('type') : null
  // Close on Escape (links close it on click).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <MenuContext.Provider value={() => setOpen(true)}>
      <Outlet />
      <div
        className={`fixed inset-0 z-[1100] bg-black/30 transition-opacity ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <nav
        aria-label="Main menu"
        inert={!open}
        className={`fixed inset-y-0 left-0 z-[1101] flex w-72 overflow-y-auto pb-6 max-w-[85vw] flex-col bg-canvas pt-[env(safe-area-inset-top)] shadow-2xl transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Tall header pushes the links down into easy thumb reach; icon is a placeholder until we have a logo */}
        <div className="relative flex min-h-[22dvh] flex-col justify-end px-4 pb-4">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="absolute top-3 right-3 rounded-md p-2 active:opacity-50"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
          <img src="/icon.svg" alt="" className="h-14 w-14 rounded-2xl" />
          <span className="mt-2 text-2xl font-bold">Timetable</span>
          <span className="text-[13px] text-secondary">Budapest</span>
        </div>
        <ul className="mx-3 space-y-0.5 rounded-2xl bg-surface p-2">
          {LINKS.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.to === '/' || link.to === '/routes'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[17px] active:bg-fill ${
                    isActive ? 'bg-fill font-semibold text-accent' : ''
                  }`
                }
              >
                {link.icon}
                {link.label}
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
                        {c.label}
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
