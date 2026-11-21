import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router'
import { DEPARTURES_QUERY, gql, type Departures } from '../lib/api'
import { intlLocale, useT } from '../lib/i18n'
import Wheel, { WHEEL_HEIGHT } from './Wheel'
import { formatTime, localParts, TIME_ZONE } from '../lib/time'
import { ClockIcon } from './Icons'

/**
 * The departures window, kept in the URL so it survives back/forward:
 * ?after=HH:MM  a chosen time (earlier than now = tomorrow)
 * ?after=YYYY-MM-DDTHH:MM  a chosen day and time (the picker's second step)
 * ?at=ISO       arrived from a trip: start at that trip's time here
 * ?earlier=ISO  "⋯ Earlier": start at the departure just before the list (one more row per tap)
 */
export function useAfter() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('after')
  const at = params.get('at')
  const earlierRaw = params.get('earlier')
  const earlierDate = earlierRaw ? new Date(earlierRaw) : null
  const earlier = earlierDate && !Number.isNaN(earlierDate.getTime()) ? earlierDate : null
  const atDate = at ? new Date(at) : null
  const picked =
    raw && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)
      ? budapestTime(raw.slice(11), raw.slice(0, 10))
      : raw && /^\d{2}:\d{2}$/.test(raw)
        ? budapestTime(raw)
        : atDate && !Number.isNaN(atDate.getTime())
          ? atDate
          : null

  const update = (changes: Record<string, string | null>) =>
    setParams(
      (p) => {
        for (const [k, v] of Object.entries(changes)) v == null ? p.delete(k) : p.set(k, v)
        return p
      },
      { replace: true },
    )

  // Rounded down to the minute so the value (and the query key built from it)
  // stays stable across renders; otherwise "⋯ Earlier" refetches on every render
  const base = earlier ?? picked
  const start = base ? new Date(Math.floor(base.getTime() / 60_000) * 60_000) : null
  return {
    /** Window start for the API; null = now */
    after: start,
    /** The chosen time (or the trip's time), not counting "earlier" */
    picked,
    earlier,
    setTime: (hhmm: string | null) => update({ after: hhmm, at: null, earlier: null }),
    /** Start the list at this (earlier) departure */
    loadEarlier: (at: Date) => update({ earlier: at.toISOString() }),
  }
}

/** HH:MM in Budapest time on `day` (YYYY-MM-DD), or today/tomorrow when no day is given, as an absolute Date. */
function budapestTime(hhmm: string, day?: string) {
  const now = new Date()
  const today = day ?? localParts(now).date
  const offsetMin = Math.round(
    (new Date(now.toLocaleString('en-US', { timeZone: TIME_ZONE })).getTime() -
      new Date(now.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()) /
      60_000,
  )
  const [h, m] = hhmm.split(':').map(Number)
  const utc = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10), h, m) - offsetMin * 60_000
  return new Date(!day && utc < now.getTime() - 60_000 ? utc + 86_400_000 : utc)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** The next week of days, as YYYY-MM-DD in Budapest time. */
function nextDays(n: number) {
  return Array.from({ length: n }, (_, i) => localParts(new Date(Date.now() + i * 86_400_000)).date)
}

/**
 * Departures-header control: clock icon + "Now" or the chosen time. Opens a
 * centred sheet with iOS-style hour and minute wheels; the day is a second,
 * collapsed step (today is by far the common case).
 */
