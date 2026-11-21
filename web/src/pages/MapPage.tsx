import NavBar from '../components/NavBar'
import TransitMap from '../components/TransitMap'
import { useT } from '../lib/i18n'

/** The Map page: the transit map full screen under the top bar. */
export default function MapPage() {
  const t = useT()
  return (
    <div className="flex h-dvh flex-col">
      <NavBar
        menu
        leading={<span className="text-[17px] font-semibold">{t('map.title')}</span>}
      />
      <div className="relative flex-1">
        <TransitMap />
      </div>
    </div>
  )
}
