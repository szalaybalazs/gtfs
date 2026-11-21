import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { useT } from '../lib/i18n'
import { HomeIcon, MenuIcon } from './Icons'
import { useOpenMenu } from './Layout'

export default function NavBar({
  title,
  back,
  leading,
  trailing,
  children,
  menu,
}: {
  /** Show the side-menu button (also shown whenever there's a back button). */
  menu?: boolean
  title?: ReactNode
  /** Deeper page. No visible back button: back is the edge swipe / browser back; the menu shows instead. */
  back?: { to?: string; label: string }
  leading?: ReactNode
  trailing?: ReactNode
  children?: ReactNode
}) {
  const t = useT()
  const openMenu = useOpenMenu()
  const { pathname } = useLocation()
  return (
    <header className="sticky top-0 z-10 border-b border-separator bg-canvas/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto max-w-2xl px-4">
        <div className="flex h-11 items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center">
            {/* The menu is on every page, not only top-level ones */}
            {(menu || back) && (
              <button type="button" onClick={openMenu} aria-label={t('nav.openMenu')} className="-ml-2 rounded-md p-2 active:opacity-50">
                <MenuIcon className="h-6 w-6" />
              </button>
            )}
            {leading}
          </div>
          <div className="flex flex-1 items-center justify-end gap-1">
            {trailing}
            {/* Always one tap back to Home (favourites), from anywhere */}
            {pathname !== '/' && (
              <Link to="/" aria-label={t('nav.home')} className="rounded-md p-2 active:opacity-50">
                <HomeIcon className="h-6 w-6" />
              </Link>
            )}
          </div>
        </div>
        {title && <h1 className="line-clamp-2 pb-2 text-[30px] leading-tight font-bold tracking-tight">{title}</h1>}
        {children}
      </div>
    </header>
  )
}
