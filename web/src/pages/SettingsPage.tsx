import { RADII, useNearbyRadius, type Radius } from '../lib/nearbyRadius'
import { formatDistance } from '../lib/geo'
import { CircleHalf, Moon, Sun } from '@mynaui/icons-react'
import type { ReactNode } from 'react'
import Menu from '../components/Menu'
import { UpDownIcon } from '../components/Icons'
import { Legend } from '../components/LineMarks'
import { useState } from 'react'
import NavBar from '../components/NavBar'
import { useFavorites } from '../lib/favorites'
import { useLocaleSetting, useT, type LocaleSetting, type MessageKey } from '../lib/i18n'
import { getTheme, setTheme, type Theme } from '../lib/theme'

const THEMES: { value: Theme; label: MessageKey; icon: ReactNode }[] = [
  { value: 'system', label: 'settings.theme.system', icon: <CircleHalf className="h-5 w-5" /> },
  { value: 'light', label: 'settings.theme.light', icon: <Sun className="h-5 w-5" /> },
  { value: 'dark', label: 'settings.theme.dark', icon: <Moon className="h-5 w-5" /> },
]

const LANGUAGES: { value: LocaleSetting; label: MessageKey }[] = [
  { value: 'auto', label: 'settings.language.auto' },
  { value: 'en', label: 'settings.language.en' },
  { value: 'hu', label: 'settings.language.hu' },
]

/** Row of choices in a rounded card, the selected one tinted. */
function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string; lang?: string; icon?: ReactNode }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex gap-1 rounded-2xl bg-surface p-1" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          lang={o.lang}
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[15px] font-medium ${value === o.value ? 'bg-fill text-accent' : ''}`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function SettingsPage() {
  const t = useT()
  const [theme, setThemeState] = useState(getTheme)
  const [language, setLanguage] = useLocaleSetting()
  const [radius, setRadius] = useNearbyRadius()
  const { favorites, clear } = useFavorites()

  return (
    <div className="min-h-dvh">
      <NavBar title={t('nav.settings')} menu />
      <main className="mx-auto max-w-2xl space-y-section px-gutter pt-gutter pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <section>
          <h2 className="px-1 pb-heading text-xl font-bold">{t('settings.appearance')}</h2>
          <Choice
            label={t('settings.theme')}
            value={theme}
            options={THEMES.map((o) => ({ value: o.value, label: t(o.label), icon: o.icon }))}
            onChange={(value) => {
              setTheme(value)
              setThemeState(value)
            }}
          />
        </section>

        <section>
          <h2 className="px-1 pb-heading text-xl font-bold">{t('settings.language')}</h2>
          {/* A dropdown row: current language on the right, the list opens below it */}
          <div className="flex items-center justify-between rounded-2xl bg-surface py-1 pr-1 pl-4">
            <span className="text-[17px]">{t('settings.language')}</span>
            <Menu
              label={t('settings.language')}
              value={language}
              options={LANGUAGES.map((o) => ({ value: o.value, title: t(o.label) }))}
              onChange={setLanguage}
              icon={
                <span className="flex items-center gap-1 text-[17px] text-secondary">
                  {t(LANGUAGES.find((o) => o.value === language)!.label)}
                  <UpDownIcon className="h-4 w-4" />
                </span>
              }
            />
          </div>
        </section>

        <section>
          <h2 className="px-1 pb-heading text-xl font-bold">{t('nav.nearby')}</h2>
          {/* How far "Nearby stops" looks; wider helps where stops are sparse */}
          <div className="flex items-center justify-between rounded-2xl bg-surface py-1 pr-1 pl-4">
            <span className="text-[17px]">{t('settings.radius')}</span>
            <Menu
              label={t('settings.radius')}
              value={String(radius)}
              options={RADII.map((r) => ({ value: String(r), title: formatDistance(r) }))}
              onChange={(v) => setRadius(Number(v) as Radius)}
              icon={
                <span className="flex items-center gap-1 text-[17px] text-secondary">
                  {formatDistance(radius)}
                  <UpDownIcon className="h-4 w-4" />
                </span>
              }
            />
          </div>
        </section>

        <section>
          <h2 className="px-1 pb-heading text-xl font-bold">{t('settings.favourites')}</h2>
          <div className="flex items-center justify-between rounded-2xl bg-surface px-gutter py-row">
            <span>
              {t('settings.favouriteCount', { n: favorites.length })}
              <span className="block text-[13px] text-secondary">{t('settings.storedLocally')}</span>
            </span>
            <button
              type="button"
              disabled={favorites.length === 0}
              onClick={clear}
              className="font-medium text-late disabled:opacity-40"
            >
              {t('common.clear')}
            </button>
          </div>
        </section>

        <section>
          <h2 className="px-1 pb-heading text-xl font-bold">{t('settings.about')}</h2>
          <p className="rounded-2xl bg-surface p-gutter text-[15px] text-secondary">{t('settings.aboutText')}</p>
        </section>
        <section>
          <h2 className="px-1 pb-heading text-xl font-bold">{t('legend.title')}</h2>
          <Legend />
        </section>
      </main>
    </div>
  )
}
