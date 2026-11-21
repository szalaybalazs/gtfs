import TransitMap from '../components/TransitMap'
import { useOpenMenu } from '../components/Layout'
import { MenuIcon } from '../components/Icons'
import { useT } from '../lib/i18n'

/** The Map page: the transit map full screen, no header. Wide screens get a menu button (phones have the tab bar). */
export default function MapPage() {
  const t = useT()
  const openMenu = useOpenMenu()
  return (
    <div className="relative h-[calc(100dvh-var(--tabbar-total,0px))]">
      <TransitMap />
      <button
        type="button"
        onClick={openMenu}
        aria-label={t('nav.openMenu')}
        className="absolute top-3 left-3 z-20 hidden rounded-full bg-surface p-2.5 shadow-lg active:opacity-60 md:block"
      >
        <MenuIcon className="h-5 w-5" />
      </button>
    </div>
  )
}
