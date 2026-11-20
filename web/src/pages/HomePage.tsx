import { Link } from 'react-router'
import { LineStopCard, StopCard } from '../components/FavoriteCards'
import NavBar from '../components/NavBar'
import NearbyList from '../components/NearbyList'
import RouteTile from '../components/RouteTile'
import TimeModeMenu from '../components/TimeModeMenu'
import { useFavorites } from '../lib/favorites'

export default function HomePage() {
  const { favorites, lines, lineStops, stops } = useFavorites()
  return (
    <div className="min-h-dvh">
      <NavBar title="Home" menu trailing={<TimeModeMenu />} />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        {favorites.length === 0 && (
          <p className="rounded-2xl bg-surface p-4 text-secondary">
            Tap the star on a line or a stop to pin it here.{' '}
            <Link to="/routes" className="font-medium text-accent">
              Browse lines
            </Link>
          </p>
        )}

        {lines.length > 0 && (
          <section>
            <h2 className="px-1 pb-2 text-xl font-bold">Lines</h2>
            <div className="flex flex-wrap gap-2">
              {lines.map((f) => (
                <RouteTile key={f.id} route={f.route} compact />
              ))}
            </div>
          </section>
        )}

        {lineStops.length > 0 && (
          <section>
            <h2 className="px-1 pb-2 text-xl font-bold">Lines from stops</h2>
            <ul className="divide-y divide-separator overflow-hidden rounded-2xl bg-surface">
              {lineStops.map((f) => (
                <li key={f.id}>
                  <LineStopCard fav={f} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {stops.length > 0 && (
          <section>
            <h2 className="px-1 pb-2 text-xl font-bold">Stops</h2>
            <ul className="divide-y divide-separator overflow-hidden rounded-2xl bg-surface">
              {stops.map((f) => (
                <li key={f.id}>
                  <StopCard fav={f} />
                </li>
              ))}
            </ul>
          </section>
        )}

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
