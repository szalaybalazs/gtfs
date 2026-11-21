import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { Departure } from '../lib/api'
import { countdown } from '../lib/countdown'
import { useT } from '../lib/i18n'
import { formatTime } from '../lib/time'
import { prefetchTrip, type TripPreview } from '../lib/prefetch'
import { realtimeStatus, statusColor, statusLabel } from '../lib/realtimeStatus'
import { useNow } from '../lib/useTimetable'
import { BikeIcon, ChevronIcon, LiveIcon } from './Icons'
import RouteBadge from './RouteBadge'

/** How long a departed row stays (seconds) before it collapses away */
const LINGER_S = 30
import { MarkIcon } from './LineMarks'

/**
 * Departures as tappable rows: line badge, destination, countdown with the
 * exact time under it. Tapping opens that trip.
 */
export default function Departures({
  departures,
  isPending,
  error,
  onRetry,
  title,
  empty,
  toolbar,
  footer,
  show,
  includePast = false,
  highlightTrip,
}: {
  // includePast also means "not live": departed rows stay (faded) instead of collapsing away
  /** Keep departures that already left (after "⋯ Earlier"); shown greyed */
  includePast?: boolean
  /** The trip you arrived on, marked "Your trip" */
  highlightTrip?: string | null
  /** Shown at the top of the card, e.g. the time filter. */
  toolbar?: ReactNode
  /** Under the list, inside the card (e.g. "Show more") */
  footer?: ReactNode
  /** Keep this many upcoming rows on screen; fetch a few extra so the next one slides in when one leaves */
  show?: number
  departures: Departure[]
  isPending?: boolean
  error?: boolean
  onRetry?: () => void
  title?: ReactNode
  empty?: string
}) {
  const t = useT()
  const now = useNow(1_000)
  // Departed rows linger (counting -1, -2…) and collapse after LINGER_S: BKK often corrects a
  // "departed" vehicle back to "still at the stop" within ~20 s, so hiding sooner makes rows jump
  const kept = includePast ? departures : departures.filter((d) => new Date(d.departure).getTime() >= now.getTime() - (LINGER_S + 5) * 1000)
  // Rows still counting down after leaving don't use up a slot, so the list stays the same length
  // (Not with a chosen time: there nothing is "leaving", and past rows would all count)
  const leaving = includePast ? 0 : kept.filter((d) => new Date(d.departure).getTime() < now.getTime()).length
  const upcoming = show ? kept.slice(0, show + leaving) : kept
  // Which rows were already on screen (to animate only the new ones)
  const seen = useRef(new Set<string>())
  // The side each new row slid in from, kept for the row's lifetime so a re-render mid-animation doesn't cut it
  const entered = useRef(new Map<string, 'top' | 'bottom'>())
  const firstSeen = upcoming.findIndex((d) => seen.current.has(rowKey(d)))
  useEffect(() => {
    for (const d of upcoming) seen.current.add(rowKey(d))
  })

  return (
    <section>
      {title === undefined && <h2 className="flex items-center gap-2 px-1 pb-heading text-xl font-bold">{t('departures.title')}</h2>}
      {title && <h2 className="flex items-center gap-2 px-1 pb-heading text-xl font-bold">{title}</h2>}
      <div className="overflow-hidden rounded-2xl bg-surface">
        {toolbar}
        {isPending ? (
          <div className="space-y-3 p-gutter">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-fill" />
            ))}
          </div>
        ) : error && upcoming.length === 0 ? (
          <p className="p-6 text-center text-secondary">
            {t('departures.loadError')}{' '}
            {onRetry && (
              <button type="button" className="font-medium text-accent" onClick={onRetry}>
                {t('common.retry')}
              </button>
            )}
          </p>
        ) : upcoming.length === 0 ? (
          <p className="p-6 text-center text-secondary">{empty ?? t('departures.empty')}</p>
        ) : (
          <ul className="divide-y divide-separator">
            {upcoming.map((d) => {
              const key = rowKey(d)
              // Rows that weren't there before slide in: from the top when earlier ones load, from below otherwise
              if (seen.current.size > 0 && !seen.current.has(key) && !entered.current.has(key))
                entered.current.set(key, firstSeen !== -1 && upcoming.indexOf(d) < firstSeen ? 'top' : 'bottom')
              const enter = entered.current.get(key)
              return <DepartureRow key={key} departure={d} now={now} mine={d.tripId === highlightTrip} autoHide={!includePast} enter={enter} />
            })}
          </ul>
        )}
        {!isPending && upcoming.length > 0 && footer}
      </div>
    </section>
  )
}

const rowKey = (d: Departure) => `${d.tripId}-${d.serviceDate}-${d.stopId}`

