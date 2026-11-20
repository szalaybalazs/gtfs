import type { ReactNode } from 'react'
import type { TimetableEntry } from '../lib/api'
import { formatTime } from '../lib/time'
import { useNow, useTimetable } from '../lib/useTimetable'
import { LiveIcon, WheelchairIcon } from './Icons'


/** The next few departures from the selected stop, with a live countdown. */
export default function Departures({
  routeId,
  stopId,
  title = 'Departures',
  count = 4,
}: {
  routeId: string
  stopId: string
  title?: ReactNode
  count?: number
}) {
  const now = useNow(1_000)
  const query = useTimetable(routeId, stopId)
  const upcoming = (query.data?.timetable ?? [])
    .filter((e) => new Date(e.departure).getTime() >= now.getTime() - 30_000)
    .slice(0, count)

  return (
    <section>
      <h2 className="flex items-center gap-2 px-1 pb-2 text-xl font-bold">{title}</h2>
      <div className="overflow-hidden rounded-2xl bg-surface">
        {query.isPending ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-fill" />
            ))}
          </div>
        ) : query.isError && !query.data ? (
          <p className="p-6 text-center text-secondary">
            Couldn't load departures.{' '}
            <button type="button" className="font-medium text-accent" onClick={() => query.refetch()}>
              Retry
            </button>
          </p>
        ) : upcoming.length === 0 ? (
          <p className="p-6 text-center text-secondary">No more departures today from this stop.</p>
        ) : (
          <ul className="divide-y divide-separator">
            {upcoming.map((entry) => (
              <Row key={`${entry.tripId}-${entry.departure}`} entry={entry} now={now} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function Row({ entry, now }: { entry: TimetableEntry; now: Date }) {
  const time = new Date(entry.departure)
  const delay = entry.departureDelay ?? entry.arrivalDelay
  const live = entry.scheduleRelationship != null
  const shifted = delay != null && Math.abs(delay) >= 60
  const scheduled = shifted ? new Date(time.getTime() - delay * 1000) : null
  const seconds = Math.round((time.getTime() - now.getTime()) / 1000)

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-[17px]">
        {entry.wheelchairAccessible === 'AVAILABLE' && (
          <WheelchairIcon className="h-4 w-4 shrink-0 text-secondary" aria-label="Wheelchair accessible" />
        )}
        {scheduled && <span className="text-secondary line-through">{formatTime(scheduled)}</span>}
        <span
          className={`flex items-center gap-0.5 font-medium tabular-nums ${
            shifted && delay > 0 ? 'text-late' : live ? 'text-live' : ''
          }`}
        >
          {formatTime(time)}
          {live && <LiveIcon className="h-4 w-4" aria-label="Realtime" />}
        </span>
      </div>
      <Countdown seconds={seconds} />
    </li>
  )
}

/**
 * Under a minute: seconds. Under 10 minutes: m:ss, so the countdown visibly moves.
 * Further out, whole minutes are enough.
 */
function Countdown({ seconds }: { seconds: number }) {
  const s = Math.max(0, seconds)
  const [value, unit] =
    s < 60
      ? [String(s), 'sec']
      : s < 600
        ? [`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, 'min']
        : [String(Math.floor(s / 60)), 'min']
  return (
    <span className="min-w-14 text-right">
      <span className="block text-2xl leading-none font-bold tabular-nums">{value}</span>
      <span className="text-xs font-medium text-secondary">{unit}</span>
    </span>
  )
}
