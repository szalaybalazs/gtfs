import { Link } from 'react-router'
import type { Departure, RouteRef } from '../lib/api'
import type { Favorite, FavoriteDraft } from '../lib/favorites'
import { useT } from '../lib/i18n'
import { realtimeStatus, statusColor } from '../lib/realtimeStatus'
import { formatTime } from '../lib/time'
import { shortRelative, useTimeMode } from '../lib/timeMode'
import { useDepartures } from '../lib/useDepartures'
import { useNow } from '../lib/useTimetable'
import { ChevronIcon } from './Icons'
import RouteBadge from './RouteBadge'

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
  const t = useT()
  const now = useNow(1_000)
  const [mode] = useTimeMode()
  const groups = runs(departures, now, onlyRoute)
  return (
    <div className="-mx-4 flex items-center gap-4 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
      {pending || groups.length === 0
        ? fallback.map((r) => (
            <span key={r.routeId} className="flex shrink-0 items-center gap-1.5">
              <RouteBadge route={r} fit />
              <span className="text-[15px] text-secondary">{pending ? '…' : '–'}</span>
            </span>
          ))
        : groups.map(({ route, times }) => (
            <span key={`${route.routeId}-${times[0].tripId}`} className="flex shrink-0 items-center gap-1.5">
              <RouteBadge route={route} fit />
              <span className="text-[17px] font-semibold whitespace-nowrap tabular-nums">
                {times.map((d, i) => {
                  const status = realtimeStatus(d.realtime, d.departureDelay ?? d.arrivalDelay)
                  const at = new Date(d.departure)
                  return (
                    <span key={`${d.tripId}-${d.serviceDate}`}>
                      {i > 0 && <span className="text-secondary">, </span>}
                      <span className={statusColor[status]}>
                        {mode === 'relative' ? shortRelative((at.getTime() - now.getTime()) / 1000, t) : formatTime(at)}
                      </span>
                    </span>
                  )
                })}
              </span>
            </span>
          ))}
    </div>
  )
}

function Card({ title, subtitle, to, link, children }: { title: string; subtitle?: string | null; to: string; link: boolean; children: React.ReactNode }) {
  const body = (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold">{title}</p>
          {subtitle && <p className="truncate text-[13px] text-secondary">{subtitle}</p>}
        </div>
        {link && <ChevronIcon className="h-4 w-4 shrink-0 text-secondary/60" />}
      </div>
      <div className="mt-2">{children}</div>
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

/** One line from one stop. */
export function LineStopCard({ fav, link = true }: { fav: Extract<FavoriteDraft, { kind: 'lineStop' }>; link?: boolean }) {
  const t = useT()
  const query = useDepartures([fav.stopId], { limit: 8, routeIds: [fav.route.routeId] })
  return (
    <Card
      title={fav.stopName}
      subtitle={fav.headsign ? t('common.towards', { to: fav.headsign }) : null}
      to={`/routes/${encodeURIComponent(fav.route.routeId)}?stop=${encodeURIComponent(fav.stopId)}`}
      link={link}
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
    >
      <LineTimesRow departures={query.data?.departures ?? []} pending={query.isPending} fallback={fav.routes} />
    </Card>
  )
}

/** Preview of any favourite kind, as it will look on the home screen. */
export function FavoritePreview({ fav }: { fav: FavoriteDraft | Favorite }) {
  if (fav.kind === 'line')
    return (
      <div className="px-4 py-3">
        <RouteBadge route={fav.route} />
      </div>
    )
  if (fav.kind === 'lineStop') return <LineStopCard fav={fav} link={false} />
  if (fav.kind === 'lines') return <LinesCard fav={fav} link={false} />
  return <StopCard fav={fav} link={false} />
}
