import { useEffect } from 'react'
import { favoriteId, useFavorites, type FavoriteDraft } from '../lib/favorites'
import { useT, type MessageKey } from '../lib/i18n'
import { FavoritePreview } from './FavoriteCards'
import { StarIcon } from './Icons'

const TITLES: Record<FavoriteDraft['kind'], MessageKey> = {
  line: 'fav.kind.line',
  lineStop: 'fav.kind.lineStop',
  stop: 'fav.kind.stop',
  lines: 'fav.kind.lines',
}

/**
 * Bottom sheet asking what to save: each option shows a live preview of how
 * it will look on the home screen, and toggles on tap.
 */
export default function FavoriteSheet({ options, onClose }: { options: FavoriteDraft[]; onClose: () => void }) {
  const t = useT()
  const { has, toggle } = useFavorites()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/30 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('fav.add')}
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-canvas p-gutter pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-separator sm:hidden" aria-hidden />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">{t('fav.add')}</h2>
          <button type="button" onClick={onClose} className="text-[17px] font-medium text-accent">
            {t('common.done')}
          </button>
        </div>
        <ul className="space-y-3">
          {options.map((option) => {
            const saved = has(favoriteId(option))
            return (
              <li key={favoriteId(option)}>
                <button
                  type="button"
                  onClick={() => toggle(option)}
                  aria-pressed={saved}
                  className={`w-full overflow-hidden rounded-2xl bg-surface text-left ring-2 transition-shadow ${saved ? 'ring-accent' : 'ring-transparent'}`}
                >
                  <div className="flex items-center justify-between px-gutter pt-3 text-[13px] font-semibold text-secondary uppercase">
                    {t(TITLES[option.kind])}
                    <span className={`flex items-center gap-1 normal-case ${saved ? 'text-accent' : ''}`}>
                      <StarIcon filled={saved} className="h-4 w-4" />
                      {saved ? t('fav.saved') : t('fav.addShort')}
                    </span>
                  </div>
                  <FavoritePreview fav={option} />
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
