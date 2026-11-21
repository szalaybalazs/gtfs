import NavBar from '../components/NavBar'
import NearbyList from '../components/NearbyList'
import { useT } from '../lib/i18n'

export default function NearbyPage() {
  const t = useT()
  return (
    <div className="min-h-dvh">
      <NavBar title={t('nav.nearby')} menu />
      <main className="mx-auto max-w-2xl px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <NearbyList />
      </main>
    </div>
  )
}
