import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { CheckIcon, ChevronIcon, LiveIcon } from '../components/Icons'
import Alerts from '../components/Alerts'
import MiniMap from '../components/MiniMap'
import TransitMap, { type TripOverlay } from '../components/TransitMap'
import NavBar from '../components/NavBar'
import RouteBadge from '../components/RouteBadge'
import { gql, TRIP_PATH_QUERY, TRIP_QUERY, type TripDetails, type TripPath, type TripStop } from '../lib/api'
import { tripKey, type TripPreview } from '../lib/prefetch'
import { vehicleName } from '../lib/vehicle'
import { formatPlate } from '../lib/plate'
import { RefreshedAge } from '../components/RefreshedAge'
import { distance } from '../lib/geo'
import { CATEGORIES, categoryOf, type Category } from '../lib/categories'
import CategoryIcon from '../components/CategoryIcon'
import { MarkIcon } from '../components/LineMarks'
import { hex } from '../lib/geo'
import { realtimeStatus, statusColor, statusLabel } from '../lib/realtimeStatus'
import { formatNumber, useT, type TFunction } from '../lib/i18n'
import { formatTime, formatTimeParts } from '../lib/time'
import { REFRESH_MS, useNow } from '../lib/useTimetable'

/** One vehicle's run: where it is, when it reaches each stop. */
export default function TripPage() {
  const t = useT()
  const { tripId = '' } = useParams()
  const [params] = useSearchParams()
  const date = params.get('date') || undefined
  const from = params.get('from')
  const now = useNow(1_000)
  // Stops 1…foldEnd are folded away. Decided once, when the trip first loads (the vehicle moving on doesn't fold more); one tap opens them for good
  const [foldEnd, setFoldEnd] = useState<number | null | undefined>(undefined)

  const query = useQuery({
    queryKey: tripKey(tripId, date),
    queryFn: () => gql<TripDetails>(TRIP_QUERY, { id: tripId, serviceDate: date }),
    refetchInterval: REFRESH_MS,
  })
  // The shape doesn't change while you watch, so it's fetched once, outside the refresh
  const pathQuery = useQuery({
    queryKey: ['tripPath', tripId, date],
    queryFn: () => gql<TripPath>(TRIP_PATH_QUERY, { id: tripId, serviceDate: date }),
    staleTime: Infinity,
  })
  const tripPath = pathQuery.data?.trip?.path ?? null
  // What the tapped departure already knew: line and destination show instantly
  const preview = (useLocation().state as TripPreview | null) ?? null
  const trip = query.data?.trip
  const route = trip?.route
  const color = hex(route?.color, '#6b7280')
  const stops = trip?.stops ?? []

  // The vehicle sits between the last stop it has left and the next one.
  const nextIndex = stops.findIndex((s) => new Date(s.departure).getTime() > now.getTime())
  const started = nextIndex !== 0 && stops.length > 0
  const finished = nextIndex === -1 && stops.length > 0
  const delay = latestDelay(stops, nextIndex)
  // More than 10 greyed-out stops: keep the first and the last two before the vehicle, fold what is between (the stop you came from stays)
  const fromIndex = stops.findIndex((x) => x.stop.stopId === from)
  const currentFoldEnd = started && !finished && nextIndex > 10 ? nextIndex - 3 : null
  useEffect(() => {
    if (foldEnd === undefined && stops.length > 0) setFoldEnd(currentFoldEnd)
  }, [foldEnd, stops.length, currentFoldEnd])
  const end = foldEnd === undefined ? currentFoldEnd : foldEnd
  const isFolded = (i: number) => end != null && i >= 1 && i <= end && i !== fromIndex
  // How many folded stops in a row start at i
  const foldedRun = (i: number) => {
    let n = 0
    while (isFolded(i + n)) n++
    return n
  }
  const vehicle = trip?.vehicle
  // Reference for the relative-minutes column: the stop you came from
  const reference = stops.find((x) => x.stop.stopId === from)
  const referenceTime = reference ? new Date(reference.departure).getTime() : null
  // Only show seconds when the data has them (realtime predictions, MÁV); plain schedules are all :00
  const hasSeconds = stops.some((x) => new Date(x.arrival).getSeconds() !== 0 || new Date(x.departure).getSeconds() !== 0)
  const vehicleAge = vehicle?.timestamp ? (now.getTime() - new Date(vehicle.timestamp).getTime()) / 60_000 : null

  // Where the vehicle is, in stop units (2.4 = 40 % of the way from stop 2 to stop 3). With a reported position it is snapped onto
  // the stop-to-stop path and stays put until the next fix (no extrapolation); a small step back is ignored. Without one (metro sends
  // none) it is spread along the timetable instead.
  const fixKey = vehicle?.latitude != null && vehicle?.longitude != null ? `${vehicle.latitude},${vehicle.longitude},${vehicle.timestamp}` : null
  const shownPos = useRef<number | null>(null)
  const fixPos = useMemo(() => {
    if (fixKey == null || !vehicle) return null
    const raw = snapToStops(stops, vehicle.latitude!, vehicle.longitude!)
    if (raw == null) return null
    const prev = shownPos.current
    // Real movement back (more than a stop) is believed; less is noise
    shownPos.current = prev != null && raw < prev && prev - raw <= 1 ? prev : raw
    return shownPos.current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixKey, stops.length])
  const live = started && !finished
  let markIndex = nextIndex
  let markP = 0
  if (live && fixPos != null && stops.length > 1) {
    const k = Math.min(Math.max(Math.floor(fixPos), 0), stops.length - 2)
    markIndex = k + 1
    markP = Math.min(1, Math.max(0, fixPos - k))
  } else if (live && nextIndex > 0) {
    const left = new Date(stops[nextIndex - 1].departure).getTime()
    const span = new Date(stops[nextIndex].arrival).getTime() - left
    markP = span > 0 ? Math.min(1, Math.max(0, (now.getTime() - left) / span)) : 0.5
  }
  // How far down each row (0…48 px) the line is faded: exactly up to the vehicle
  const greyTo = (i: number) => {
    if (finished) return 48
    if (!started) return 0
    if (i < markIndex - 1) return 48
    if (i === markIndex - 1) return Math.min(48, 24 + 48 * markP)
    if (i === markIndex) return Math.max(0, 48 * markP - 24)
    return 0
  }

  // Built once per data change, not on every 1 s tick: the maps re-upload whatever they're given
  // Built once per data change, not on every 1 s tick: the maps re-upload whatever they're given
  const overlay = useMemo<TripOverlay | null>(
    () =>
      trip
        ? {
            tripId,
            color,
            headsign: trip.headsign,
            path: tripPath?.coordinates ?? [],
            stops: stops
              .filter((s) => s.stop.lat != null && s.stop.lon != null)
              .map((s, i) => ({
                stopId: s.stop.stopId,
                stationId: s.stop.station?.stationId ?? null,
                name: s.stop.name ?? s.stop.stopId,
                lat: s.stop.lat!,
                lon: s.stop.lon!,
                time: new Date(i === stops.length - 1 ? s.arrival : s.departure),
                status: realtimeStatus(s.realtime, i === stops.length - 1 ? (s.arrivalDelay ?? s.departureDelay) : (s.departureDelay ?? s.arrivalDelay)),
                passed: nextIndex === -1 || i < nextIndex,
                strong: s.stop.stopId === from,
              })),
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.data, tripPath, color, nextIndex, from, tripId],
  )

  return (
    <div className="min-h-dvh">
      <NavBar back={{ label: t('common.back') }} />

      <main className="mx-auto max-w-2xl space-y-section px-gutter pt-gutter pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        {query.isPending && <TripSkeleton preview={preview} />}
        {query.isError && (
          <p className="p-6 text-center text-secondary">
            {t('trip.loadError')}{' '}
            <button type="button" className="font-medium text-accent" onClick={() => query.refetch()}>
              {t('common.retry')}
            </button>
          </p>
        )}
        {query.data && !trip && <p className="p-6 text-center text-secondary">{t('trip.gone')}</p>}

        {trip && (
          <>
            {route && <Alerts routeIds={[route.routeId]} />}

            <section className="rounded-2xl bg-surface p-gutter">
              <div className="flex items-center gap-2">
                {route && <RouteBadge route={route} />}
                <h1 className="min-w-0 flex-1 text-xl leading-tight font-bold">{t('trip.headsign', { to: trip.headsign ?? stops.at(-1)?.stop.name ?? '' })}</h1>
                {/* Top right: on time / late / early while it runs (the page being live is obvious); "scheduled" when there is no realtime */}
                {finished && <span className="shrink-0 text-[13px] text-secondary">{t('trip.past')}</span>}
                {!finished && !started && (
                  // Scheduled, not running yet: when it leaves, on two lines so it never wraps oddly
                  <span className="shrink-0 text-right text-[13px] leading-tight whitespace-nowrap text-secondary">
                    <span className="block font-medium">{t('trip.scheduled')}</span>
                    <span className="block">
                      {(() => {
                        const secs = (new Date(stops[0].departure).getTime() - now.getTime()) / 1000
                        return secs < 3600
                          ? t('trip.departingIn', { n: Math.max(1, Math.ceil(secs / 60)) })
                          : t('trip.departingAt', { time: formatTime(new Date(stops[0].departure)) })
                      })()}
                    </span>
                  </span>
                )}
                {started && !finished && (
                  <span className="shrink-0 text-[15px]">
                    {delay != null ? (
                      <DelayIndicator delay={delay} />
                    ) : (
                      <span className="rounded-full bg-fill px-2.5 py-0.5 text-[13px] font-medium text-secondary">{t('trip.scheduled')}</span>
                    )}
                  </span>
                )}
              </div>
              {viaStops(stops).length > 0 && (
                <p className="mt-1 text-[15px] text-secondary">
                  {t.rich('trip.via', { stops: <span className="text-label">{viaStops(stops).join(' ▸ ')}</span> })}
                </p>
              )}
              {stats(trip, tripPath, t) && <p className="mt-2 text-[15px] font-medium tabular-nums">{stats(trip, tripPath, t)}</p>}
              {/* Last update: small and quiet, but always there while the trip runs; a past or future trip gets its own note instead */}
              {started && !finished && vehicleAge != null && (
                <p className="mt-1 flex items-center text-[12px]">
                  <RefreshedAge seconds={vehicleAge * 60} />
                </p>
              )}
            </section>

            <section>
              <h2 className="px-1 pb-heading text-xl font-bold">{t('common.stops')}</h2>
              <ol className="overflow-hidden rounded-2xl bg-surface py-2">
                {stops.map((s, i) => (isFolded(i) ? (!isFolded(i - 1) ? <li key={`fold${i}`}>
                      <button type="button" onClick={() => setFoldEnd(null)} className={`flex w-full items-center pr-3 text-left active:bg-fill ${referenceTime != null ? 'pl-2' : ''}`}>
                        {referenceTime != null && <span className="w-[3.5ch] shrink-0 font-mono text-[13px]" aria-hidden />}
                        {/* The line, dashed where stops are folded away */}
                        <span className="relative mr-1.5 flex h-11 w-7 shrink-0 justify-center">
                          <span
                            className="absolute top-0 bottom-0 w-2 opacity-45"
                            style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 4px, ${color} 4px 10px)` }}
                          />
                        </span>
                        <span className="text-[15px] font-medium text-accent">{t('trip.earlierStops', { n: foldedRun(i) })}</span>
                      </button>
                    </li> : null) : (
                  <TripStopRow
                    key={`${s.stopSequence}`}
                    stop={s}
                    first={i === 0}
                    last={i === stops.length - 1}
                    passed={finished || (live && i < markIndex)}
                    greyTo={greyTo(i)}
                    vehicleProgress={live && i === markIndex ? markP : null}
                    highlighted={s.stop.stopId === from}
                    color={color}
                    vehicleLabel={route?.shortName ?? ''}
                    category={route ? categoryOf(route) : CATEGORIES[CATEGORIES.length - 1]}
                    referenceTime={referenceTime}
                    tripId={tripId}
                    showSeconds={hasSeconds}
                  />
                )))}
              </ol>
            </section>

            {vehicle && (vehicle.vehicleModel || vehicle.vehicleLicensePlate) && (
              <section>
                <h2 className="px-1 pb-heading text-xl font-bold">{t('trip.vehicle')}</h2>
                {/* What it is, big; its plate / fleet number under it. (BKK's "label" is the destination, so it isn't shown.) */}
                <div className="rounded-2xl bg-surface p-gutter">
                  <p className="text-[20px] leading-snug font-semibold">{vehicleName(vehicle.vehicleModel) ?? formatPlate(vehicle.vehicleLicensePlate)}</p>
                  {((vehicle.vehicleModel && vehicle.vehicleLicensePlate) || vehicle.vehicleWheelchairAccessible) && (
                    <p className="mt-0.5 flex items-center gap-2 text-[15px] text-secondary">
                      {vehicle.vehicleModel && vehicle.vehicleLicensePlate && <span>{formatPlate(vehicle.vehicleLicensePlate)}</span>}
                      {vehicle.vehicleWheelchairAccessible && <MarkIcon mark="lowFloor" label={t('common.wheelchair')} className="h-5 w-5 shrink-0" />}
                    </p>
                  )}
                </div>
              </section>
            )}

            <section>
              <h2 className="px-1 pb-heading text-xl font-bold">{t('common.map')}</h2>
              {/* A small, non-interactive TransitMap with this trip on it; tapping opens the same map full screen */}
              <MiniMap
                preview={<TransitMap compact bounds={tripBounds(stops)} trip={overlay ?? undefined} />}
                height={260}
                expand={(close) => <TransitMap onClose={close} bounds={tripBounds(stops)} trip={overlay ?? undefined} />}
              />
            </section>
          </>
        )}
      </main>
    </div>
  )
}

/** Delay at the last stop with realtime data at or before the vehicle. */
function latestDelay(stops: TripStop[], nextIndex: number) {
  const upto = nextIndex === -1 ? stops.length : nextIndex + 1
  for (let i = upto - 1; i >= 0; i--) {
    const s = stops[i]
    if (s.realtime) return s.departureDelay ?? s.arrivalDelay
  }
  return null
}

function TripStopRow({
  stop: s,
  first,
  last,
  passed,
  greyTo,
  vehicleProgress,
  highlighted,
  color,
  vehicleLabel,
  category,
  referenceTime,
  tripId,
  showSeconds,
}: {
  showSeconds: boolean
  referenceTime: number | null
  tripId: string
  stop: TripStop
  first: boolean
  last: boolean
  passed: boolean
  /** The line is faded from the top of the row down to here (0…48 px). */
  greyTo: number
  /** Set on the stop the vehicle is heading for: how far it is from the previous one (0…1). */
  vehicleProgress: number | null
  highlighted: boolean
  color: string
  vehicleLabel: string
  category: Category
}) {
  const t = useT()
  const arrival = new Date(s.arrival)
  const departure = new Date(s.departure)
  // At the last stop only the arrival matters; elsewhere the departure is the main time
  const main = last ? arrival : departure
  const delay = last ? (s.arrivalDelay ?? s.departureDelay) : (s.departureDelay ?? s.arrivalDelay)
  const status = realtimeStatus(s.realtime, delay)
  // Show the arrival too when the vehicle waits here for a minute or more
  const waits = !last && !first && departure.getTime() - arrival.getTime() >= 60_000
  // Minutes to or from the selected stop, always positive; blank on the stop itself
  const relative = referenceTime == null || highlighted ? null : Math.round(Math.abs(main.getTime() - referenceTime) / 60_000)
  const mainParts = formatTimeParts(main)
  const lineTop = first ? 24 : 0
  const lineBottom = last ? 24 : 48
  const cut = Math.min(Math.max(greyTo, lineTop), lineBottom)
  return (
    <li className="relative">
      <Link
        // Opening a stop from a trip counts its departures from when you get there (this trip's arrival), marked "Your trip"
        // (the list itself already starts a minute before, so this trip is in it)
        // The stop group's id (not the stop's), so the page reuses what lists already cached under ['station', groupId]
        to={`/stations/${encodeURIComponent(s.stop.station?.stationId ?? s.stop.stopId)}?from=${encodeURIComponent(s.stop.stopId)}&trip=${encodeURIComponent(tripId)}&at=${encodeURIComponent(new Date(s.arrival ?? s.departure).toISOString())}`}
        className={`flex items-center pr-3 active:bg-fill ${referenceTime != null ? 'pl-2' : ''}`}
      >
        {referenceTime != null && (
          <span className={`w-[3.5ch] shrink-0 text-right font-mono text-[13px] whitespace-pre text-secondary ${passed ? 'opacity-45' : ''}`} aria-label={relative != null ? t('trip.minutes', { n: relative }) : undefined}>
            {relative == null ? '' : `${String(relative).padStart(2, ' ')}'`}
          </span>
        )}
        <span className="relative mr-1.5 flex h-12 w-7 shrink-0 justify-center">
        {vehicleProgress != null && (
          // The vehicle: BKK pictogram for its type, in the line's colour, on a white disc, centred on its spot between the two stops
          <span
            className="absolute left-1/2 z-10 -translate-x-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-surface shadow-md"
            style={{ top: 48 * vehicleProgress - 38 }}
            aria-label={t('trip.vehicleHere')}
            title={vehicleLabel}
          >
            <CategoryIcon category={category} color={color} className="h-6 w-6" />
          </span>
        )}
          <span className="absolute w-2 opacity-45" style={{ top: lineTop, height: cut - lineTop, backgroundColor: color }} />
          <span className="absolute w-2" style={{ top: cut, height: lineBottom - cut, backgroundColor: color }} />
          <span
            className={`relative self-center rounded-full border-2 bg-surface ${highlighted ? 'h-4 w-4' : 'h-2.5 w-2.5'} ${passed ? 'opacity-45' : ''}`}
            style={{ borderColor: highlighted ? 'var(--color-label)' : color }}
          />
        </span>
        <span className={`mr-2 flex min-w-0 flex-1 items-center gap-1.5 ${passed ? 'opacity-45' : ''}`}>
          <span className={`truncate text-[17px] ${highlighted ? 'font-bold' : ''}`}>{s.stop.name ?? s.stop.stopId}</span>
        </span>
        <span className={`flex items-baseline gap-1 text-right tabular-nums ${statusColor[status]} ${passed ? 'opacity-45' : ''}`} title={t(statusLabel[status])}>
          {status === 'late' || status === 'early' ? (
            <span className="text-[12px] text-secondary line-through">{formatTime(new Date(main.getTime() - delay! * 1000))}</span>
          ) : null}
          {waits && <span className="text-[12px] opacity-75">{formatTime(arrival)}</span>}
          <span className={`text-[16px] ${status !== 'scheduled' ? 'font-semibold' : ''}`}>
            {mainParts.hm}
            {showSeconds && <span className="text-[11px] opacity-70">:{mainParts.s}</span>}
          </span>
          {status !== 'scheduled' && <LiveIcon className="h-3.5 w-3.5 self-center" aria-label={t('trip.realtime')} />}
        </span>
        <ChevronIcon className={`h-4 w-4 shrink-0 text-secondary/60 ${passed ? 'opacity-45' : ''}`} />
      </Link>
    </li>
  )
}


/** Up to three evenly spaced intermediate stops, so the route reads "via A · B · C". */
function viaStops(stops: TripStop[]) {
  const middle = stops.slice(1, -1)
  if (middle.length === 0) return []
  const n = Math.min(3, middle.length)
  return Array.from({ length: n }, (_, i) => middle[Math.floor(((i + 1) * middle.length) / (n + 1))]?.stop.name).filter(
    (name): name is string => !!name,
  )
}

/** Coloured delay on the status line: "3 min late" red, "2 min early" purple, ✓ on time. */
function DelayIndicator({ delay }: { delay: number }) {
  const t = useT()
  const minutes = Math.round(Math.abs(delay) / 60)
  if (minutes === 0)
    return (
      <span className="flex items-center gap-1 font-semibold text-live">
        <CheckIcon className="h-4 w-4" />
        {t('trip.onTime')}
      </span>
    )
  const late = delay > 0
  return <span className={`font-semibold tabular-nums ${late ? 'text-late' : 'text-early'}`}>{t(late ? 'trip.late' : 'trip.early', { n: minutes })}</span>
}

/**
 * "34 min · 12.4 km · 23 stops". Distance follows the route shape when the
 * feed has one, otherwise straight lines between stops (marked ~).
 */
function stats(trip: NonNullable<TripDetails['trip']>, tripPath: TripPath['trip'] extends infer T ? (T extends { path: infer P } ? P : null) : null, t: TFunction) {
  const stops = trip.stops
  if (stops.length < 2) return null
  const minutes = Math.round((new Date(stops[stops.length - 1].arrival).getTime() - new Date(stops[0].departure).getTime()) / 60_000)
  const path = tripPath?.coordinates ?? []
  let metres = 0
  let approx = false
  if (path.length > 1) {
    for (let i = 1; i < path.length; i++) metres += distance({ lat: path[i - 1][1], lon: path[i - 1][0] }, { lat: path[i][1], lon: path[i][0] })
  } else {
    approx = true
    for (let i = 1; i < stops.length; i++) {
      const a = stops[i - 1].stop
      const b = stops[i].stop
      if (a.lat != null && a.lon != null && b.lat != null && b.lon != null) metres += distance({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon })
    }
  }
  const km = metres > 0 ? `${approx ? '~' : ''}${formatNumber(metres / 1000, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km` : null
  return [t('trip.statsMinutes', { n: minutes }), km, t('trip.statsStops', { n: stops.length })].filter(Boolean).join(' · ')
}

/** Loading state shaped like the real page; with the tapped row's line and destination already filled in. */
function TripSkeleton({ preview }: { preview: TripPreview | null }) {
  const t = useT()
  return (
    <>
      <section className="rounded-2xl bg-surface p-gutter">
        <div className="flex h-7 items-center gap-2">
          {preview?.route ? <RouteBadge route={preview.route} /> : <span className="h-6 w-12 animate-pulse rounded-md bg-fill" />}
        </div>
        {preview?.headsign ? (
          <h1 className="mt-1 text-2xl leading-tight font-bold">{t('trip.headsign', { to: preview.headsign })}</h1>
        ) : (
          <div className="mt-2 h-7 w-2/3 animate-pulse rounded-md bg-fill" />
        )}
        <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-fill" />
        <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-fill" />
      </section>
      <section>
        <div className="mx-1 mb-2 h-6 w-24 animate-pulse rounded bg-fill" />
        <ol className="overflow-hidden rounded-2xl bg-surface py-2">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="flex h-12 items-center gap-3 px-gutter">
              <span className="h-2.5 w-2.5 rounded-full bg-fill" />
              <span className="h-4 flex-1 animate-pulse rounded bg-fill" style={{ maxWidth: `${55 + ((i * 37) % 35)}%` }} />
              <span className="h-4 w-12 animate-pulse rounded bg-fill" />
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}


/** [[west, south], [east, north]] around the trip's stops */
function tripBounds(stops: TripStop[]): [[number, number], [number, number]] | undefined {
  const pts = stops.filter((s) => s.stop.lat != null && s.stop.lon != null)
  if (!pts.length) return undefined
  const lons = pts.map((s) => s.stop.lon!)
  const lats = pts.map((s) => s.stop.lat!)
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ]
}

/**
 * Where a position is along the stops, in stop units: the nearest point on the straight lines between stops (2.4 = 40 % of the
 * way from the third stop to the fourth). Null when there are no coordinates.
 */
function snapToStops(stops: TripStop[], lat: number, lon: number): number | null {
  const kx = Math.cos((lat * Math.PI) / 180) * 111_320
  const ky = 110_540
  let best: { d: number; pos: number } | null = null
  for (let i = 0; i + 1 < stops.length; i++) {
    const a = stops[i].stop
    const b = stops[i + 1].stop
    if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) continue
    const ax = (a.lon - lon) * kx
    const ay = (a.lat - lat) * ky
    const bx = (b.lon - lon) * kx
    const by = (b.lat - lat) * ky
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 > 0 ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / len2)) : 0
    const d = Math.hypot(ax + dx * t, ay + dy * t)
    if (!best || d < best.d) best = { d, pos: i + t }
  }
  return best ? best.pos : null
}
