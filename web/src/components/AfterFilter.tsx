import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { DEPARTURES_QUERY, gql, type Departures } from '../lib/api'
import { useT } from '../lib/i18n'
import { formatTime, localParts, TIME_ZONE } from '../lib/time'
import { ClockIcon } from './Icons'

/**
 * The departures window, kept in the URL so it survives back/forward:
 * ?after=HH:MM  a chosen time (earlier than now = tomorrow)
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
  const picked = raw && /^\d{2}:\d{2}$/.test(raw) ? budapestTime(raw) : atDate && !Number.isNaN(atDate.getTime()) ? atDate : null

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

/** Today's (or tomorrow's) HH:MM in Budapest time, as an absolute Date. */
function budapestTime(hhmm: string) {
  const now = new Date()
  const today = localParts(now).date
  const offsetMin = Math.round(
    (new Date(now.toLocaleString('en-US', { timeZone: TIME_ZONE })).getTime() -
      new Date(now.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()) /
      60_000,
  )
  const [h, m] = hhmm.split(':').map(Number)
  const utc = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10), h, m) - offsetMin * 60_000
  return new Date(utc < now.getTime() - 60_000 ? utc + 86_400_000 : utc)
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Departures-header control: clock icon + "Now" or the chosen time. Opens an app-styled
 * picker (hour/minute steppers, quick offsets), no native time input.
 */
export function TimeControl() {
  const t = useT()
  const { picked, after, setTime } = useAfter()
  const [open, setOpen] = useState(false)
  const base = picked ?? new Date()
  const parts = localParts(base)
  const [h, setH] = useState(+parts.hour)
  const [m, setM] = useState(Math.ceil(+parts.minute / 5) * 5 % 60)
  const ref = useRef<HTMLDivElement>(null)
  // Fixed, so the departures card's rounded overflow doesn't clip it
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!open) return
    const r = ref.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 264)) })
    const onScroll = () => setOpen(false)
    window.addEventListener('scroll', onScroll, { passive: true, once: true })
    const p = localParts(picked ?? new Date())
    setH(+p.hour)
    setM((Math.ceil(+p.minute / 5) * 5) % 60)
    const onDown = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('scroll', onScroll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const choose = (hhmm: string | null) => {
    setTime(hhmm)
    setOpen(false)
  }
  const plus = (minutes: number) => {
    const t = new Date(Date.now() + minutes * 60_000)
    const p = localParts(t)
    choose(`${p.hour}:${p.minute}`)
  }
  const Stepper = ({ value, onChange, max, step }: { value: number; onChange: (v: number) => void; max: number; step: number }) => (
    <div className="flex flex-col items-center">
      <button type="button" onClick={() => onChange((value + step) % max)} className="rounded-lg px-4 py-1 text-xl active:bg-fill" aria-label={t('after.later')}>
        ▲
      </button>
      <span className="text-3xl font-bold tabular-nums">{pad(value)}</span>
      <button type="button" onClick={() => onChange((value - step + max) % max)} className="rounded-lg px-4 py-1 text-xl active:bg-fill" aria-label={t('after.stepEarlier')}>
        ▼
      </button>
    </div>
  )

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`-ml-1.5 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[15px] font-semibold active:opacity-50 ${after ? 'text-accent' : ''}`}
      >
        <ClockIcon className="h-5 w-5" />
        <span className="tabular-nums">
          {after ? t('after.from', { time: formatTime(after) }) : t('after.now')}
        </span>
      </button>
      {open && pos && (
        <div role="dialog" aria-label={t('after.dialog')} style={{ top: pos.top, left: pos.left }} className="fixed z-[1200] w-64 rounded-2xl bg-surface p-4 shadow-xl ring-1 ring-separator">
          <p className="text-[12px] font-semibold text-secondary uppercase">{t('after.dialog')}</p>
          <div className="my-2 flex items-center justify-center gap-2">
            <Stepper value={h} onChange={setH} max={24} step={1} />
            <span className="text-3xl font-bold">:</span>
            <Stepper value={m} onChange={setM} max={60} step={5} />
          </div>
          <div className="mb-3 flex justify-center gap-2 text-[13px]">
            {[15, 30, 60].map((n) => (
              <button key={n} type="button" onClick={() => plus(n)} className="rounded-full bg-fill px-2.5 py-1 font-medium active:opacity-60">
                {n < 60 ? t('after.plusMinutes', { n }) : t('after.plusHour')}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => choose(null)} className="flex-1 rounded-xl bg-fill py-2 font-medium active:opacity-60">
              {t('after.now')}
            </button>
            <button type="button" onClick={() => choose(`${pad(h)}:${pad(m)}`)} className="flex-1 rounded-xl bg-accent py-2 font-semibold text-white active:opacity-80">
              {t('after.show')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Header row of a departures card: the time picker (Now / From HH:MM) and "⋯ Earlier". */
export default function AfterFilter({ stopIds, routeIds = null }: { stopIds: string[]; routeIds?: string[] | null }) {
  const t = useT()
  const { after, loadEarlier } = useAfter()
  const [busy, setBusy] = useState(false)
  const [none, setNone] = useState(false)

  // Find the last departure before the list starts and start there: exactly one more row per tap
  const earlier = async () => {
    if (busy || stopIds.length === 0) return
    setBusy(true)
    const start = after ?? new Date(Math.floor(Date.now() / 60_000) * 60_000)
    try {
      for (const hours of [1, 3]) {
        const from = new Date(start.getTime() - hours * 3_600_000)
        const data = await gql<Departures>(DEPARTURES_QUERY, { stopIds, routeIds, limit: 200, hours, after: from.toISOString() })
        const before = data.departures.map((d) => new Date(d.departure)).filter((d) => d.getTime() < start.getTime())
        if (before.length) {
          loadEarlier(new Date(Math.max(...before.map((d) => d.getTime()))))
          return
        }
      }
      setNone(true)
    } catch {
      // Network hiccup: leave the list as it is
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-separator px-4 py-2.5 text-[15px]">
      <TimeControl />
      {!none && (
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
