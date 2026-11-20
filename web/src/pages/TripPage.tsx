import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router'
import { CheckIcon, ChevronIcon, LiveIcon } from '../components/Icons'
import Alerts from '../components/Alerts'
import MiniMap from '../components/MiniMap'
import NavBar from '../components/NavBar'
import RouteBadge from '../components/RouteBadge'
import { gql, TRIP_QUERY, type RouteRef, type TripDetails, type TripStop } from '../lib/api'
import { distance } from '../lib/geo'
import { CATEGORIES, categoryOf, type Category } from '../lib/categories'
import CategoryIcon from '../components/CategoryIcon'
import { hex } from '../lib/geo'
import { realtimeStatus, statusColor, statusLabel } from '../lib/realtimeStatus'
import { formatTime, formatTimeParts } from '../lib/time'
import { REFRESH_MS, useNow } from '../lib/useTimetable'

/** One vehicle's run: where it is, when it reaches each stop. */
export default function TripPage() {
  const { tripId = '' } = useParams()
  const [params] = useSearchParams()
  const date = params.get('date') || undefined
  const from = params.get('from')
  const now = useNow(1_000)

  const query = useQuery({
    queryKey: ['trip', tripId, date],
    queryFn: () => gql<TripDetails>(TRIP_QUERY, { id: tripId, serviceDate: date }),
    refetchInterval: REFRESH_MS,
  })
  const trip = query.data?.trip
  const route = trip?.route
  const color = hex(route?.color, '#6b7280')
  const stops = trip?.stops ?? []

  // The vehicle sits between the last stop it has left and the next one.
  const nextIndex = stops.findIndex((s) => new Date(s.departure).getTime() > now.getTime())
  const started = nextIndex !== 0 && stops.length > 0
  const finished = nextIndex === -1 && stops.length > 0
  const delay = latestDelay(stops, nextIndex)
  const vehicle = trip?.vehicle
  // Reference for the relative-minutes column: the stop you came from
  const reference = stops.find((x) => x.stop.stopId === from)
  const referenceTime = reference ? new Date(reference.departure).getTime() : null
  // Only show seconds when the data has them (realtime predictions, MÁV); plain schedules are all :00
  const hasSeconds = stops.some((x) => new Date(x.arrival).getSeconds() !== 0 || new Date(x.departure).getSeconds() !== 0)
  const vehicleAge = vehicle?.timestamp ? (now.getTime() - new Date(vehicle.timestamp).getTime()) / 60_000 : null

  return (
    <div className="min-h-dvh">
      <NavBar back={{ label: 'Back' }} leading={route && <RouteBadge route={route} size="lg" />} />

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        {query.isPending && <div className="h-40 animate-pulse rounded-2xl bg-surface" />}
        {query.isError && (
          <p className="p-6 text-center text-secondary">
            Couldn't load this trip.{' '}
            <button type="button" className="font-medium text-accent" onClick={() => query.refetch()}>
              Retry
            </button>
          </p>
        )}
        {query.data && !trip && <p className="p-6 text-center text-secondary">This trip no longer exists.</p>}

        {trip && (
          <>
            {route && <Alerts routeIds={[route.routeId]} />}

            <section className="rounded-2xl bg-surface p-4">
              <div className="flex items-center gap-2">
                {route && <RouteBadge route={route} />}
                <span className="text-secondary">towards</span>
                {stops.some((x) => x.realtime) ? (
                  <span className="ml-auto flex items-center gap-1.5 rounded-full bg-live/15 px-2.5 py-0.5 text-[13px] font-semibold text-live">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
                    </span>
                    LIVE
                  </span>
                ) : (
                  <span className="ml-auto rounded-full bg-fill px-2.5 py-0.5 text-[13px] font-medium text-secondary">Scheduled</span>
                )}
              </div>
              <h1 className="mt-1 text-2xl leading-tight font-bold">{trip.headsign ?? stops.at(-1)?.stop.name}</h1>
              {viaStops(stops).length > 0 && (
                <p className="mt-1 text-[15px]">
                  <span className="text-secondary">via </span>
                  {viaStops(stops).join(' · ')}
                </p>
              )}
              {stats(trip) && <p className="mt-2 text-[15px] font-medium tabular-nums">{stats(trip)}</p>}
              {/* Delay sits bottom-left, on the status line, so it adds no height to the destination */}
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[15px] text-secondary">
                {delay != null && started && !finished && <DelayIndicator delay={delay} />}
                {finished ? 'This trip has finished.' : !started ? `Starts at ${formatTime(new Date(stops[0].departure))}` : 'On its way'}
                {started && !finished && vehicleAge != null && <UpdatedAgo seconds={vehicleAge * 60} />}
              </p>
            </section>

            <section>
              <h2 className="px-1 pb-2 text-xl font-bold">Stops</h2>
              <ol className="overflow-hidden rounded-2xl bg-surface py-2">
                {stops.map((s, i) => (
                  <TripStopRow
                    key={`${s.stopSequence}`}
                    stop={s}
                    first={i === 0}
                    last={i === stops.length - 1}
                    passed={nextIndex === -1 || i < nextIndex}
                    vehicleBefore={started && !finished && i === nextIndex}
                    highlighted={s.stop.stopId === from}
                    color={color}
                    vehicleLabel={route?.shortName ?? ''}
                    category={route ? categoryOf(route) : CATEGORIES[CATEGORIES.length - 1]}
                    currentRouteId={route?.routeId}
                    referenceTime={referenceTime}
                    tripId={tripId}
                    showSeconds={hasSeconds}
                  />
                ))}
              </ol>
            </section>

            {vehicle && (vehicle.vehicleLabel || vehicle.vehicleLicensePlate) && (
              <section>
                <h2 className="px-1 pb-2 text-xl font-bold">Vehicle</h2>
                <div className="rounded-2xl bg-surface p-4">
                  <p className="text-[17px] font-semibold">{vehicle.vehicleLabel ?? vehicle.vehicleLicensePlate}</p>
                  <p className="text-[15px] text-secondary">
                    {[
                      vehicle.vehicleLicensePlate && vehicle.vehicleLabel ? `Number ${vehicle.vehicleLicensePlate}` : null,
                      vehicle.vehicleWheelchairAccessible ? 'Wheelchair accessible' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </section>
            )}

            <section>
              <h2 className="px-1 pb-2 text-xl font-bold">Map</h2>
              <MiniMap
                color={color}
                line={trip.path?.coordinates.map(([lon, lat]) => [lat, lon] as [number, number])}
                points={stops
                  .filter((s) => s.stop.lat != null && s.stop.lon != null)
                  .map((s) => ({ lat: s.stop.lat!, lon: s.stop.lon!, strong: s.stop.stopId === from }))}
                vehicle={
                  vehicle?.latitude != null && vehicle.longitude != null
                    ? { lat: vehicle.latitude, lon: vehicle.longitude, label: route?.shortName ?? '•', bg: color, fg: hex(route?.textColor, '#ffffff') }
                    : null
                }
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
  vehicleBefore,
  highlighted,
  color,
  vehicleLabel,
  category,
  currentRouteId,
  referenceTime,
  tripId,
  showSeconds,
}: {
  showSeconds: boolean
  currentRouteId?: string
  referenceTime: number | null
  tripId: string
  stop: TripStop
  first: boolean
  last: boolean
  passed: boolean
  vehicleBefore: boolean
  highlighted: boolean
  color: string
  vehicleLabel: string
  category: Category
}) {
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
  const transfers = transferLines(s.stop.station?.routes ?? [], currentRouteId)
  return (
    <li className="relative">
      <Link
        // Opening a stop from a trip starts its departures at this trip, marked "Your trip"
        to={`/stations/${encodeURIComponent(s.stop.stopId)}?from=${encodeURIComponent(s.stop.stopId)}&trip=${encodeURIComponent(tripId)}&at=${encodeURIComponent(new Date(new Date(s.departure).getTime() - 60_000).toISOString())}`}
        className={`flex items-center pr-3 active:bg-fill ${passed ? 'opacity-45' : ''} ${referenceTime != null ? 'pl-2' : ''}`}
      >
        {referenceTime != null && (
          <span className="w-[3.5ch] shrink-0 text-right font-mono text-[13px] whitespace-pre text-secondary" aria-label={relative != null ? `${relative} minutes` : undefined}>
            {relative == null ? '' : `${String(relative).padStart(2, ' ')}'`}
          </span>
        )}
        <span className="relative mr-1.5 flex h-12 w-7 shrink-0 justify-center">
        {vehicleBefore && (
          // The vehicle: BKK pictogram for its type, in the line's colour, on a white disc
          <span
            className="absolute -top-3.5 left-1/2 z-10 -translate-x-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-surface shadow-md"
            aria-label="Vehicle is here"
            title={vehicleLabel}
          >
            <CategoryIcon category={category} color={color} className="h-6 w-6" />
          </span>
        )}
          <span
            className={`absolute w-2 ${first ? 'top-1/2' : 'top-0'} ${last ? 'bottom-1/2' : 'bottom-0'}`}
            style={{ backgroundColor: color }}
          />
          <span
            className={`relative self-center rounded-full border-2 bg-surface ${highlighted ? 'h-4 w-4' : 'h-2.5 w-2.5'}`}
            style={{ borderColor: highlighted ? 'var(--color-label)' : color }}
          />
        </span>
        <span className="mr-2 flex min-w-0 flex-1 items-center gap-1.5">
          <span className={`truncate text-[17px] ${highlighted ? 'font-bold' : ''}`}>{s.stop.name ?? s.stop.stopId}</span>
          {transfers.map((r) => (
            <RouteBadge key={r.routeId} route={r} />
          ))}
        </span>
        <span className={`flex items-baseline gap-1 text-right tabular-nums ${statusColor[status]}`} title={statusLabel[status]}>
          {status === 'late' || status === 'early' ? (
            <span className="text-[12px] text-secondary line-through">{formatTime(new Date(main.getTime() - delay! * 1000))}</span>
          ) : null}
          {waits && <span className="text-[12px] opacity-75">{formatTime(arrival)}</span>}
          <span className={`text-[16px] ${status !== 'scheduled' ? 'font-semibold' : ''}`}>
            {mainParts.hm}
            {showSeconds && <span className="text-[11px] opacity-70">:{mainParts.s}</span>}
          </span>
          {status !== 'scheduled' && <LiveIcon className="h-3.5 w-3.5 self-center" aria-label="Realtime" />}
        </span>
        <ChevronIcon className="h-4 w-4 shrink-0 text-secondary/60" />
      </Link>
    </li>
  )
}

/**
 * Interchange markers next to a stop: metro and HÉV lines reachable at that
 * stop group (not the line you're on). Our own choice, not from the data:
 * buses and trams are everywhere, and other "rail" in the feed (mainline
 * trains, the Children's Railway) would mostly be noise.
 */
function transferLines(routes: RouteRef[], currentRouteId?: string) {
  const major = routes.filter(
    (r) => r.routeId !== currentRouteId && (r.type === 'SUBWAY' || /^H\d+$/.test(r.shortName ?? '')),
  )
  const seen = new Set<string>()
  return major.filter((r) => {
    const key = r.shortName ?? r.routeId
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 4)
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

/**
 * " · updated 42s ago", counting every second. BKK's data is already 10–15 s
 * old when it arrives, so only call it out past 30 s. The number sits in a
 * fixed two-digit box (right-aligned, tabular figures) so it doesn't jiggle.
 */
function UpdatedAgo({ seconds }: { seconds: number }) {
  if (seconds < 30) return null
  const s = Math.floor(seconds)
  return (
    <span>
      {' · updated '}
      {s < 60 ? (
        <>
          <span className="inline-block min-w-[2ch] text-right tabular-nums">{s}</span>s ago
        </>
      ) : (
        <>
          <span className="tabular-nums">{Math.floor(s / 60)}</span> min ago
        </>
      )}
    </span>
  )
}

/** Coloured delay on the status line: "3 min late" red, "2 min early" purple, ✓ on time. */
function DelayIndicator({ delay }: { delay: number }) {
  const minutes = Math.round(Math.abs(delay) / 60)
  if (minutes === 0)
    return (
      <span className="flex items-center gap-1 font-semibold text-live">
        <CheckIcon className="h-4 w-4" />
        On time
      </span>
    )
  const late = delay > 0
  return <span className={`font-semibold tabular-nums ${late ? 'text-late' : 'text-early'}`}>{minutes} min {late ? 'late' : 'early'}</span>
}

/**
 * "34 min · 12.4 km · 23 stops". Distance follows the route shape when the
 * feed has one, otherwise straight lines between stops (marked ~).
 */
function stats(trip: NonNullable<TripDetails['trip']>) {
  const stops = trip.stops
  if (stops.length < 2) return null
  const minutes = Math.round((new Date(stops[stops.length - 1].arrival).getTime() - new Date(stops[0].departure).getTime()) / 60_000)
  const path = trip.path?.coordinates ?? []
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
  const km = metres > 0 ? `${approx ? '~' : ''}${(metres / 1000).toFixed(1)} km` : null
  return [`${minutes} min`, km, `${stops.length} stops`].filter(Boolean).join(' · ')
}
