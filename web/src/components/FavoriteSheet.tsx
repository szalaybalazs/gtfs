import { useEffect } from 'react'
import { favoriteId, useFavorites, type FavoriteDraft } from '../lib/favorites'
import { FavoritePreview } from './FavoriteCards'
import { StarIcon } from './Icons'

const TITLES: Record<FavoriteDraft['kind'], string> = {
  line: 'Just the line',
  lineStop: 'This line from this stop',
  stop: 'The whole stop',
  lines: 'These lines from here',
}

/**
 * Bottom sheet asking what to save: each option shows a live preview of how
 * it will look on the home screen, and toggles on tap.
 */
export default function FavoriteSheet({ options, onClose }: { options: FavoriteDraft[]; onClose: () => void }) {
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
        aria-label="Add to favourites"
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-canvas p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-separator sm:hidden" aria-hidden />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Add to favourites</h2>
          <button type="button" onClick={onClose} className="text-[17px] font-medium text-accent">
            Done
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
                  <div className="flex items-center justify-between px-4 pt-3 text-[13px] font-semibold text-secondary uppercase">
                    {TITLES[option.kind]}
                    <span className={`flex items-center gap-1 normal-case ${saved ? 'text-accent' : ''}`}>
                      <StarIcon filled={saved} className="h-4 w-4" />
                      {saved ? 'Saved' : 'Add'}
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
