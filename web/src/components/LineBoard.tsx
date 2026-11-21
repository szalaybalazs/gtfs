import { Link } from 'react-router'
import type { Departure } from '../lib/api'
import { compareLines } from '../lib/categories'
import { countdown } from '../lib/countdown'
import { useT } from '../lib/i18n'
import { realtimeStatus, statusColor, statusLabel } from '../lib/realtimeStatus'
import { formatTime } from '../lib/time'
import { useNow } from '../lib/useTimetable'
import { BikeIcon, ChevronIcon, LiveIcon } from './Icons'
import { MarkIcon } from './LineMarks'
import RouteBadge from './RouteBadge'

/** Departed times show (-1… -5 s) only briefly here; the board is about what comes next */
const LINGER_S = 5

/**
 * A stop group's departures as a board: one row per line + direction, metro
 * first, then tram, trolleybus, bus, … and by line number within each. Each
 * row looks like a departure row (next departure big, the following ones
 * smaller beside it); tapping it opens that line's departures from its platform.
 */
export default function LineBoard({ departures, stationPath }: { departures: Departure[]; stationPath: string }) {
  const now = useNow(1_000)
  const groups = new Map<string, Departure[]>()
  for (const d of departures) {
    if (new Date(d.terminates ? d.arrival : d.departure).getTime() < now.getTime() - LINGER_S * 1000) continue
    // Arrivals get their own row, apart from the same line leaving
    const key = `${d.route?.routeId}|${d.headsign}|${d.terminates ? 'arr' : 'dep'}`
    const list = groups.get(key) ?? []
    list.push(d)
    groups.set(key, list)
  }
  const rows = [...groups.values()].sort(
    (a, b) =>
      compareLines(a[0].route ?? {}, b[0].route ?? {}) ||
      (a[0].headsign ?? '').localeCompare(b[0].headsign ?? '', 'hu'),
  )

  return (
    <ul className="divide-y divide-separator">
      {rows.map((list) => (
        <BoardRow key={`${list[0].route?.routeId}|${list[0].headsign}`} list={list} now={now} stationPath={stationPath} />
      ))}
    </ul>
  )
}

function BoardRow({ list, now, stationPath }: { list: Departure[]; now: Date; stationPath: string }) {
  const t = useT()
  const d = list[0]
  // A trip ending here (Arrivals on) counts down to its arrival
  const time = new Date(d.terminates ? d.arrival : d.departure)
  const delay = d.departureDelay ?? d.arrivalDelay
  const status = realtimeStatus(d.realtime, delay)
  const to = `${stationPath}?from=${encodeURIComponent(d.stopId)}${d.route ? `&lines=${encodeURIComponent(d.route.routeId)}` : ''}`
  return (
    <li>
      <Link to={to} className="flex items-center gap-2.5 px-gutter py-row active:bg-fill">
        {d.route && <RouteBadge route={d.route} />}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[17px] leading-snug font-medium">{d.headsign ?? '—'}</p>
          {/* Same second line as a departure row: marks, then the time (scheduled struck through when it differs) */}
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
        {/* The next departure big (as on a departure row), then the following ones smaller to its right:
            one more on narrow screens, up to three when there's room */}
        {/* Kept tight so the next one plus two more fit on a phone */}
        <div className="-mr-1 flex shrink-0 items-center gap-0.5">
          <Countdown d={d} now={now} />
          {list.slice(1, 4).map((n, i) => (
            <Countdown key={n.tripId} d={n} now={now} small className={i === 2 ? 'hidden sm:block' : ''} />
          ))}
        </div>
        <ChevronIcon className="h-4 w-4 shrink-0 text-secondary/60" />
      </Link>
    </li>
  )
}

/** Minutes / seconds until a departure, negative seconds just after it leaves; the live mark in its own corner */
function Countdown({ d, now, small = false, className = '' }: { d: Departure; now: Date; small?: boolean; className?: string }) {
  const t = useT()
  const seconds = (new Date(d.terminates ? d.arrival : d.departure).getTime() - now.getTime()) / 1000
  const left = seconds < 0
  const live = realtimeStatus(d.realtime, d.departureDelay ?? d.arrivalDelay) !== 'scheduled'
  // An hour or more away: the clock time reads better than "74 min"
  const far = seconds >= 60 * 60
  const { value, unit } = left
    ? { value: `-${Math.ceil(-seconds)}`, unit: 'unit.sec' as const }
    : far
      ? { value: formatTime(new Date(Date.now() + seconds * 1000)), unit: null }
      : countdown(seconds)
  return (
    <div className={`relative text-right ${className} ${small ? 'min-w-6 pr-1.5 text-secondary' : 'min-w-9 pr-2.5 text-label'} ${left ? 'opacity-45' : ''}`}>
      {live && !left && <LiveIcon className={`absolute top-0 right-0 text-secondary ${small ? 'h-2.5 w-2.5' : 'h-3 w-3'}`} aria-hidden />}
      <p className={`leading-none font-bold tabular-nums ${small ? 'text-[16px]' : 'text-2xl'}`}>{value}</p>
      <p className={`font-medium text-secondary ${small ? 'text-[10px]' : 'text-[11px]'}`}>{unit ? t(unit) : '\u00a0'}</p>
    </div>
  )
}
