import { Bike, Circle, LetterPCircle, OneCircle, Refresh, Telephone, Wheelchair } from '@mynaui/icons-react'
import type { ReactNode } from 'react'
import type { RouteFlags } from '../lib/api'
import { useT, type MessageKey } from '../lib/i18n'
import { useShownMarks, type ShownMark } from '../lib/shownMarks'

/**
 * BKK's legend markers (Jelmagyarázat), drawn like theirs: a small circled
 * glyph. ① front-door boarding, Ⓟ replacement bus, ♿ accessible (every vehicle low-floor),
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
const inner: Partial<Record<Mark | 'bikes', ReactNode>> = {
  bikes: <Bike {...ICON} />,
  lowFloor: <Wheelchair {...ICON} />,
  demand: <Telephone {...ICON} />,
  circular: <Refresh {...ICON} />,
}

/**
 * One marker, as an SVG so it lines up exactly like the other inline icons.
 * Size it with h-/w- classes like any icon.
 */
export function MarkIcon({ mark, className = 'h-[1.1em] w-[1.1em] align-[-0.2em]', label: given }: { mark: Mark | 'bikes'; className?: string; label?: string }) {
  const t = useT()
  // `label` overrides the legend wording: on a single trip the icon says that trip is accessible, not that every vehicle is
  const label = given ?? (mark === 'bikes' ? t('common.bikes') : t(MARKS.find((m) => m.mark === mark)!.label))
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
  const { shows } = useShownMarks()
  const marks = lineMarks(flags).filter(shows)
  if (marks.length === 0) return null
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {marks.map((m) => (
        <MarkIcon key={m} mark={m} />
      ))}
    </span>
  )
}

/**
 * "Jelmagyarázat": every marker with its meaning, each with a switch to show
 * or hide it on departures and lines (Settings).
 */
export function Legend() {
  const t = useT()
  const { shows, toggle } = useShownMarks()
  const rows: { key: ShownMark; icon: ReactNode; label: string }[] = [
    ...MARKS.map(({ mark, label }) => ({ key: mark as ShownMark, icon: <MarkIcon mark={mark} />, label: t(label) })),
    { key: 'bikes', icon: <MarkIcon mark="bikes" />, label: t('common.bikes') },
  ]
  return (
    <ul className="divide-y divide-separator overflow-hidden rounded-2xl bg-surface text-[17px]">
      {rows.map(({ key, icon, label }) => {
        const on = shows(key)
        return (
          <li key={key}>
            <label className="flex cursor-pointer items-center gap-3 px-gutter py-row">
              <span className={`flex w-6 justify-center text-[20px] ${on ? 'text-secondary' : 'text-secondary/40'}`}>{icon}</span>
              <span className={`flex-1 ${on ? '' : 'text-secondary'}`}>{label}</span>
              <input type="checkbox" role="switch" checked={on} onChange={() => toggle(key)} className="peer sr-only" />
              {/* iOS-style switch; the knob moves with a transform */}
              <span
                aria-hidden
                className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-accent ${on ? 'bg-accent' : 'bg-fill'}`}
              >
                <span
                  className={`absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_4px_rgb(0_0_0/0.2)] transition-transform duration-200 ${on ? 'translate-x-5' : ''}`}
                />
              </span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}
