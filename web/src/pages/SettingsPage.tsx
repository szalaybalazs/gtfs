import { Legend } from '../components/LineMarks'
import { useState } from 'react'
import NavBar from '../components/NavBar'
import { useFavorites } from '../lib/favorites'
import { useLocaleSetting, useT, type LocaleSetting, type MessageKey } from '../lib/i18n'
import { getTheme, setTheme, type Theme } from '../lib/theme'

const THEMES: { value: Theme; label: MessageKey }[] = [
  { value: 'system', label: 'settings.theme.system' },
  { value: 'light', label: 'settings.theme.light' },
  { value: 'dark', label: 'settings.theme.dark' },
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
  options: { value: T; label: string; lang?: string }[]
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
          className={`flex-1 rounded-xl py-2 text-[15px] font-medium ${value === o.value ? 'bg-fill text-accent' : ''}`}
        >
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
  const { favorites, clear } = useFavorites()

  return (
    <div className="min-h-dvh">
      <NavBar title={t('nav.settings')} menu />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <section>
          <h2 className="px-1 pb-2 text-xl font-bold">{t('settings.appearance')}</h2>
          <Choice
            label={t('settings.theme')}
            value={theme}
            options={THEMES.map((o) => ({ value: o.value, label: t(o.label) }))}
            onChange={(value) => {
              setTheme(value)
              setThemeState(value)
            }}
          />
        </section>

        <section>
          <h2 className="px-1 pb-2 text-xl font-bold">{t('settings.language')}</h2>
          <Choice
            label={t('settings.language')}
            value={language}
            // Language names stay in their own language
            options={LANGUAGES.map((o) => ({ value: o.value, label: t(o.label), lang: o.value === 'auto' ? undefined : o.value }))}
            onChange={setLanguage}
          />
        </section>

        <section>
          <h2 className="px-1 pb-2 text-xl font-bold">{t('settings.favourites')}</h2>
          <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3">
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
          <h2 className="px-1 pb-2 text-xl font-bold">{t('settings.about')}</h2>
          <p className="rounded-2xl bg-surface p-4 text-[15px] text-secondary">{t('settings.aboutText')}</p>
        </section>
        <section>
          <h2 className="px-1 pb-2 text-xl font-bold">{t('legend.title')}</h2>
          <Legend />
        </section>
      </main>
    </div>
  )
}
