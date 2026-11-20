import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { formatTime, localParts, TIME_ZONE } from '../lib/time'
import { ClockIcon } from './Icons'

const EARLIER_STEP_MIN = 5

/**
 * The departures window, kept in the URL so it survives back/forward:
 * ?after=HH:MM  a chosen time (earlier than now = tomorrow)
 * ?at=ISO       arrived from a trip: start at that trip's time here
 * ?earlier=N    "⋯ Earlier" pressed N times: start N×5 minutes before
 */
export function useAfter() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('after')
  const at = params.get('at')
  const earlier = Number(params.get('earlier') ?? 0) || 0
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
  const base = picked ?? new Date()
  const start = picked || earlier ? new Date(Math.floor((base.getTime() - earlier * EARLIER_STEP_MIN * 60_000) / 60_000) * 60_000) : null
  return {
    /** Window start for the API; null = now */
    after: start,
    /** The chosen time (or the trip's time), not counting "earlier" */
    picked,
    earlier,
    setTime: (hhmm: string | null) => update({ after: hhmm, at: null, earlier: null }),
    loadEarlier: () => update({ earlier: String(earlier + 1) }),
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
 * Top-bar control: clock icon + "Now" or the chosen time. Opens an app-styled
 * picker (hour/minute steppers, quick offsets), no native time input.
 */
export function TimeControl() {
  const { picked, setTime } = useAfter()
  const [open, setOpen] = useState(false)
  const base = picked ?? new Date()
  const parts = localParts(base)
  const [h, setH] = useState(+parts.hour)
  const [m, setM] = useState(Math.ceil(+parts.minute / 5) * 5 % 60)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const p = localParts(picked ?? new Date())
    setH(+p.hour)
    setM((Math.ceil(+p.minute / 5) * 5) % 60)
    const onDown = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
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
      <button type="button" onClick={() => onChange((value + step) % max)} className="rounded-lg px-4 py-1 text-xl active:bg-fill" aria-label="Later">
        ▲
      </button>
      <span className="text-3xl font-bold tabular-nums">{pad(value)}</span>
      <button type="button" onClick={() => onChange((value - step + max) % max)} className="rounded-lg px-4 py-1 text-xl active:bg-fill" aria-label="Earlier">
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
        className={`flex items-center gap-1 rounded-md p-2 text-[15px] font-semibold active:opacity-50 ${picked ? 'text-accent' : ''}`}
      >
        <ClockIcon className="h-6 w-6" />
        <span className="tabular-nums">{picked ? formatTime(picked) : 'Now'}</span>
      </button>
      {open && (
        <div role="dialog" aria-label="Departures from" className="absolute top-full right-0 z-[1200] mt-1 w-64 rounded-2xl bg-surface p-4 shadow-xl ring-1 ring-separator">
          <p className="text-[12px] font-semibold text-secondary uppercase">Departures from</p>
          <div className="my-2 flex items-center justify-center gap-2">
            <Stepper value={h} onChange={setH} max={24} step={1} />
            <span className="text-3xl font-bold">:</span>
            <Stepper value={m} onChange={setM} max={60} step={5} />
          </div>
          <div className="mb-3 flex justify-center gap-2 text-[13px]">
            {[15, 30, 60].map((n) => (
              <button key={n} type="button" onClick={() => plus(n)} className="rounded-full bg-fill px-2.5 py-1 font-medium active:opacity-60">
                +{n < 60 ? `${n}'` : '1h'}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => choose(null)} className="flex-1 rounded-xl bg-fill py-2 font-medium active:opacity-60">
              Now
            </button>
            <button type="button" onClick={() => choose(`${pad(h)}:${pad(m)}`)} className="flex-1 rounded-xl bg-accent py-2 font-semibold text-white active:opacity-80">
              Show
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Header row of a departures card: what the list starts from, and "⋯ Earlier". */
export default function AfterFilter() {
  const { after, picked, earlier, loadEarlier } = useAfter()
  return (
    <div className="flex items-center justify-between gap-3 border-b border-separator px-4 py-2.5 text-[15px]">
      <span className="text-secondary">
        {after ? (
          <>
            From <span className="font-semibold text-label tabular-nums">{formatTime(after)}</span>
            {earlier > 0 && !picked && ' (earlier)'}
          </>
        ) : (
          'Now'
        )}
      </span>
      <button type="button" onClick={loadEarlier} className="flex items-center gap-1 font-medium text-accent active:opacity-60" aria-label="Show earlier departures">
        <span className="text-lg leading-none">⋯</span> Earlier
      </button>
    </div>
  )
}
