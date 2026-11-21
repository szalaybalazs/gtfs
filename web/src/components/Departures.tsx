import { useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { Departure } from '../lib/api'
import { countdown } from '../lib/countdown'
import { useT } from '../lib/i18n'
import { prefetchTrip, type TripPreview } from '../lib/prefetch'
import { realtimeStatus, statusColor, statusLabel } from '../lib/realtimeStatus'
import { useNow } from '../lib/useTimetable'
import { BikeIcon, ChevronIcon, LiveIcon, WheelchairIcon } from './Icons'
import RouteBadge from './RouteBadge'
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
  departures: Departure[]
  isPending?: boolean
  error?: boolean
  onRetry?: () => void
  title?: ReactNode
  empty?: string
}) {
  const t = useT()
  const now = useNow(1_000)
  // Departed rows linger for 20 s (counting -1, -2…), collapsing from -15 s
  const upcoming = includePast ? departures : departures.filter((d) => new Date(d.departure).getTime() >= now.getTime() - 20_000)

  return (
    <section>
      {title === undefined && <h2 className="flex items-center gap-2 px-1 pb-2 text-xl font-bold">{t('departures.title')}</h2>}
      {title && <h2 className="flex items-center gap-2 px-1 pb-2 text-xl font-bold">{title}</h2>}
      <div className="overflow-hidden rounded-2xl bg-surface">
        {toolbar}
        {isPending ? (
          <div className="space-y-3 p-4">
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
            {upcoming.map((d) => (
              <DepartureRow key={`${d.tripId}-${d.serviceDate}-${d.stopId}`} departure={d} now={now} mine={d.tripId === highlightTrip} autoHide={!includePast} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export function DepartureRow({ departure: d, now, mine, autoHide = true }: { departure: Departure; now: Date; mine?: boolean; autoHide?: boolean }) {
  const qc = useQueryClient()
  const t = useT()
  const time = new Date(d.departure)
  const status = realtimeStatus(d.realtime, d.departureDelay ?? d.arrivalDelay)
  const seconds = (time.getTime() - now.getTime()) / 1000
  // Just departed: count -1, -2… in plain text, faded; then collapse away
  const justLeft = seconds < 0 && seconds >= -60
  // Only when showing "Now": with a chosen time or your trip, nothing vanishes
  const collapsing = autoHide && seconds < -15 && seconds >= -60
  const left = seconds < -60
  const { value, unit } = left
    ? { value: String(Math.round(-seconds / 60)), unit: 'unit.minAgo' as const }
    : justLeft
      ? { value: `-${Math.ceil(-seconds)}`, unit: 'unit.sec' as const }
      : countdown(seconds)
  return (
    // grid-rows 1fr → 0fr animates the row's height down so the list slides up
    <li className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out ${collapsing ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr]'}`}>
      <div className="min-h-0 overflow-hidden">
      <Link
        to={`/trips/${encodeURIComponent(d.tripId)}?date=${d.serviceDate}&from=${encodeURIComponent(d.stopId)}`}
        state={{ route: d.route, headsign: d.headsign } satisfies TripPreview}
        // Start loading the trip as the finger goes down; the click lands ~150 ms later
        onPointerDown={() => void prefetchTrip(qc, d.tripId, d.serviceDate)}
        className={`flex items-center gap-3 px-4 py-3 active:bg-fill ${left || justLeft ? 'opacity-45' : ''} ${mine ? 'bg-accent/10' : ''}`}
      >
        {d.route && <RouteBadge route={d.route} />}
        <div className="min-w-0 flex-1">
          {/* Accessibility/bike icons trail the destination inline, so row heights stay even */}
          {mine && <p className="text-[12px] font-semibold text-accent uppercase">{t('departures.yourTrip')}</p>}
          <p className="line-clamp-2 text-[17px] leading-snug font-medium">
            {d.headsign ?? '—'}
            {d.wheelchairAccessible === 'AVAILABLE' && (
              <WheelchairIcon className="ml-1.5 inline h-3.5 w-3.5 align-[-1px] text-secondary opacity-70" aria-label={t('common.wheelchair')} />
            )}
            {d.bikesAllowed === 'ALLOWED' && (
              <BikeIcon className="ml-1 inline h-3.5 w-3.5 align-[-1px] text-secondary opacity-70" aria-label={t('common.bikes')} />
            )}
            {/* BKK legend marks for this trip: ① front door only, ☎ stops on request */}
            {d.frontDoor && <MarkIcon mark="frontDoor" className="ml-1.5 text-[14px] text-secondary" />}
            {d.onRequest && <MarkIcon mark="demand" className="ml-1 text-[14px] text-secondary" />}
          </p>
        </div>
        {/* Countdown only: colour says live/on time (green), early (purple), late (red) */}
        {/* Live icon sits in its own gutter so the number and unit share a right edge */}
        <div className={`relative min-w-14 pr-3.5 text-right ${left ? 'text-secondary' : justLeft ? 'text-label' : statusColor[status]}`} title={t(statusLabel[status])}>
          {status !== 'scheduled' && !justLeft && !left && <LiveIcon className="absolute top-0 right-0 h-3 w-3" aria-label={t(statusLabel[status])} />}
          <p className="text-2xl leading-none font-bold tabular-nums">{value}</p>
          <p className={`text-[11px] font-medium ${status === 'scheduled' ? 'text-secondary' : ''}`}>{t(unit)}</p>
        </div>
        <ChevronIcon className="h-4 w-4 shrink-0 text-secondary/60" />
      </Link>
      </div>
    </li>
  )
}
