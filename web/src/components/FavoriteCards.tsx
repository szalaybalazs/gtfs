import { Link } from 'react-router'
import type { Departure, RouteRef } from '../lib/api'
import type { Favorite, FavoriteDraft } from '../lib/favorites'
import { useT } from '../lib/i18n'
import { useDepartures } from '../lib/useDepartures'
import { useNow } from '../lib/useTimetable'
import { ChevronIcon, LiveIcon } from './Icons'
import { useAlerts } from './Alerts'
import RouteBadge from './RouteBadge'
import { countdown } from '../lib/countdown'
import { realtimeStatus } from '../lib/realtimeStatus'
import { formatTime } from '../lib/time'

/** How many upcoming departures a favourite row shows. */
const MAX_TIMES = 8

/**
 * Upcoming departures in time order, with back-to-back departures of the same
 * line merged: [1] 1', 5'  [2] 7'  [1] 10'.
 */
function runs(departures: Departure[], now: Date, onlyRoute?: string | string[]) {
  const only = onlyRoute == null ? null : new Set(Array.isArray(onlyRoute) ? onlyRoute : [onlyRoute])
  const out: { route: RouteRef; times: Departure[] }[] = []
  const upcoming = departures
    .filter((d) => d.route && (!only || only.has(d.route.routeId)) && new Date(d.departure).getTime() >= now.getTime() - 30_000)
    .sort((a, b) => a.departure.localeCompare(b.departure))
    .slice(0, MAX_TIMES)
  for (const d of upcoming) {
    const last = out[out.length - 1]
    if (last && last.route.routeId === d.route!.routeId) last.times.push(d)
    else out.push({ route: d.route!, times: [d] })
  }
  return out
}

/**
 * The one favourites layout, in time order: [1] 1', 5'  [2] 7'  [1] 10' …
 * Side-scrollable when it doesn't fit. Times are coloured by realtime status.
 */
function LineTimesRow({ departures, pending, onlyRoute, fallback }: { departures: Departure[]; pending: boolean; onlyRoute?: string | string[]; fallback: RouteRef[] }) {
  const now = useNow(1_000)
  const groups = runs(departures, now, onlyRoute)
  return (
    <div className="-mx-gutter flex items-center gap-3 overflow-x-auto px-gutter pb-0.5 [scrollbar-width:none]">
      {pending || groups.length === 0
        ? fallback.map((r) => (
            <span key={r.routeId} className="flex shrink-0 items-center gap-2">
              <RouteBadge route={r} size="lg" fit />
              <span className="text-[18px] text-secondary">{pending ? '…' : '–'}</span>
            </span>
          ))
        : groups.map(({ route, times }) => (
            <span key={`${route.routeId}-${times[0].tripId}`} className="flex shrink-0 items-center gap-2">
              <RouteBadge route={route} size="lg" fit />
              {/* Countdowns as on the Lines board, all at the small size so a row of several lines stays even */}
              <span className="flex items-baseline gap-2.5 text-[21px] font-semibold whitespace-nowrap tabular-nums">
                {times.map((d) => (
                  <ShortTime key={`${d.tripId}-${d.serviceDate}`} d={d} now={now} />
                ))}
              </span>
            </span>
          ))}
    </div>
  )
}

/** A small "Üzemzavar" tag while any of these lines / stops has a service alert in effect */
function DisruptionTag({ routeIds, stopIds }: { routeIds: string[]; stopIds: string[] }) {
  const t = useT()
  const alerts = useAlerts(routeIds, stopIds)
  // Only a disruption in effect right now: started, and not yet over
  const now = Date.now()
  const active = (alerts.data?.alerts ?? []).some(
    (a) => (!a.start || new Date(a.start).getTime() <= now) && (!a.end || new Date(a.end).getTime() > now),
  )
  if (!active) return null
  return (
    <span className="alert-card inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 text-[12px] leading-[20px] font-semibold text-alert-text">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3 2.5 20h19L12 3Z" />
        <path d="M12 10v4M12 17.2v.1" />
      </svg>
      {t('fav.disruption')}
    </span>
  )
}

function Card({
  title,
  subtitle,
  to,
  link,
  children,
  alertsFor,
}: {
  title: string
  subtitle?: string | null
  to: string
  link: boolean
  children: React.ReactNode
  /** Lines and stops to check for service alerts (shows a small tag by the title) */
  alertsFor?: { routeIds: string[]; stopIds: string[] }
}) {
  const body = (
    <div className="px-gutter py-4">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[20px] font-semibold">
            <span className="truncate">{title}</span>
            {alertsFor && <DisruptionTag {...alertsFor} />}
          </p>
          {subtitle && <p className="truncate text-[15px] text-secondary">{subtitle}</p>}
        </div>
        {link && <ChevronIcon className="h-4 w-4 shrink-0 text-secondary/60" />}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  )
  return link ? (
    <Link to={to} className="block active:bg-fill">
      {body}
    </Link>
  ) : (
    body
  )
}

