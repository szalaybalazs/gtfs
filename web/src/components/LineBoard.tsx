import { useLayoutEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { Departure } from '../lib/api'
import { compareLines } from '../lib/categories'
import { countdown } from '../lib/countdown'
import { useT } from '../lib/i18n'
import { realtimeStatus } from '../lib/realtimeStatus'
import { formatTime } from '../lib/time'
import { useNow } from '../lib/useTimetable'
import { ChevronIcon, LiveIcon } from './Icons'
import RouteBadge from './RouteBadge'

/** Departed times count on (-1… -10 s), then drop; same as the departures list */
const LINGER_S = 10

/**
 * A stop group's departures as a board: one row per line + direction, metro
 * first, then tram, trolleybus, bus, … and by line number within each. Each
 * row looks like a departure row (next departure big, the following ones
 * smaller beside it); tapping it opens that line's departures from its platform.
 */
export default function LineBoard({
  departures,
  stationPath,
  reference,
}: {
  departures: Departure[]
  stationPath: string
  /** Count from this time instead of now (a chosen time): everything shows, earlier ones as "N min before" */
  reference?: Date | null
}) {
  const live = useNow(1_000)
  const now = reference ?? live
  // Only times shown while still to come may count on after leaving; one already gone when it loaded never shows
  const shownUpcoming = useRef(new Set<string>())
  const groups = new Map<string, Departure[]>()
  for (const d of departures) {
    const at = new Date(d.terminates ? d.arrival : d.departure).getTime()
    if (!reference && at < now.getTime() && !shownUpcoming.current.has(d.tripId)) continue
    if (!reference && at < now.getTime() - LINGER_S * 1000) continue
    if (at >= now.getTime()) shownUpcoming.current.add(d.tripId)
    // Arrivals get their own row, apart from the same line leaving
    const key = `${d.route?.routeId}|${d.headsign}|${d.terminates ? 'arr' : 'dep'}`
    const list = groups.get(key) ?? []
    // A trip calling at two platforms of the group counts once (its first stop here)
    if (list.some((x) => x.tripId === d.tripId)) continue
    list.push(d)
    groups.set(key, list)
  }
  const rows = [...groups.entries()].sort(
    ([, a], [, b]) =>
      compareLines(a[0].route ?? {}, b[0].route ?? {}) ||
      (a[0].headsign ?? '').localeCompare(b[0].headsign ?? '', 'hu'),
  )

  return (
    <ul className="divide-y divide-separator">
      {rows.map(([key, list]) => (
        <BoardRow key={key} list={list} fixed={!!reference} now={now} stationPath={stationPath} />
      ))}
    </ul>
  )
}

function BoardRow({ list, now, stationPath, fixed }: { list: Departure[]; now: Date; stationPath: string; fixed: boolean }) {
  const t = useT()
  const d = list[0]
  const shown = list.slice(0, 4)
  const boxes = useRef(new Map<string, HTMLDivElement>())
  // When the first one leaves, the others slide over to their new places and the next one grows into
  // the big slot (FLIP: measure, jump back with a transform, then let the transform go; GPU only)
  const last = useRef(new Map<string, { right: number; height: number }>())
  const order = shown.map((n) => n.tripId).join()
  useLayoutEffect(() => {
    const next = new Map<string, { right: number; height: number }>()
    for (const [id, el] of boxes.current) next.set(id, { right: el.offsetLeft + el.offsetWidth, height: el.offsetHeight })
    for (const [id, el] of boxes.current) {
      const was = last.current.get(id)
      const is = next.get(id)!
      if (!was || !is.height || (Math.abs(was.right - is.right) < 1 && was.height === is.height)) continue
      el.style.transition = 'none'
      el.style.transformOrigin = 'right center'
      el.style.transform = `translateX(${was.right - is.right}px) scale(${was.height / is.height})`
      void el.offsetWidth
      el.style.transition = 'transform 450ms cubic-bezier(0.2, 0.8, 0.2, 1)'
      el.style.transform = ''
    }
    last.current = next
  }, [order])
  // The chosen time (?after / ?at / ?earlier) carries over, so the line's own list counts from it too
  const [params] = useSearchParams()
  const carry = ['after', 'at', 'earlier'].map((k) => (params.get(k) ? `&${k}=${encodeURIComponent(params.get(k)!)}` : '')).join('')
  const to = `${stationPath}?from=${encodeURIComponent(d.stopId)}${d.route ? `&lines=${encodeURIComponent(d.route.routeId)}` : ''}${carry}`
  return (
    <li>
      <Link to={to} className="flex items-center gap-2.5 px-gutter py-row active:bg-fill">
        {d.route && <RouteBadge route={d.route} />}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[17px] leading-snug font-medium">{d.headsign ?? '—'}</p>
          {/* No exact time or marks here: tapping the row shows them */}
          {d.terminates && (
            <span className="mt-0.5 inline-block rounded-md bg-fill px-1.5 text-[12px] leading-[18px] font-semibold text-secondary uppercase">{t('departures.arrives')}</span>
          )}
        </div>
        {/* The next departure big, then the following ones smaller to its right. How many depends only on
            the screen (two more on a phone, three from 640 px), and the columns have fixed widths so they line up.
            One list keyed by trip, so a time keeps its element as it moves from small to big */}
        <div className="flex shrink-0 items-center gap-3">
          {shown.map((n, i) => (
            <div key={n.tripId} ref={(el) => void (el ? boxes.current.set(n.tripId, el) : boxes.current.delete(n.tripId))} className={i === 3 ? 'hidden sm:block' : ''}>
              <Countdown d={n} now={now} small={i > 0} fixed={fixed} />
            </div>
          ))}
          {/* Empty columns when a line has fewer coming, so the big times stay lined up */}
          {Array.from({ length: 4 - shown.length }, (_, i) => (
            <div key={`pad${i}`} aria-hidden className={`w-9 ${shown.length + i === 3 ? 'hidden sm:block' : ''}`} />
          ))}
        </div>
        <ChevronIcon className="h-4 w-4 shrink-0 text-secondary/60" />
      </Link>
    </li>
  )
}

/** Minutes / seconds until a departure, negative seconds just after it leaves; the live mark in its own corner */
/**
 * One countdown column. Fixed width, so every row lines up; nothing may overflow it:
 * - under an hour: minutes / ½ minutes / seconds at full size ("59", "2½", "-10")
 * - an hour or more either way (sparse lines, far "Earlier" rows): the clock time, set smaller to fit
 * - the live mark sits just after the number, in the gap between columns
 */
export function Countdown({
  d,
  now,
  small = false,
  fixed = false,
  inline = false,
}: {
  d: Departure
  now: Date
  small?: boolean
  fixed?: boolean
  /** In a flowing row next to a badge (favourites): natural width instead of a fixed column */
  inline?: boolean
}) {
  const t = useT()
  const at = new Date(d.terminates ? d.arrival : d.departure)
  const seconds = (at.getTime() - now.getTime()) / 1000
  const left = seconds < 0
  const live = realtimeStatus(d.realtime, d.departureDelay ?? d.arrivalDelay) !== 'scheduled'
  const clock = Math.abs(seconds) >= 60 * 60
  const { value, unit } = clock
    ? { value: formatTime(at), unit: null }
    : left && fixed
      ? { value: `-${Math.ceil(-seconds / 60)}`, unit: 'unit.min' as const }
      : left
        ? { value: `-${Math.ceil(-seconds)}`, unit: 'unit.sec' as const }
        : countdown(seconds)
  const size = clock && !inline ? (small ? 'text-[12px]' : 'text-[15px]') : small ? 'text-[16px]' : 'text-2xl'
  return (
    <div className={`text-right whitespace-nowrap ${inline ? 'text-label' : small ? 'w-9 text-secondary' : 'w-11 text-label'} ${left ? 'opacity-45' : ''}`}>
      {/* Same line height for clock times and countdowns, so the unit lines stay level */}
      <p className={`relative flex items-end justify-end font-bold tabular-nums ${small ? 'h-4' : 'h-6'} leading-none ${size}`}>
        <span data-value>{value}</span>
        {/* Live mark right after the number, hanging into the gap between columns so it never shifts the digits */}
        {live && !left && <LiveIcon className={`absolute top-0 -right-2.5 text-secondary ${small ? 'h-2 w-2' : 'h-2.5 w-2.5'}`} aria-hidden />}
      </p>
      <p className={`flex items-center justify-end gap-0.5 font-medium text-secondary ${small ? 'text-[10px]' : 'text-[11px]'}`}>
        {unit ? t(unit) : '\u00a0'}
      </p>
    </div>
  )
}
