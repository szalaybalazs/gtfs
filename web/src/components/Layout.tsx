import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
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
        className={`fixed inset-0 z-30 bg-black/30 transition-opacity ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <nav
        aria-label="Main menu"
        inert={!open}
        className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col bg-canvas pt-[env(safe-area-inset-top)] shadow-2xl transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <span className="text-xl font-bold">Timetable</span>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-md p-2 active:opacity-50">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <ul className="mx-3 space-y-0.5 rounded-2xl bg-surface p-2">
          {LINKS.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.to === '/'}
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
            </li>
          ))}
        </ul>
      </nav>
    </MenuContext.Provider>
  )
}
