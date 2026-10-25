import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { gql, TIMETABLE_QUERY, type Timetable as TimetableData, type TimetableEntry } from '../lib/api'
import { formatDelay, formatTime, hourKey, localParts } from '../lib/time'
import { BikeIcon, RefreshIcon, WheelchairIcon } from './Icons'

const HOURS = 24
const REFRESH_MS = 30_000

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export default function Timetable({ routeId, stopId }: { routeId: string; stopId: string }) {
  const now = useNow(REFRESH_MS)
  const [selected, setSelected] = useState<TimetableEntry | null>(null)

  const query = useQuery({
    queryKey: ['timetable', routeId, stopId],
    queryFn: () => gql<TimetableData>(TIMETABLE_QUERY, { routeId, stopId }),
    refetchInterval: REFRESH_MS,
    placeholderData: (prev, prevQuery) =>
      prevQuery?.queryKey[1] === routeId ? prev : undefined,
  })

  const byHour = useMemo(() => {
    const groups = new Map<string, TimetableEntry[]>()
    for (const entry of query.data?.timetable ?? []) {
      const key = hourKey(new Date(entry.arrival))
      groups.set(key, [...(groups.get(key) ?? []), entry])
    }
    return groups
  }, [query.data])

  // One row per hour for the next 24 hours, starting with the current one.
  const rows = useMemo(
    () =>
      Array.from({ length: HOURS }, (_, offset) => {
        const time = new Date(now.getTime() + offset * 3_600_000)
        return { key: hourKey(time), id: offset, hour: localParts(time).hour }
      }),
    [now],
  )

  const next = query.data?.timetable.find((e) => e.isNext)
  const minutesUntilNext = next ? Math.max(0, Math.round((new Date(next.arrival).getTime() - now.getTime()) / 60_000)) : null

  return (
    <section>
      <div className="flex items-end justify-between px-4 pb-1.5">
        <h2 className="text-[13px] text-secondary uppercase">Timetable</h2>
        <span className="flex items-center gap-1.5 text-[13px] text-secondary">
          {next && (
            <span>
              Next <span className="font-mono font-medium text-label">{formatTime(new Date(next.arrival))}</span>
              {minutesUntilNext !== null && ` · ${minutesUntilNext === 0 ? 'now' : `in ${minutesUntilNext} min`}`}
            </span>
          )}
          <RefreshIcon className={`h-3.5 w-3.5 ${query.isFetching ? 'animate-spin' : 'opacity-0'}`} />
        </span>
      </div>

      <div className={`overflow-hidden rounded-xl bg-surface transition-opacity ${query.isPlaceholderData ? 'opacity-60' : ''}`}>
        {query.isError && !query.data ? (
          <p className="p-6 text-center text-secondary">
            Couldn't load the timetable.{' '}
            <button type="button" className="text-accent" onClick={() => query.refetch()}>
              Retry
            </button>
          </p>
        ) : (
          <ul className="divide-y divide-separator">
            {rows.map(({ key, id, hour }) => {
              const events = byHour.get(key) ?? []
              return (
                <li key={id} className="flex min-h-11 items-center gap-2 pl-4">
                  <span className="w-6 shrink-0 text-[15px] font-semibold text-secondary tabular-nums">{hour}</span>
                  {query.isPending ? (
                    <span className="h-3 w-24 animate-pulse rounded bg-fill" />
                  ) : events.length === 0 ? (
                    <span className="px-2 text-xs text-secondary">No departures</span>
                  ) : (
                    <div className="flex flex-wrap gap-1 py-2 pr-4">
                      {events.map((event) => (
                        <Minute key={`${event.tripId}-${event.arrival}`} event={event} onSelect={setSelected} />
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <p className="px-4 pt-1.5 text-[13px] text-secondary">
        <span className="underline decoration-secondary underline-offset-2">Underlined</span> departures are
        wheelchair accessible. <span className="font-mono">'</span> marks realtime data.
      </p>

      {selected && <EntrySheet entry={selected} onClose={() => setSelected(null)} />}
    </section>
  )
}

function Minute({ event, onSelect }: { event: TimetableEntry; onSelect: (e: TimetableEntry) => void }) {
  const realtime = event.scheduleRelationship != null
  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      className={`flex items-center rounded-lg py-[3px] pl-1.5 font-mono text-[15px] font-medium active:bg-fill ${
        realtime ? 'pr-0.5' : 'pr-1.5'
      } ${event.isNext ? 'bg-fill text-label' : ''} ${event.isPast ? 'text-secondary' : 'text-label'}`}
    >
      <span
        className={
          event.wheelchairAccessible === 'AVAILABLE' ? 'underline decoration-secondary underline-offset-2' : ''
        }
      >
        {localParts(new Date(event.arrival)).minute}
      </span>
      {realtime && <span>'</span>}
    </button>
  )
}

function EntrySheet({ entry, onClose }: { entry: TimetableEntry; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const arrival = new Date(entry.arrival)
  const departure = new Date(entry.departure)
  const delay = entry.arrivalDelay ?? entry.departureDelay
  const scheduled = delay != null ? new Date(arrival.getTime() - delay * 1000) : null

  const rows: [string, React.ReactNode][] = [
    ['Arrival', formatTime(arrival)],
    ['Departure', formatTime(departure)],
  ]
  if (scheduled && delay) rows.push(['Scheduled', formatTime(scheduled)])
  rows.push([
    'Status',
    entry.scheduleRelationship == null ? 'Scheduled (no realtime data)' : delay != null ? formatDelay(delay) : 'Realtime',
  ])
  rows.push([
    'Accessibility',
    <span className="flex items-center gap-3">
      <span className={`flex items-center gap-1 ${entry.wheelchairAccessible === 'AVAILABLE' ? '' : 'opacity-40'}`}>
        <WheelchairIcon className="h-4 w-4" />
        {entry.wheelchairAccessible === 'AVAILABLE' ? 'Yes' : entry.wheelchairAccessible === 'UNAVAILABLE' ? 'No' : '?'}
      </span>
      <span className={`flex items-center gap-1 ${entry.bikesAllowed === 'ALLOWED' ? '' : 'opacity-40'}`}>
        <BikeIcon className="h-4 w-4" />
        {entry.bikesAllowed === 'ALLOWED' ? 'Yes' : entry.bikesAllowed === 'NOT_ALLOWED' ? 'No' : '?'}
      </span>
    </span>,
  ])
  rows.push(['Trip', <span className="font-mono text-xs">{entry.tripId}</span>])

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/30 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-t-2xl bg-canvas p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            <span className="font-mono">{formatTime(arrival)}</span>
            {entry.isNext && <span className="ml-2 text-sm font-normal text-secondary">next</span>}
          </h3>
          <button type="button" onClick={onClose} className="text-[17px] text-accent">
            Done
          </button>
        </div>
        <dl className="divide-y divide-separator rounded-xl bg-surface">
          {rows.map(([label, value]) => (
            <div key={label} className="flex min-h-11 items-center justify-between gap-4 px-4 py-2">
              <dt className="text-[15px]">{label}</dt>
              <dd className="text-right text-[15px] text-secondary">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
