import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { gql, TIMETABLE_QUERY, type RouteRef, type Timetable as TimetableData, type TimetableEntry } from '../lib/api'
import { lineColors } from '../lib/lineColors'
import { localParts } from '../lib/time'
import { REFRESH_MS, useNow } from '../lib/useTimetable'
import RouteBadge from './RouteBadge'

/** Show tomorrow as well when fewer than this many departures are left today. */
const FEW_LEFT_TODAY = 8

type Line = { route: RouteRef; stopId: string }
type Entry = TimetableEntry & { route: RouteRef; stopId: string }

/**
 * Classic hour/minute timetable for one or more lines at a stop, grouped by
 * day. With several lines, minutes are coloured per line (stable colours).
 */
export default function Timetable({ lines }: { lines: Line[] }) {
  const now = useNow(REFRESH_MS)
  const navigate = useNavigate()
  const queries = useQueries({
    queries: lines.map((line) => ({
      queryKey: ['timetable', line.route.routeId, line.stopId],
      queryFn: () => gql<TimetableData>(TIMETABLE_QUERY, { routeId: line.route.routeId, stopId: line.stopId }),
      refetchInterval: REFRESH_MS,
    })),
  })
  const pending = queries.some((q) => q.isPending)
  const failed = queries.length > 0 && queries.every((q) => q.isError)

  const entries = useMemo(() => {
    const all: Entry[] = []
    queries.forEach((q, i) => {
      for (const e of q.data?.timetable ?? []) all.push({ ...e, route: lines[i].route, stopId: lines[i].stopId })
    })
    return all.sort((a, b) => a.departure.localeCompare(b.departure))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queries.map((q) => q.dataUpdatedAt).join(), lines])

  const multi = lines.length > 1
  const colors = useMemo(() => lineColors(lines.map((l) => l.route.routeId)), [lines])

  const days = useMemo(() => {
    const today = localParts(now).date
    const upcoming = entries.filter((e) => new Date(e.departure).getTime() >= now.getTime() - 60_000)
    const byDay = new Map<string, Entry[]>()
    for (const e of upcoming) {
      const day = localParts(new Date(e.departure)).date
      byDay.set(day, [...(byDay.get(day) ?? []), e])
    }
    const keys = [...byDay.keys()].sort()
    const todayCount = byDay.get(today)?.length ?? 0
    const shown = todayCount >= FEW_LEFT_TODAY ? keys.filter((k) => k === today) : keys.slice(0, todayCount ? 2 : 1)
    return shown.map((day) => {
      const hours = new Map<string, Entry[]>()
      for (const e of byDay.get(day)!) {
        const h = localParts(new Date(e.departure)).hour
        hours.set(h, [...(hours.get(h) ?? []), e])
      }
      return { day, label: day === today ? 'Today' : 'Tomorrow', hours: [...hours.entries()] }
    })
  }, [entries, now])

  return (
    <section className="space-y-4">
      {multi && (
        <div className="flex flex-wrap gap-2 px-1">
          {lines.map((l) => (
            <span key={l.route.routeId} className="flex items-center gap-1.5 text-[13px]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.get(l.route.routeId) }} />
              <RouteBadge route={l.route} />
            </span>
          ))}
        </div>
      )}

      {pending ? (
        <div className="h-40 animate-pulse rounded-2xl bg-surface" />
      ) : failed ? (
        <p className="rounded-2xl bg-surface p-6 text-center text-secondary">
          Couldn't load the timetable.{' '}
          <button type="button" className="font-medium text-accent" onClick={() => queries.forEach((q) => q.refetch())}>
            Retry
          </button>
        </p>
      ) : days.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-center text-secondary">No departures today or tomorrow.</p>
      ) : (
        days.map(({ day, label, hours }) => (
          <div key={day}>
            <h3 className="px-1 pb-2 text-xl font-bold">{label}</h3>
            <ul className="divide-y divide-separator overflow-hidden rounded-2xl bg-surface">
              {hours.map(([hour, list]) => (
                <li key={hour} className="flex">
                  <span className="flex w-12 shrink-0 items-start justify-center bg-fill py-2.5 text-[17px] font-bold tabular-nums">
                    {hour}
                  </span>
                  <div className="flex flex-wrap gap-x-1 gap-y-1 px-2 py-2">
                    {list.map((e) => {
                      const minute = localParts(new Date(e.departure)).minute
                      return (
                        <button
                          key={`${e.tripId}-${e.departure}`}
                          type="button"
                          onClick={() =>
                            navigate(
                              `/trips/${encodeURIComponent(e.tripId)}?date=${e.serviceDate ?? ''}&from=${encodeURIComponent(e.stopId)}`,
                            )
                          }
                          className={`min-w-9 rounded-lg px-1.5 py-1 text-[17px] tabular-nums active:bg-fill ${
                            e.isNext ? 'bg-fill font-bold' : ''
                          }`}
                          style={multi ? { color: colors.get(e.route.routeId) } : undefined}
                          aria-label={`${e.route.shortName ?? ''} ${hour}:${minute}`}
                        >
                          {minute}
                          {e.scheduleRelationship != null && <span className="text-xs align-super">'</span>}
                        </button>
                      )
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}
