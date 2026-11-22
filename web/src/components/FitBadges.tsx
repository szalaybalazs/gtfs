import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import RouteBadge from './RouteBadge'
import { baseLines } from '../lib/mapIcons'
import type { RouteSummary } from '../lib/api'

type Route = Pick<RouteSummary, 'shortName' | 'routeId' | 'color' | 'textColor'> & { type?: RouteSummary['type'] }

/** Two rows of badges (a badge is 24 px, rows are 4 px apart): as many as fit, then a grey "…" for the rest. */
const TWO_ROWS = 24 * 2 + 4

/**
 * The lines at a stop on one or two rows. Shows as many badges as fit in two rows; if some don't, the last
 * spot is a grey "…". Recomputed when the width changes. The same clean-up as the map (variants, 4/6/4-6).
 */
export default function FitBadges({ routes }: { routes: Route[] }) {
  const base = useMemo(() => baseLines(routes as RouteSummary[]), [routes])
  const ref = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState(base.length)

  // Every time the width changes (or the stop changes), start from all of them again
  useLayoutEffect(() => {
    setCount(base.length)
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setCount(base.length))
    ro.observe(el)
    return () => ro.disconnect()
  }, [base])

  // Drop one badge at a time until everything shown (the "…" included) fits in two rows
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || count <= 0) return
    if (el.scrollHeight > TWO_ROWS + 1) setCount((c) => c - 1)
  }, [count, base])

  const shown = base.slice(0, count)
  const more = base.length > shown.length
  return (
    <div ref={ref} className="flex flex-wrap items-start gap-1 overflow-hidden" style={{ maxHeight: TWO_ROWS }}>
      {shown.map((r) => (
        <RouteBadge key={r.routeId} route={r} />
      ))}
      {more && (
        <span
          className="inline-flex h-6 items-center justify-center rounded-[5px] bg-[#6b7280] px-2 text-[13px] font-bold text-white"
          aria-label={`+${base.length - shown.length}`}
        >
          …
        </span>
      )}
    </div>
  )
}
