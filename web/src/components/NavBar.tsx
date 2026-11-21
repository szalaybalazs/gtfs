import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { useT } from '../lib/i18n'
import { HomeIcon, MenuIcon } from './Icons'
import { TOP_LEVEL, useOpenMenu } from './Layout'
import BackButton from './BackButton'

export default function NavBar({
  title,
  leading,
  trailing,
  children,
}: {
  /** Unused: top-level pages get the menu, deeper pages get Back (decided by path) */
  menu?: boolean
  title?: ReactNode
  /** Unused (kept for call sites): Back shows on every page that isn't top-level */
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
      <div className="mx-auto max-w-2xl px-gutter">
        <div className="flex h-11 items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center">
            {/* Top-level pages: the menu. Deeper pages: Back (the menu is one tap away via Home) */}
            {TOP_LEVEL.has(pathname) ? (
              <button type="button" onClick={openMenu} aria-label={t('nav.openMenu')} className="-ml-2 rounded-md p-2 active:opacity-50">
                <MenuIcon className="h-6 w-6" />
              </button>
            ) : (
              <BackButton />
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
        {/* Breathing room between the top bar and the big title */}
        {title && <h1 className="line-clamp-2 pt-2 pb-3 text-[30px] leading-tight font-bold tracking-tight">{title}</h1>}
        {children}
      </div>
    </header>
  )
}
