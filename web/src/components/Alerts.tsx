import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ALERTS_QUERY, gql, type Alert } from '../lib/api'
import { formatTime, localParts } from '../lib/time'
import { ChevronIcon } from './Icons'
import RouteBadge from './RouteBadge'

/** Alerts (works, diversions, replacement buses) for these lines/stops, from BKK. */
export function useAlerts(routeIds: string[], stopIds: string[] = []) {
  const ids = { routeIds: [...routeIds].sort(), stopIds: [...stopIds].sort() }
  return useQuery({
    queryKey: ['alerts', ids],
    queryFn: () => gql<{ alerts: Alert[] }>(ALERTS_QUERY, { ...ids, lang: 'en' }),
    enabled: ids.routeIds.length + ids.stopIds.length > 0,
    staleTime: 5 * 60_000,
  })
}

function when(d: Date) {
  const today = localParts(new Date()).date
  const tomorrow = localParts(new Date(Date.now() + 86_400_000)).date
  const day = localParts(d).date
  const label =
    day === today ? 'today' : day === tomorrow ? 'tomorrow' : d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', timeZone: 'Europe/Budapest' })
  return `${label} ${formatTime(d)}`
}

/** "now – Nov 23 00:35", "tomorrow 04:23 – Nov 23 00:35", "until …" */
function period(a: Alert) {
  const now = Date.now()
  const start = a.start ? new Date(a.start) : null
  const end = a.end ? new Date(a.end) : null
  // Long-running notices (months/years) just read "ongoing"
  if (end && end.getTime() - now > 120 * 86_400_000) return start && start.getTime() > now ? `from ${when(start)}` : 'ongoing'
  if (start && start.getTime() > now) return end ? `${when(start)} – ${when(end)}` : `from ${when(start)}`
  return end ? `now – ${when(end)}` : 'now'
}

/** Compact alert cards; tap one for the full text and BKK's page. */
export default function Alerts({ routeIds, stopIds = [] }: { routeIds: string[]; stopIds?: string[] }) {
  const query = useAlerts(routeIds, stopIds)
  const [open, setOpen] = useState<string | null>(null)
  const alerts = query.data?.alerts ?? []
  if (alerts.length === 0) return null
  return (
    <section className="space-y-2">
      {alerts.map((a) => {
        const expanded = open === a.id
        const upcoming = a.start && new Date(a.start).getTime() > Date.now()
        return (
          <div key={a.id} className="overflow-hidden rounded-2xl bg-[#fff4cc] text-black dark:bg-[#3a3214] dark:text-[#fff4cc]">
            <button type="button" onClick={() => setOpen(expanded ? null : a.id)} aria-expanded={expanded} className="flex w-full items-start gap-3 px-4 py-3 text-left">
              <span className="mt-0.5 text-lg leading-none" aria-hidden>
                ⚠︎
              </span>
              <span className="min-w-0 flex-1">
                {a.routes.length > 0 && (
                  <span className="mb-1 flex flex-wrap gap-1">
                    {a.routes.slice(0, 6).map((r) => (
                      <RouteBadge key={r.routeId} route={r} fit />
                    ))}
                  </span>
                )}
                <span className={`block text-[15px] leading-snug font-semibold ${expanded ? '' : 'line-clamp-2'}`}>{a.header}</span>
                <span className="mt-0.5 block text-[13px] opacity-70">
                  {upcoming ? 'Planned · ' : ''}
                  {period(a)}
                </span>
              </span>
              <ChevronIcon className={`mt-1 h-4 w-4 shrink-0 opacity-50 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
            {expanded && (
              <div className="px-4 pb-4 pl-11 text-[15px] leading-relaxed">
                {a.description && <p className="whitespace-pre-line">{a.description}</p>}
                {a.url && /^https?:\/\//.test(a.url) && (
                  <a href={a.url} target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold underline">
                    More on bkk.hu
                  </a>
                )}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
