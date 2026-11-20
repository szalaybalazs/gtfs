import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { MenuIcon } from './Icons'
import { useOpenMenu } from './Layout'

export default function NavBar({
  title,
  back,
  leading,
  trailing,
  children,
  menu,
}: {
  /** Show the side-menu button (top-level pages). */
  menu?: boolean
  title?: ReactNode
  back?: { to: string; label: string }
  leading?: ReactNode
  trailing?: ReactNode
  children?: ReactNode
}) {
  const openMenu = useOpenMenu()
  return (
    <header className="sticky top-0 z-10 border-b border-separator bg-canvas/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto max-w-2xl px-4">
        <div className="flex h-11 items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center">
            {menu && (
              <button type="button" onClick={openMenu} aria-label="Open menu" className="-ml-2 rounded-md p-2 active:opacity-50">
                <MenuIcon className="h-6 w-6" />
              </button>
            )}
            {back && (
              <Link
                to={back.to}
                className="-ml-2 flex items-center gap-0.5 rounded-md px-2 py-1 text-[17px] text-accent active:opacity-50"
              >
                <svg viewBox="0 0 12 20" className="h-5 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M10 2 2 10l8 8" />
                </svg>
                {back.label}
              </Link>
            )}
            {leading}
          </div>
          <div className="flex flex-1 items-center justify-end gap-1">{trailing}</div>
        </div>
        {title && <h1 className="truncate pb-2 text-[34px] leading-tight font-bold tracking-tight">{title}</h1>}
        {children}
      </div>
    </header>
  )
}
