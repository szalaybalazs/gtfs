import { useState } from 'react'
import NavBar from '../components/NavBar'
import { useFavorites } from '../lib/favorites'
import { getTheme, setTheme, type Theme } from '../lib/theme'

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export default function SettingsPage() {
  const [theme, setThemeState] = useState(getTheme)
  const { favorites, toggle } = useFavorites()

  return (
    <div className="min-h-dvh">
      <NavBar title="Settings" menu />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <section>
          <h2 className="px-1 pb-2 text-xl font-bold">Appearance</h2>
          <div className="flex gap-1 rounded-2xl bg-surface p-1" role="radiogroup" aria-label="Theme">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={theme === t.value}
                onClick={() => {
                  setTheme(t.value)
                  setThemeState(t.value)
                }}
                className={`flex-1 rounded-xl py-2 text-[15px] font-medium ${theme === t.value ? 'bg-fill text-accent' : ''}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="px-1 pb-2 text-xl font-bold">Favourites</h2>
          <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3">
            <span>
              {favorites.length} saved route{favorites.length === 1 ? '' : 's'}
              <span className="block text-[13px] text-secondary">Stored in this browser only</span>
            </span>
            <button
              type="button"
              disabled={favorites.length === 0}
              onClick={() => favorites.forEach(toggle)}
              className="font-medium text-late disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </section>

        <section>
          <h2 className="px-1 pb-2 text-xl font-bold">About</h2>
          <p className="rounded-2xl bg-surface p-4 text-[15px] text-secondary">
            Timetables from BKK, MÁV and Volán GTFS data, with realtime updates where available. Map data ©
            OpenStreetMap contributors.
          </p>
        </section>
      </main>
    </div>
  )
}
