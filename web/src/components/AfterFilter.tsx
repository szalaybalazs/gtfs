import { useSearchParams } from 'react-router'
import { localParts, TIME_ZONE } from '../lib/time'
import { CloseIcon } from './Icons'

/**
 * "Departures after HH:MM", kept in the URL as ?after=HH:MM. A time earlier
 * than now means tomorrow.
 */
export function useAfter(): [Date | null, string | null, (hhmm: string | null) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get('after')
  const set = (hhmm: string | null) =>
    setParams(
      (p) => {
        if (hhmm) p.set('after', hhmm)
        else p.delete('after')
        return p
      },
      { replace: true },
    )
  if (!raw || !/^\d{2}:\d{2}$/.test(raw)) return [null, null, set]
  return [budapestTime(raw), raw, set]
}

/** Today's (or tomorrow's) HH:MM in Budapest time, as an absolute Date. */
function budapestTime(hhmm: string) {
  const now = new Date()
  const today = localParts(now).date
  // Budapest's UTC offset right now, from the difference between local and UTC readings
  const offsetMin = Math.round(
    (new Date(now.toLocaleString('en-US', { timeZone: TIME_ZONE })).getTime() -
      new Date(now.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()) /
      60_000,
  )
  const [h, m] = hhmm.split(':').map(Number)
  const utc = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10), h, m) - offsetMin * 60_000
  return new Date(utc < now.getTime() - 60_000 ? utc + 86_400_000 : utc)
}

/** Bar at the top of a departures card: a time picker, or the active filter with a clear button. */
export default function AfterFilter() {
  const [after, raw, setAfter] = useAfter()
  if (after) {
    return (
      <div className="flex items-center justify-between gap-3 bg-accent/10 px-4 py-3">
        <span className="text-[17px]">
          Departures after <span className="font-semibold tabular-nums">{raw}</span>
        </span>
        <button type="button" onClick={() => setAfter(null)} aria-label="Back to now" className="rounded-md p-1 active:opacity-50">
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>
    )
  }
  return (
    <label className="relative flex items-center justify-between gap-3 border-b border-separator px-4 py-2.5 text-[15px] text-secondary">
      <span>Now</span>
      <span className="font-medium text-accent">Pick a time</span>
      <input
        type="time"
        aria-label="Departures after"
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(e) => e.target.value && setAfter(e.target.value)}
      />
    </label>
  )
}
