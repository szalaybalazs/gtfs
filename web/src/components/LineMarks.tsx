import { Refresh, Telephone, Wheelchair } from '@mynaui/icons-react'
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

const glyph: Record<Mark, ReactNode> = {
  frontDoor: <span className="text-[0.62em] leading-none font-bold">1</span>,
  replacement: <span className="text-[0.62em] leading-none font-bold">P</span>,
  lowFloor: <Wheelchair className="h-[0.7em] w-[0.7em]" strokeWidth={2.2} />,
  demand: <Telephone className="h-[0.66em] w-[0.66em]" strokeWidth={2.2} />,
  circular: <Refresh className="h-[0.7em] w-[0.7em]" strokeWidth={2.2} />,
}

/** One marker; size follows the surrounding font size. */
export function MarkIcon({ mark, className = '' }: { mark: Mark; className?: string }) {
  const t = useT()
  const label = t(MARKS.find((m) => m.mark === mark)!.label)
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex h-[1.1em] w-[1.1em] shrink-0 items-center justify-center rounded-full border-[1.5px] border-current align-[-0.15em] ${className}`}
    >
      {glyph[mark]}
    </span>
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