export function TimeControl() {
  const t = useT()
  const { picked, after, setTime } = useAfter()
  const [open, setOpen] = useState(false)
  const [h, setH] = useState(0)
  const [m, setM] = useState(0)
  const [day, setDay] = useState(() => nextDays(1)[0])
  const [pickDay, setPickDay] = useState(false)
  const days = nextDays(7)
  const dayLabel = (d: string) =>
    d === days[0]
      ? t('alerts.today')
      : d === days[1]
        ? t('alerts.tomorrow')
        : new Date(`${d}T12:00:00`).toLocaleDateString(intlLocale(), { weekday: 'long', month: 'short', day: 'numeric' })

  const show = () => {
    const p = localParts(picked ?? new Date())
    setH(+p.hour)
    setM(+p.minute)
    setDay(picked ? p.date : days[0])
    setPickDay(false)
    setOpen(true)
  }
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  const choose = (value: string | null) => {
    setTime(value)
    setOpen(false)
  }
  const hhmm = `${pad(h)}:${pad(m)}`
  const label = after
    ? localParts(after).date !== days[0]
      ? `${dayLabel(localParts(after).date)}, ${t('after.from', { time: formatTime(after) })}`
      : t('after.from', { time: formatTime(after) })
    : t('after.now')

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        className={`-ml-1.5 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[15px] font-semibold active:opacity-50 ${after ? 'text-accent' : ''}`}
      >
        <ClockIcon className="h-5 w-5" />
        <span className="tabular-nums">{label}</span>
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/30 p-6" onClick={() => setOpen(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t('after.dialog')}
              className="sheet-up w-full max-w-[320px] rounded-3xl bg-surface p-gutter shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="pb-1 text-center text-[13px] font-semibold text-secondary">{t('after.dialog')}</p>

              {/* The wheels: a grey band marks the selected row, like iOS */}
              <div className="relative mx-auto flex w-56" style={{ height: WHEEL_HEIGHT }}>
                <div className="pointer-events-none absolute inset-x-0 top-1/2 h-9 -translate-y-1/2 rounded-lg bg-fill" />
                <div className="flex-1">
                  <Wheel count={24} value={h} onChange={setH} label={t('after.hour')} align="right" />
                </div>
                <div className="pointer-events-none z-10 flex items-center px-1 text-[23px] font-medium">:</div>
                <div className="flex-1">
                  <Wheel count={60} value={m} onChange={setM} label={t('after.minute')} align="left" />
                </div>
              </div>

              {/* Second step, rarely needed: another day */}
              <button
                type="button"
                onClick={() => setPickDay((v) => !v)}
                aria-expanded={pickDay}
                className="mt-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-[15px] active:bg-fill"
              >
                <span className="text-secondary">{t('after.day')}</span>
                <span className="font-medium">
                  {dayLabel(day)} <span className="text-secondary">{pickDay ? '▴' : '▾'}</span>
                </span>
              </button>
              {pickDay && (
                <div className="flex flex-wrap gap-1.5 px-1 pb-1">
                  {days.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDay(d)}
                      className={`rounded-full px-3 py-1 text-[13px] font-medium ${d === day ? 'bg-accent text-white' : 'bg-fill'}`}
                    >
                      {dayLabel(d)}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => choose(null)} className="flex-1 rounded-xl bg-fill py-2.5 font-medium active:opacity-60">
                  {t('after.now')}
                </button>
                <button
                  type="button"
                  // Always with the day: a bare HH:MM that's already past would roll over to tomorrow
                  onClick={() => choose(`${day}T${hhmm}`)}
                  className="flex-1 rounded-xl bg-accent py-2.5 font-semibold text-white active:opacity-80"
                >
                  {t('after.show')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

/** Header row of a departures card: the time picker (Now / From HH:MM) and "⋯ Earlier". */
export default function AfterFilter({
  stopIds,
  routeIds = null,
  extra,
  hideEarlier = false,
}: {
  /** No "Earlier" (e.g. on the per-line board, which only looks ahead) */
  hideEarlier?: boolean
  stopIds: string[]
  routeIds?: string[] | null
  /** More controls next to "Earlier" (e.g. the arrivals switch) */
  extra?: ReactNode
}) {
  const t = useT()
  const { after, loadEarlier } = useAfter()
  const [busy, setBusy] = useState(false)

  // Reset when the stops or the start change (the button may have something to show again)
  const key = `${stopIds.join(',')}|${(routeIds ?? []).join(',')}|${after?.getTime() ?? ''}`
  const [noneFor, setNoneFor] = useState<string | null>(null)
  const none = noneFor === key

  // Find the last departure before what's on screen and start there: exactly one more row per tap.
  // The list already shows from 60 s before its start, so look before that; try short windows first so
  // a busy stop group can't hit the row limit and skip the real predecessor.
  const earlier = async () => {
    if (busy || stopIds.length === 0) return
    setBusy(true)
    const start = after ?? new Date(Math.floor(Date.now() / 60_000) * 60_000)
    const edge = start.getTime() - 60_000
    try {
      for (const minutes of [15, 60, 180]) {
        const from = new Date(edge - minutes * 60_000)
        const data = await gql<Departures>(DEPARTURES_QUERY, { stopIds, routeIds, limit: 200, hours: Math.ceil(minutes / 60), after: from.toISOString() })
        const before = data.departures.map((d) => new Date(d.departure).getTime()).filter((ts) => ts < edge)
        if (before.length) {
          loadEarlier(new Date(Math.max(...before)))
          return
        }
      }
      setNoneFor(key)
    } catch {
      // Network hiccup: leave the list as it is
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-separator px-gutter py-2.5 text-[15px]">
      <TimeControl />
      <span className="ml-auto" />
      {extra}
      {!none && !hideEarlier && (
        <button
          type="button"
          onClick={earlier}
          disabled={busy}
          className="flex items-center gap-1 font-medium text-accent active:opacity-60 disabled:opacity-50"
          aria-label={t('after.showEarlier')}
        >
          <span className="text-lg leading-none">⋯</span> {t('after.earlier')}
        </button>
      )}
    </div>
  )
}
