import { Link } from 'react-router'
import NavBar from '../components/NavBar'
import NearbyList from '../components/NearbyList'
import RouteTile from '../components/RouteTile'
import { useFavorites } from '../lib/favorites'

export default function HomePage() {
  const { favorites } = useFavorites()
  return (
    <div className="min-h-dvh">
      <NavBar title="Home" menu />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <section>
          <h2 className="px-1 pb-2 text-xl font-bold">Favourite routes</h2>
          {favorites.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {favorites.map((route) => (
                <RouteTile key={route.routeId} route={route} round />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-surface p-4 text-secondary">
              Tap the star on a route to pin it here.{' '}
              <Link to="/routes" className="font-medium text-accent">
                Browse routes
              </Link>
            </p>
          )}
        </section>
        <section>
          <div className="flex items-baseline justify-between px-1 pb-2">
            <h2 className="text-xl font-bold">Nearby stops</h2>
            <Link to="/nearby" className="text-[15px] font-medium text-accent">
              See all
            </Link>
          </div>
          <NearbyList radius={500} limit={5} />
        </section>
      </main>
    </div>
  )
}
