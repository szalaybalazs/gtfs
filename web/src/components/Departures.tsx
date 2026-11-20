import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { Departure } from '../lib/api'
import { countdown } from '../lib/countdown'
import { realtimeStatus, statusColor, statusLabel } from '../lib/realtimeStatus'
import { useNow } from '../lib/useTimetable'
import { BikeIcon, ChevronIcon, LiveIcon, WheelchairIcon } from './Icons'
import RouteBadge from './RouteBadge'

/**
 * Departures as tappable rows: line badge, destination, countdown with the
 * exact time under it. Tapping opens that trip.
 */
export default function Departures({
  departures,
  isPending,
  error,
  onRetry,
  title = 'Departures',
  empty = 'No more departures in the next few hours.',
  toolbar,
}: {
  /** Shown at the top of the card, e.g. the time filter. */
  toolbar?: ReactNode
  departures: Departure[]
  isPending?: boolean
  error?: boolean
  onRetry?: () => void
  title?: ReactNode
  empty?: string
}) {
  const now = useNow(1_000)
  const upcoming = departures.filter((d) => new Date(d.departure).getTime() >= now.getTime() - 30_000)

  return (
    <section>
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
            Couldn't load departures.{' '}
            {onRetry && (
              <button type="button" className="font-medium text-accent" onClick={onRetry}>
                Retry
              </button>
            )}
          </p>
        ) : upcoming.length === 0 ? (
          <p className="p-6 text-center text-secondary">{empty}</p>
        ) : (
          <ul className="divide-y divide-separator">
            {upcoming.map((d) => (
              <DepartureRow key={`${d.tripId}-${d.serviceDate}-${d.stopId}`} departure={d} now={now} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export function DepartureRow({ departure: d, now }: { departure: Departure; now: Date }) {
  const time = new Date(d.departure)
  const status = realtimeStatus(d.realtime, d.departureDelay ?? d.arrivalDelay)
  const { value, unit } = countdown((time.getTime() - now.getTime()) / 1000)

  return (
    <li>
      <Link
        to={`/trips/${encodeURIComponent(d.tripId)}?date=${d.serviceDate}&from=${encodeURIComponent(d.stopId)}`}
        className="flex items-center gap-3 px-4 py-3 active:bg-fill"
      >
        {d.route && <RouteBadge route={d.route} />}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[17px] leading-snug font-medium">{d.headsign ?? '—'}</p>
          {/* Secondary details: quieter, after the main info */}
          {(d.wheelchairAccessible === 'AVAILABLE' || d.bikesAllowed === 'ALLOWED') && (
            <p className="mt-0.5 flex items-center gap-1.5 text-secondary">
              {d.wheelchairAccessible === 'AVAILABLE' && <WheelchairIcon className="h-3.5 w-3.5 opacity-70" aria-label="Wheelchair accessible" />}
              {d.bikesAllowed === 'ALLOWED' && <BikeIcon className="h-3.5 w-3.5 opacity-70" aria-label="Bikes allowed" />}
            </p>
          )}
        </div>
        {/* Countdown only: colour says live/on time (green), early (purple), late (red) */}
        <div className={`min-w-14 text-right ${statusColor[status]}`} title={statusLabel[status]}>
          <p className="flex items-start justify-end gap-0.5 text-2xl leading-none font-bold tabular-nums">
            {value}
            {status !== 'scheduled' && <LiveIcon className="h-3 w-3" aria-label={statusLabel[status]} />}
          </p>
          <p className={`text-[11px] font-medium ${status === 'scheduled' ? 'text-secondary' : ''}`}>{unit}</p>
        </div>
        <ChevronIcon className="h-4 w-4 shrink-0 text-secondary/60" />
      </Link>
    </li>
  )
}
