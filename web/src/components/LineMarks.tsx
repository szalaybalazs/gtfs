import { Circle, LetterPCircle, OneCircle, Refresh, Telephone, Wheelchair } from '@mynaui/icons-react'
import type { ReactNode } from 'react'
import type { RouteFlags } from '../lib/api'
import { useT, type MessageKey } from '../lib/i18n'

/**
 * BKK's legend markers (Jelmagyarázat), drawn like theirs: a small circled
 * glyph. ① front-door boarding, Ⓟ replacement bus, ♿ every vehicle low-floor,
 * ☎ on request / demand-responsive, ⟲ circular line.
 */
export type Mark = 'frontDoor' | 'replacement' | 'lowFloor' | 'demand' | 'circular'

export const MARKS: { mark: Mark; label: MessageKey }[] = [
  { mark: 'frontDoor', label: 'legend.frontDoor' },
  { mark: 'replacement', label: 'legend.replacement' },
  { mark: 'lowFloor', label: 'legend.lowFloor' },
  { mark: 'demand', label: 'legend.demand' },
  { mark: 'circular', label: 'legend.circular' },
]

// Mynaui has circled 1 and P; the others are Mynaui's Circle with the Mynaui icon set inside it
const ICON = { x: 7, y: 7, width: 10, height: 10, strokeWidth: 2 }
const inner: Partial<Record<Mark, ReactNode>> = {
  lowFloor: <Wheelchair {...ICON} />,
  demand: <Telephone {...ICON} />,
  circular: <Refresh {...ICON} />,
}

/**
 * One marker, as an SVG so it lines up exactly like the other inline icons.
 * Size it with h-/w- classes like any icon.
 */
export function MarkIcon({ mark, className = 'h-[1.1em] w-[1.1em] align-[-0.2em]' }: { mark: Mark; className?: string }) {
  const t = useT()
  const label = t(MARKS.find((m) => m.mark === mark)!.label)
  const cls = `inline shrink-0 ${className}`
  if (mark === 'frontDoor') return <OneCircle role="img" aria-label={label} className={cls} />
  if (mark === 'replacement') return <LetterPCircle role="img" aria-label={label} className={cls} />
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={label} className={cls} fill="none">
      <title>{label}</title>
      <Circle x={0} y={0} width={24} height={24} />
      {inner[mark]}
    </svg>
  )
}

/** The marks that apply to a line, in legend order. */
export function lineMarks(flags: RouteFlags | null | undefined): Mark[] {
  if (!flags) return []
  return MARKS.map((m) => m.mark).filter((m) =>
    m === 'frontDoor' ? flags.frontDoor : m === 'replacement' ? flags.replacement : m === 'lowFloor' ? flags.lowFloor : m === 'demand' ? flags.demandResponsive : flags.circular,
  )
}

/** A row of a line's marks (nothing when none apply). */
export function LineMarks({ flags, className = '' }: { flags: RouteFlags | null | undefined; className?: string }) {
  const marks = lineMarks(flags)
  if (marks.length === 0) return null
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {marks.map((m) => (
        <MarkIcon key={m} mark={m} />
      ))}
    </span>
  )
}

/** "Jelmagyarázat": every marker with its meaning. */
export function Legend() {
  const t = useT()
  return (
    <ul className="space-y-2.5 rounded-2xl bg-surface p-4 text-[17px]">
      {MARKS.map(({ mark, label }) => (
        <li key={mark} className="flex items-center gap-3">
          <span className="flex w-6 justify-center text-[20px] text-secondary">
            <MarkIcon mark={mark} />
          </span>
          {t(label)}
        </li>
      ))}
    </ul>
  )
}
