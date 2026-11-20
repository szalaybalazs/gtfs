import NavBar from '../components/NavBar'
import NearbyList from '../components/NearbyList'

export default function NearbyPage() {
  return (
    <div className="min-h-dvh">
      <NavBar title="Nearby" menu />
      <main className="mx-auto max-w-2xl px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <NearbyList radius={800} />
      </main>
    </div>
  )
}