export function DepartureRow({
  departure: d,
  now,
  mine,
  autoHide = true,
  enter,
}: {
  departure: Departure
  now: Date
  mine?: boolean
  autoHide?: boolean
  /** Just added to the list: slide in from this side (transform + opacity only, so it runs on the GPU) */
  enter?: 'top' | 'bottom'
}) {
  const qc = useQueryClient()
  const t = useT()
  // An arrival (trip ends here) counts down to when it arrives
  const time = new Date(d.terminates ? d.arrival : d.departure)
  const delay = d.departureDelay ?? d.arrivalDelay
  const status = realtimeStatus(d.realtime, delay)
  const seconds = (time.getTime() - now.getTime()) / 1000
  // Just departed: count -1, -2… in plain text, faded; then collapse away
  const justLeft = seconds < 0 && seconds >= -60
  // Only when showing "Now": with a chosen time or your trip, nothing vanishes
  const collapsing = autoHide && seconds < -LINGER_S && seconds >= -60
  const left = seconds < -60
  const { value, unit } = left
    ? { value: String(Math.round(-seconds / 60)), unit: 'unit.minAgo' as const }
    : justLeft
      ? { value: `-${Math.ceil(-seconds)}`, unit: 'unit.sec' as const }
      : countdown(seconds)
  return (
    // grid-rows 1fr → 0fr animates the row's height down so the list slides up
    <li
      className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out ${collapsing ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr]'} ${
        enter === 'top' ? 'row-in-top' : enter === 'bottom' ? 'row-in-bottom' : ''
      }`}
    >
      <div className="min-h-0 overflow-hidden">
      <Link
        to={`/trips/${encodeURIComponent(d.tripId)}?date=${d.serviceDate}&from=${encodeURIComponent(d.stopId)}`}
        state={{ route: d.route, headsign: d.headsign } satisfies TripPreview}
        // Start loading the trip as the finger goes down; the click lands ~150 ms later
        onPointerDown={() => void prefetchTrip(qc, d.tripId, d.serviceDate)}
        className={`flex items-center gap-3 px-gutter py-row active:bg-fill ${left || justLeft ? 'opacity-45' : ''} ${mine ? 'bg-accent/10' : ''}`}
      >
        {d.route && <RouteBadge route={d.route} />}
        <div className="min-w-0 flex-1">
          {/* Accessibility/bike icons trail the destination inline, so row heights stay even */}
          {mine && <p className="text-[12px] font-semibold text-accent uppercase">{t('departures.yourTrip')}</p>}
          <p className="line-clamp-2 text-[17px] leading-snug font-medium">{d.headsign ?? '—'}</p>
          {/* Second line: the trip's marks, then the time: scheduled struck through when it differs, the real one coloured + live */}
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[15px] tabular-nums">
            {d.terminates && <span className="rounded-md bg-fill px-1.5 text-[12px] leading-[18px] font-semibold text-secondary uppercase">{t('departures.arrives')}</span>}
            {d.frontDoor && <MarkIcon mark="frontDoor" className="h-4 w-4 text-secondary" />}
            {d.onRequest && <MarkIcon mark="demand" className="h-4 w-4 text-secondary" />}
            {d.wheelchairAccessible === 'AVAILABLE' && <MarkIcon mark="lowFloor" className="h-4 w-4 text-secondary" />}
            {d.bikesAllowed === 'ALLOWED' && <BikeIcon className="h-4 w-4 text-secondary" aria-label={t('common.bikes')} />}
            {(status === 'late' || status === 'early') && (
              <span className="text-secondary line-through">{formatTime(new Date(time.getTime() - delay! * 1000))}</span>
            )}
            <span className={`flex items-center gap-0.5 ${statusColor[status]}`} title={t(statusLabel[status])}>
              {formatTime(time)}
              {status !== 'scheduled' && <LiveIcon className="h-3.5 w-3.5" aria-label={t(statusLabel[status])} />}
            </span>
          </p>
        </div>
        {/* Countdown stays plain (black, grey once gone); colour lives on the time line. Live mark in its own gutter. */}
        <div className={`relative min-w-14 pr-3.5 text-right ${left ? 'text-secondary' : 'text-label'}`}>
          {status !== 'scheduled' && !justLeft && !left && <LiveIcon className="absolute top-0 right-0 h-3 w-3 text-secondary" aria-hidden />}
          <p className="text-2xl leading-none font-bold tabular-nums">{value}</p>
          <p className="text-[11px] font-medium text-secondary">{t(unit)}</p>
        </div>
        <ChevronIcon className="h-4 w-4 shrink-0 text-secondary/60" />
      </Link>
      </div>
    </li>
  )
}

/** "Show more" row for the bottom of a departures card */
export function MoreButton({ onClick }: { onClick: () => void }) {
  const t = useT()
  return (
    <button type="button" onClick={onClick} className="w-full border-t border-separator py-3 text-[15px] font-medium text-accent active:bg-fill">
      {t('departures.more')}
    </button>
  )
}