/**
 * One time on a single line: "10s", "10'", "2½'", "17:23" (an hour or more away), with the live
 * mark right after it when tracked live. Full colour.
 */
function ShortTime({ d, now }: { d: Departure; now: Date }) {
  const at = new Date(d.departure)
  const s = (at.getTime() - now.getTime()) / 1000
  const live = realtimeStatus(d.realtime, d.departureDelay ?? d.arrivalDelay) !== 'scheduled'
  const text =
    s < 0 ? `-${Math.ceil(-s)}s` : s >= 3600 ? formatTime(at) : s < 60 ? `${Math.round(s)}s` : `${countdown(s).value}'`
  return (
    <span className={`inline-flex items-start ${s >= 3600 ? 'px-1' : ''} ${s < 0 ? 'opacity-45' : ''}`}>
      {text}
      {live && s >= 0 && <LiveIcon className="ml-0.5 h-2.5 w-2.5 text-secondary" aria-hidden />}
    </span>
  )
}

/** One line from one stop. */
export function LineStopCard({ fav, link = true }: { fav: Extract<FavoriteDraft, { kind: 'lineStop' }>; link?: boolean }) {
  const t = useT()
  const query = useDepartures([fav.stopId], { limit: 8, routeIds: [fav.route.routeId] })
  // Saved without a direction (older favourites): take it from where the next departures go
  const towards = fav.headsign ?? [...new Set((query.data?.departures ?? []).map((d) => d.headsign).filter(Boolean))].join(' / ')
  return (
    <Card
      title={fav.stopName}
      subtitle={towards ? t('common.towards', { to: towards }) : null}
      to={`/routes/${encodeURIComponent(fav.route.routeId)}?stop=${encodeURIComponent(fav.stopId)}`}
      link={link}
      alertsFor={{ routeIds: [fav.route.routeId], stopIds: [fav.stopId] }}
    >
      <LineTimesRow departures={query.data?.departures ?? []} pending={query.isPending} fallback={[fav.route]} />
    </Card>
  )
}

/** A stop with every line that leaves from it. */
export function StopCard({ fav, link = true }: { fav: Extract<FavoriteDraft, { kind: 'stop' }>; link?: boolean }) {
  const t = useT()
  const query = useDepartures([fav.stopId], { limit: 40 })
  return (
    <Card
      title={fav.name}
      subtitle={fav.headsigns.length ? t('common.towards', { to: fav.headsigns.join(' / ') }) : null}
      to={`/stations/${encodeURIComponent(fav.stationId)}?from=${encodeURIComponent(fav.stopId)}`}
      link={link}
      alertsFor={{ routeIds: fav.routes.map((r) => r.routeId), stopIds: [fav.stopId] }}
    >
      <LineTimesRow departures={query.data?.departures ?? []} pending={query.isPending} fallback={fav.routes} />
    </Card>
  )
}

/** Several lines from one stop group, in time order. */
export function LinesCard({ fav, link = true }: { fav: Extract<FavoriteDraft, { kind: 'lines' }>; link?: boolean }) {
  const t = useT()
  const ids = fav.routes.map((r) => r.routeId)
  const query = useDepartures(fav.stopIds, { limit: 30, routeIds: ids })
  const params = new URLSearchParams({ lines: ids.join(',') })
  if (fav.from) params.set('from', fav.from)
  return (
    <Card
      title={fav.name}
      subtitle={fav.headsigns.length ? t('common.towards', { to: fav.headsigns.join(' / ') }) : t('fav.lineCount', { n: fav.routes.length })}
      to={`/stations/${encodeURIComponent(fav.stationId)}?${params}`}
      link={link}
      alertsFor={{ routeIds: ids, stopIds: fav.stopIds }}
    >
      <LineTimesRow departures={query.data?.departures ?? []} pending={query.isPending} fallback={fav.routes} />
    </Card>
  )
}

/** Preview of any favourite kind, as it will look on the home screen. */
export function FavoritePreview({ fav }: { fav: FavoriteDraft | Favorite }) {
  if (fav.kind === 'line')
    return (
      <div className="px-gutter py-row">
        <RouteBadge route={fav.route} />
      </div>
    )
  if (fav.kind === 'lineStop') return <LineStopCard fav={fav} link={false} />
  if (fav.kind === 'lines') return <LinesCard fav={fav} link={false} />
  return <StopCard fav={fav} link={false} />
}
