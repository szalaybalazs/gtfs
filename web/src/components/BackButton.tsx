import { useNavigate } from 'react-router'
import { useT } from '../lib/i18n'
import { historyIdx, pageTitle } from '../lib/pageTitles'

/**
 * Back on deeper pages: one step back, or Home when there's nothing to go back
 * to (opened from a link). The menu lives on the top-level pages.
 */
export default function BackButton() {
  const t = useT()
  const navigate = useNavigate()
  // React Router keeps the position in its history entry; 0 = first page of this visit
  const idx = historyIdx()
  const canGoBack = idx > 0
  // Where it goes: the previous page's title, or Home
  const hint = canGoBack ? pageTitle(idx - 1) : t('nav.home')
  return (
    <button
      type="button"
      aria-label={t('common.back')}
      onClick={() => (canGoBack ? navigate(-1) : navigate('/'))}
      className="-ml-2 flex min-w-0 items-center gap-0.5 rounded-md p-2 text-[17px] text-accent active:opacity-50"
    >
      <svg viewBox="0 0 12 20" className="h-5 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M10 2 2 10l8 8" />
      </svg>
      {hint && <span className="max-w-[45vw] truncate">{hint}</span>}
    </button>
  )
}
