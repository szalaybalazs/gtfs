import RollingNumber from './RollingNumber'
import { useT } from '../lib/i18n'

/** A small clock icon, for "last refreshed". */
export function ClockIcon({ className = 'shrink-0' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

/**
 * How old a live position is: a stopwatch and the age ("40s", "3'"), right aligned, nothing else.
 * Shared by the map's vehicle card and the trip's top card.
 */
export function RefreshedAge({ seconds, className = '' }: { seconds: number; className?: string }) {
  const t = useT()
  const s = Math.max(0, Math.floor(seconds))
  return (
    <span className={`ml-auto flex items-center gap-1.5 text-secondary ${className}`}>
      <ClockIcon />
      <span className="tabular-nums">
        <RollingNumber value={s < 60 ? t('short.seconds', { n: s }) : t('short.minutes', { n: Math.floor(s / 60) })} />
      </span>
    </span>
  )
}
