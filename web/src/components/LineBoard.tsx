import { Link } from 'react-router'
import type { Departure } from '../lib/api'
import { countdown } from '../lib/countdown'
import { useT } from '../lib/i18n'
import { realtimeStatus, statusColor } from '../lib/realtimeStatus'
import { formatTime } from '../lib/time'
import { useNow } from '../lib/useTimetable'
import { ChevronIcon, LiveIcon } from './Icons'
import RouteBadge from './RouteBadge'

/**
 * A stop group's departures as a board: one row per line + direction with its
 * next few times, ordered by whichever leaves first. Easy to find "your" line
 * at a big hub; tapping a row opens that line's departures from its platform.
 */
export default function LineBoard({ departures, stationPath }: { departures: Departure[]; stationPath: string }) {
  const t = useT()
  const now = useNow(5_000)
  const groups = new Map<string, Departure[]>()
  for (const d of departures) {
    if (new Date(d.departure).getTime() < now.getTime() - 30_000) continue
    const key = `${d.route?.shortName ?? d.route?.routeId}|${d.headsign}`
    const list = groups.get(key) ?? []
    list.push(d)
    groups.set(key, list)
  }
  const rows = [...groups.values()]

  const label = (d: Departure) => {
    const s = (new Date(d.departure).getTime() - now.getTime()) / 1000
    if (s >= 60 * 60) return formatTime(new Date(d.departure))
    if (s < 0) return '0'
    return countdown(s).value
  }

  return (
    <ul className="divide-y divide-separator">
      {rows.map((list) => {
        const first = list[0]
        const status = realtimeStatus(first.realtime, first.departureDelay)
        const s = (new Date(first.departure).getTime() - now.getTime()) / 1000
        const unit = s < 60 * 60 ? t(countdown(Math.max(0, s)).unit) : ''
        const to = `${stationPath}?from=${encodeURIComponent(first.stopId)}${first.route ? `&lines=${encodeURIComponent(first.route.routeId)}` : ''}`
        return (
          <li key={`${first.route?.routeId}|${first.headsign}`}>
            <Link to={to} className="flex items-center gap-3 px-gutter py-row active:bg-fill">
              {first.route && <RouteBadge route={first.route} />}
              <p className="line-clamp-2 min-w-0 flex-1 text-[17px] leading-snug font-medium">{first.headsign ?? '—'}</p>
              <p className="shrink-0 text-right tabular-nums">
                <span className={`inline-flex items-center gap-0.5 text-xl font-bold ${status === 'scheduled' ? '' : statusColor[status]}`}>
                  {label(first)}
                  {status !== 'scheduled' && <LiveIcon className="h-3 w-3" aria-hidden />}
                </span>
                {unit && <span className="ml-0.5 text-[13px] text-secondary">{unit}</span>}
                {list.slice(1).map((d) => (
                  <span key={d.tripId} className="ml-2 text-[15px] text-secondary">
                    {label(d)}
                  </span>
                ))}
              </p>
              <ChevronIcon className="h-4 w-4 shrink-0 text-secondary/60" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
