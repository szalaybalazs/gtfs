import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ALERTS_QUERY, gql, type Alert } from '../lib/api'
import { useT, type TFunction } from '../lib/i18n'
import { formatShortDate, formatTime, localParts } from '../lib/time'
import { ChevronIcon, CloseIcon } from './Icons'
import RouteBadge from './RouteBadge'
import { alertPageUrl } from '../lib/alertUrl'

/** Alerts (works, diversions, replacement buses) for these lines/stops, from BKK. */
export function useAlerts(routeIds: string[], stopIds: string[] = []) {
  const { locale: lang } = useT()
  const ids = { routeIds: [...routeIds].sort(), stopIds: [...stopIds].sort() }
  return useQuery({
    queryKey: ['alerts', ids, lang],
    queryFn: () => gql<{ alerts: Alert[] }>(ALERTS_QUERY, { ...ids, lang }),
    enabled: ids.routeIds.length + ids.stopIds.length > 0,
    staleTime: 5 * 60_000,
  })
}

function when(d: Date, t: TFunction) {
  const today = localParts(new Date()).date
  const tomorrow = localParts(new Date(Date.now() + 86_400_000)).date
  const day = localParts(d).date
  const label =
    day === today ? t('alerts.today') : day === tomorrow ? t('alerts.tomorrow') : formatShortDate(d)
  return `${label} ${formatTime(d)}`
}

/** "Nov 18 05:00 – Nov 23 00:35", "tomorrow 04:23 – …", "since …", "ongoing" */
function period(a: Alert, t: TFunction) {
  const now = Date.now()
  const w = (d: Date) => when(d, t)
  const start = a.start ? new Date(a.start) : null
  const end = a.end ? new Date(a.end) : null
  // Long-running notices (months/years) just read "ongoing"
  if (end && end.getTime() - now > 120 * 86_400_000)
    return start && start.getTime() > now ? t('alerts.from', { when: w(start) }) : t('alerts.ongoing')
  if (start && start.getTime() > now) return end ? `${w(start)} – ${w(end)}` : t('alerts.from', { when: w(start) })
  // Already running: show when it actually started, not "now"
  if (start) return end ? `${w(start)} – ${w(end)}` : t('alerts.since', { when: w(start) })
  return end ? t('alerts.until', { when: w(end) }) : t('alerts.ongoing')
}

/** Compact alert cards; tap one to open the change in a sheet from the bottom. */
export default function Alerts({ routeIds, stopIds = [] }: { routeIds: string[]; stopIds?: string[] }) {
  const t = useT()
  const query = useAlerts(routeIds, stopIds)
  const [open, setOpen] = useState<Alert | null>(null)
  const alerts = query.data?.alerts ?? []
  if (alerts.length === 0) return null
  return (
    <section className="space-y-2">
      {alerts.map((a) => {
        const upcoming = a.start && new Date(a.start).getTime() > Date.now()
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => setOpen(a)}
            className="flex w-full items-start gap-3 rounded-2xl bg-[#fff4cc] px-4 py-3 text-left text-black active:opacity-80 dark:bg-[#3a3214] dark:text-[#fff4cc]"
          >
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
              <span className="line-clamp-2 block text-[15px] leading-snug font-semibold">{a.header}</span>
              <span className="mt-0.5 block text-[13px] opacity-70">
                {upcoming ? `${t('alerts.planned')} · ` : ''}
                {period(a, t)}
              </span>
            </span>
            <ChevronIcon className="mt-1 h-4 w-4 shrink-0 opacity-50" />
          </button>
        )
      })}
      {open && createPortal(<AlertSheet alert={open} onClose={() => setOpen(null)} />, document.body)}
    </section>
  )
}

/**
 * The change itself, in a sheet from the bottom: BKK's page for it in an
 * embedded browser view, with the alert text above it (and a way out to the
 * real browser if the page won't load inside the app).
 */
function AlertSheet({ alert: a, onClose }: { alert: Alert; onClose: () => void }) {
  const t = useT()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])
  const url = alertPageUrl(a.url)
  return (
    <div className="fixed inset-0 z-[1150] flex items-end justify-center bg-black/30" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={a.header}
        className="sheet-up flex h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-canvas shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-separator px-4 pt-3 pb-3">
          <div className="min-w-0 flex-1">
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-separator" aria-hidden />
            {a.routes.length > 0 && (
              <div className="mb-1 flex flex-wrap gap-1">
                {a.routes.slice(0, 10).map((r) => (
                  <RouteBadge key={r.routeId} route={r} fit />
                ))}
              </div>
            )}
            <h2 className="text-[17px] leading-snug font-bold">{a.header}</h2>
            <p className="text-[13px] text-secondary">{period(a, t)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="mt-4 rounded-full bg-fill p-2 active:opacity-60">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        {url ? (
          <>
            <iframe src={url} title={a.header} className="min-h-0 w-full flex-1 bg-white" referrerPolicy="no-referrer" />
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="border-t border-separator px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] text-center text-[15px] font-medium text-accent"
            >
              {t('alerts.openInBrowser')}
            </a>
          </>
        ) : (
          <p className="overflow-y-auto px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] text-[15px] leading-relaxed whitespace-pre-line">
            {a.description ?? t('alerts.noDetails')}
          </p>
        )}
      </div>
    </div>
  )
}
