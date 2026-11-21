import { Link } from 'react-router'
import { LinesCard, LineStopCard, StopCard } from '../components/FavoriteCards'
import { GearIcon } from '../components/Icons'
import NavBar from '../components/NavBar'
import NearbyList from '../components/NearbyList'
import RouteTile from '../components/RouteTile'
import { useFavorites } from '../lib/favorites'
import { useT } from '../lib/i18n'

export default function HomePage() {
  const t = useT()
  const { favorites, lines, lineStops, stops, multiLines } = useFavorites()
  return (
    <div className="min-h-dvh">
      <NavBar
        title={t('nav.home')}
        menu
        trailing={
          // Phones have no side menu and Settings isn't a tab: a gear here
          <Link to="/settings" aria-label={t('nav.settings')} className="rounded-md p-2 active:opacity-50 md:hidden">
            <GearIcon className="h-6 w-6" />
          </Link>
        }
      />
      <main className="mx-auto max-w-2xl space-y-section px-gutter pt-gutter pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        {favorites.length === 0 && (
          <p className="rounded-2xl bg-surface p-gutter text-secondary">
            {t('home.empty')}{' '}
            <Link to="/routes" className="font-medium text-accent">
              {t('home.browseLines')}
            </Link>
          </p>
        )}

        {lines.length > 0 && (
          <section>
            <h2 className="px-1 pb-heading text-xl font-bold">{t('home.lines')}</h2>
            <div className="flex flex-wrap gap-2">
              {lines.map((f) => (
                <RouteTile key={f.id} route={f.route} compact />
              ))}
            </div>
          </section>
        )}

        {(lineStops.length > 0 || multiLines.length > 0) && (
          <section>
            <h2 className="px-1 pb-heading text-xl font-bold">{t('home.linesFromStops')}</h2>
            <ul className="divide-y divide-separator overflow-hidden rounded-2xl bg-surface">
              {lineStops.map((f) => (
                <li key={f.id}>
                  <LineStopCard fav={f} />
                </li>
              ))}
              {multiLines.map((f) => (
                <li key={f.id}>
                  <LinesCard fav={f} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {stops.length > 0 && (
          <section>
            <h2 className="px-1 pb-heading text-xl font-bold">{t('home.stops')}</h2>
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
          <NearbyList
            limit={5}
            title={t('home.nearbyStops')}
            trailing={
              <Link to="/nearby" className="text-[15px] font-medium text-accent">
                {t('home.seeAll')}
              </Link>
            }
          />
        </section>
      </main>
    </div>
  )
}
