import { useQuery } from '@tanstack/react-query'
import type { LngLatBounds } from 'maplibre-gl'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { LngLatBoundsLike } from 'maplibre-gl'
import { Link, useNavigate } from 'react-router'
import { LayersThree } from '@mynaui/icons-react'
import { CloseIcon, LocationIcon } from './Icons'

/** The bottom card for a vehicle or a stop: title row, info line, status line, and a full-width button. Same layout on iOS. */
function CardLayout({
  onClose,
  badge,
  title,
  info,
  status,
  action,
}: {
  onClose: () => void
  badge?: ReactNode
  title: string
  info: string | null
  status: ReactNode
  action: { to: string; label: string } | null
}) {
  const t = useT()
  return (
    <SheetCard onClose={onClose}>
      <button type="button" onClick={onClose} aria-label={t('card.close')} className="absolute top-3 right-3 rounded-full bg-fill p-1.5 active:opacity-60">
        <CloseIcon className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2 pr-16">
        {badge}
        <span className="truncate text-[17px] font-semibold">{title}</span>
      </div>
      {info && <p className="mt-0.5 truncate text-[15px] text-secondary">{info}</p>}
      <div className="mt-1.5 flex min-h-[20px] items-center gap-2 text-[15px]">{status}</div>
      {action && (
        <Link to={action.to} className="mt-3 block w-full rounded-[14px] bg-accent py-[14px] text-center text-[17px] font-semibold text-white active:opacity-60">
          {action.label}
        </Link>
      )}
    </SheetCard>
  )
}

import RouteBadge from './RouteBadge'
import FitBadges from './FitBadges'
import { RefreshedAge } from './RefreshedAge'
import { gql, MAP_STOPS_QUERY, ROUTE_LINES_QUERY, TRIP_QUERY, VEHICLES_QUERY, type NearbyStations, type RouteRef, type TripDetails, type TripStop, type VehiclePosition, type Vehicles } from '../lib/api'
import { tripKey } from '../lib/prefetch'
import { distance } from '../lib/geo'
import { BADGES_ZOOM, groupIcon, GROUPS_ZOOM, STOPS_ZOOM, vehicleIcon } from '../lib/mapIcons'
import { formatTime } from '../lib/time'
import { LIVE_ICON_HTML, statusCss, type RealtimeStatus } from '../lib/realtimeStatus'
import { categoryOf } from '../lib/categories'
import { useMapLayers } from '../lib/mapLayers'
import LayersMenu from './LayersMenu'
import { tappedMarker, useGeoJson, useGlMap, useMarkers, type GlMap, type HtmlMarker } from '../lib/glmap'
import { useGeolocation } from '../lib/useGeolocation'
import { vehicleName } from '../lib/vehicle'
import { formatPlate } from '../lib/plate'
import { useT } from '../lib/i18n'

/**
 * Where the map opens without location access: Széll Kálmán tér.
 * TODO: on the long run, open on a view that covers all of Budapest, or make
 * the start point a setting (e.g. home stop / last viewed position).
 */
const DEFAULT_CENTER: [number, number] = [19.0236, 47.5073]

/** One trip drawn on top of the map: its path, its stops with times, and its vehicle. */
export type TripOverlay = {
  tripId: string
  color: string
  headsign: string | null
  path: [number, number][] // [lon, lat]
  stops: {
    stopId: string
    stationId: string | null
    name: string
    lat: number
    lon: number
    time: Date
    passed: boolean
    strong?: boolean
    /** Realtime status of this time (colours the label; live data gets the live mark) */
    status: RealtimeStatus
  }[]
}


type View = { center: { lat: number; lon: number }; bounds: LngLatBounds; zoom: number }
const viewOf = (map: GlMap): View => {
  const c = map.getCenter()
  return { center: { lat: c.lat, lon: c.lng }, bounds: map.getBounds(), zoom: map.getZoom() }
}

/**
 * The transit map: stop groups / stops, live vehicles, your location. Used
 * full screen on the Map page and, with a `trip` overlay, from a trip: then
 * only that trip (path, stops with times, its vehicle) shows until you ask for
 * everything else too.
 */
export default function TransitMap({
  trip,
  bounds,
  onClose,
  compact = false,
}: {
  trip?: TripOverlay
  /** A small, non-interactive preview of a trip: no cards, buttons or taps (the page wraps it to open the full map) */
  compact?: boolean
  bounds?: LngLatBoundsLike
  /** Shows a ✕ (top right) that calls this */
  onClose?: () => void
}) {
  const t = useT()
  const location = useGeolocation()
  const container = useRef<HTMLDivElement>(null)
  const map = useGlMap(container, bounds ? { bounds, padding: compact ? 24 : 48, interactive: !compact } : { center: DEFAULT_CENTER, zoom: 15 })
  // With a trip: just that trip until "show everything"
  const [showAll, setShowAll] = useState(!trip)
  const [layers] = useMapLayers()
  const [layersOpen, setLayersOpen] = useState(false)
  const navigate = useNavigate()
  const [view, setView] = useState<View | null>(null)
  // Which zoom band the map is in (0 groups off, 1 groups, 2 single stops). Follows the zoom live, and only changes when a threshold is crossed.
  const [band, setBand] = useState(0)
  const [selectedStop, setSelectedStop] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (!map) return
    setView(viewOf(map))
    const bandOf = (z: number) => (z >= STOPS_ZOOM ? 2 : z >= GROUPS_ZOOM ? 1 : 0)
    setBand(bandOf(map.getZoom()))
    // Live zoom: the stop groups and single stops switch the moment the threshold is crossed, not when the gesture ends
    const onZoom = () => setBand(bandOf(map.getZoom()))
    map.on('zoom', onZoom)
    const onMove = () => setView(viewOf(map))
    // Tapping empty map clears the selection
    // Tapping empty map clears a selected stop; the vehicle card stays until its ✕
    const onClick = () => {
      if (tappedMarker()) return
      setSelectedStop(null)
    }
    map.on('moveend', onMove)
    map.on('click', onClick)
    return () => {
      map.off('moveend', onMove)
      map.off('zoom', onZoom)
      map.off('click', onClick)
    }
  }, [map])

  useEffect(() => {
    if (map && location.coords) map.flyTo({ center: [location.coords.lon, location.coords.lat], zoom: 15.5 })
  }, [map, location.coords])

  // Stop groups around the centre; radius covers the visible area (capped), rounded so small pans reuse the cache
  const zoom = view?.zoom ?? 0
  const enabled = !!view && band >= 1 && showAll && layers.stops
  const round = (n: number) => Math.round(n * 500) / 500
  const center = view ? { lat: round(view.center.lat), lon: round(view.center.lon) } : { lat: 0, lon: 0 }
  // Farthest visible corner from the (rounded) centre, plus slack: a stop group's
  // centre can sit up to ~400 m from its stops, so groups just off-screen still count
  const corner = view
    ? Math.max(
        distance(center, { lat: view.bounds.getNorth(), lon: view.bounds.getEast() }),
        distance(center, { lat: view.bounds.getSouth(), lon: view.bounds.getWest() }),
      )
    : 0
  // One query for every zoom (stops included), so zooming in never waits on a second fetch
  const radius = Math.min(1500, Math.ceil((corner + 300) / 100) * 100)
  const stations = useQuery({
    queryKey: ['mapStations', center, radius],
    queryFn: () => gql<NearbyStations>(MAP_STOPS_QUERY, { ...center, radius }),
    enabled,
    staleTime: 60 * 60_000,
    placeholderData: (prev) => prev,
  })

  // Vehicles in the visible area only (padded a little), every 30 s (the server's realtime cache)
  const r3 = (n: number) => Math.round(n * 200) / 200
  const pad = view ? Math.max(view.bounds.getNorth() - view.bounds.getSouth(), view.bounds.getEast() - view.bounds.getWest()) * 0.2 : 0
  const tripBox =
    trip && !showAll && trip.stops.length
      ? {
          minLat: r3(Math.min(...trip.stops.map((x) => x.lat)) - 0.01),
          minLon: r3(Math.min(...trip.stops.map((x) => x.lon)) - 0.01),
          maxLat: r3(Math.max(...trip.stops.map((x) => x.lat)) + 0.01),
          maxLon: r3(Math.max(...trip.stops.map((x) => x.lon)) + 0.01),
        }
      : null
  const vbox = tripBox ?? (view
    ? {
        minLat: r3(view.bounds.getSouth() - pad),
        minLon: r3(view.bounds.getWest() - pad),
        maxLat: r3(view.bounds.getNorth() + pad),
        maxLon: r3(view.bounds.getEast() + pad),
      }
    : null)
  const vehicleQuery = useQuery({
    queryKey: ['vehicles', vbox],
    queryFn: () => gql<Vehicles>(VEHICLES_QUERY, { bbox: vbox }),
    enabled: !!vbox,
    refetchInterval: 10_000,
    staleTime: 8_000,
    placeholderData: (prev) => prev,
  })
  // A vehicle never goes back in time: the query is cached per visible area, so panning or zooming back to an
  // earlier area can hand us older positions. Keep the newest fix we've seen per vehicle.
  // Keep the last known data of the tapped vehicle, so its card stays when it leaves the view
  const [lastSelected, setLastSelected] = useState<VehiclePosition | null>(null)
  const fresh = (vehicleQuery.data?.vehiclePositions ?? []).find((v) => v?.id === selected) ?? null
  useEffect(() => {
    if (fresh) setLastSelected(fresh)
  }, [fresh])
  const selectedVehicle = selected ? (fresh ?? (lastSelected?.id === selected ? lastSelected : null)) : null
  const newest = useRef(new Map<string, VehiclePosition>())
  const vehicles = useMemo(
    () =>
      (vehicleQuery.data?.vehiclePositions ?? [])
        .map((v) => {
          if (!v) return v
          const ts = (x: VehiclePosition) => Number(x.timestamp) || Date.parse(x.timestamp ?? '') || 0
          const seen = newest.current.get(v.id)
          if (seen && ts(seen) > ts(v)) return seen
          newest.current.set(v.id, v)
          return v
        })
        .filter(
        (v): v is VehiclePosition & { latitude: number; longitude: number } =>
          !!v &&
          v.latitude != null &&
          v.longitude != null &&
          !!view &&
          // The trip's own vehicle always; others only with "show everything" + the Vehicles layer.
          // (Guard on trip: without one, undefined === undefined would keep trip-less vehicles.)
          ((!!trip && v.trip?.tripId === trip.tripId) || v.id === selected || (showAll && layers.vehicles && view.bounds.contains([v.longitude, v.latitude]))),
      ),
    [vehicleQuery.data, view, showAll, trip?.tripId, layers.vehicles, selected],
  )

  const groups = useMemo(() => (stations.data?.stationsByRadius ?? []).filter((s) => s.routes.length > 0), [stations.data])

  // Only the zoom thresholds matter for the icons, not the raw zoom (that would rebuild every icon on each zoom gesture)
  const stopsZoom = band >= 2
  const badgesZoom = zoom >= BADGES_ZOOM
  // Markers only near the visible area (the query radius reaches well beyond the screen)
  const cull = useMemo(() => {
    if (!view) return null
    const b = view.bounds
    const padLat = (b.getNorth() - b.getSouth()) * 0.25
    const padLon = (b.getEast() - b.getWest()) * 0.25
    return { s: b.getSouth() - padLat, n: b.getNorth() + padLat, w: b.getWest() - padLon, e: b.getEast() + padLon }
  }, [view])

  // Stop groups (big cards) when zoomed out, single stops (small cards with their direction) when zoomed in
  const stopMarkers = useMemo(() => {
    const markers: HtmlMarker[] = []
    if (!enabled) return markers
    for (const station of groups) {
      const stops = (station.stops ?? []).filter((s) => s.lat != null && s.lon != null && (s.routes ?? []).some(Boolean))
      if (stopsZoom && stops.length > 0) {
        for (const s of stops) {
          const sel = selectedStop === s.stopId
          if (!sel && cull && (s.lat! < cull.s || s.lat! > cull.n || s.lon! < cull.w || s.lon! > cull.e)) continue
          const routes = (s.routes ?? []).filter((r) => r != null)
          markers.push({
            key: `stop:${s.stopId}`,
            at: [s.lon!, s.lat!],
            ...groupIcon({ name: s.name ?? station.name, routes }, true, sel),
            selected: sel,
            z: sel ? 1000 : 0,
            // The card only selects; the popup at the bottom is what opens the stop
            onClick: () => (setSelectedStop(s.stopId), setSelected(null)),
          })
        }
      } else {
        const sel = selectedStop === station.stationId
        if (!sel && cull && (station.lat < cull.s || station.lat > cull.n || station.lon < cull.w || station.lon > cull.e)) continue
        markers.push({
          key: `group:${station.stationId}`,
          at: [station.lon, station.lat],
          // First tap shows the card (or highlights it); tapping it again opens the stop
          ...groupIcon(station, badgesZoom || sel, sel),
          selected: sel,
          z: sel ? 1000 : 0,
          onClick: () => (setSelectedStop(station.stationId), setSelected(null)),
        })
      }
    }
    return markers
  }, [enabled, groups, stopsZoom, badgesZoom, cull, selectedStop, navigate])


  const me = useMemo<HtmlMarker[]>(
    () =>
      location.coords
        ? [
            {
              key: 'me',
              at: [location.coords.lon, location.coords.lat],
              html: '<div style="width:18px;height:18px;box-sizing:border-box;border-radius:50%;background:#2563eb;border:3px solid #fff"></div>',
              size: [18, 18],
              z: 1500,
            },
          ]
        : [],
    [location.coords],
  )

  // Lines layer: every line of the chosen types, under everything else, in its own colour
  const lineTypes = [...new Set(layers.lines.map((k) => ({ metro: 'SUBWAY', tram: 'TRAM', trolley: 'TROLLEYBUS', bus: 'BUS', night: 'BUS', boat: 'FERRY' })[k as string]).filter(Boolean))].sort()
  const linesQuery = useQuery({
    queryKey: ['routeLines', lineTypes],
    queryFn: () => gql<{ routeLines: string }>(ROUTE_LINES_QUERY, { types: lineTypes }),
    enabled: lineTypes.length > 0 && showAll,
    staleTime: 24 * 60 * 60_000,
  })
  const lines = useMemo(() => {
    if (!linesQuery.data || lineTypes.length === 0 || !showAll) return null
    const all = JSON.parse(linesQuery.data.routeLines) as GeoJSON.FeatureCollection
    const want = new Set(layers.lines)
    // Day vs night buses share a type; tell them apart like the Routes page does
    const features = all.features.filter((f) => want.has(categoryOf({ type: f.properties!.type, color: f.properties!.color }).key))
    return { type: 'FeatureCollection', features } as GeoJSON.FeatureCollection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesQuery.data, layers.lines.join(','), showAll])
  useGeoJson(map, 'route-lines', lines, [
    {
      id: 'route-lines',
      type: 'line',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-opacity': 0.85,
        // Metro a bit bolder; all thicker as you zoom in
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, ['case', ['==', ['get', 'type'], 'SUBWAY'], 2.5, 1.2], 16, ['case', ['==', ['get', 'type'], 'SUBWAY'], 7, 4]],
      },
    },
  ])

  // The selected vehicle stays on the map even when the area query no longer includes it (zoomed in past it)
  const shownVehicles = useMemo(
    () => (selectedVehicle && selectedVehicle.latitude != null && selectedVehicle.longitude != null && !vehicles.some((v) => v.id === selected) ? [...vehicles, selectedVehicle as (typeof vehicles)[number]] : vehicles),
    [vehicles, selectedVehicle, selected],
  )
  const vehicleMarkers = useMemo<HtmlMarker[]>(
    () =>
      shownVehicles.map((v) => ({
        key: `veh:${v.id}`,
        at: [v.longitude, v.latitude],
        ...vehicleIcon(v.trip?.route ?? null, v.bearing, band === 0, selected === v.id),
        selected: selected === v.id,
        z: selected === v.id ? 2000 : 500,
        // First tap: details card. Tap the same vehicle again: open its trip.
        onClick: compact ? undefined : () => {
          if (selected === v.id && v.trip) navigate(tripUrl(v))
          else {
            setSelected(v.id)
            setSelectedStop(null)
          }
        },
      })),
    [shownVehicles, band, selected, navigate, compact],
  )

  // The trip: its path as a line in the line's colour, its stops as dots with the time it gets there
  const tripPathData = useMemo<GeoJSON.Feature | null>(
    () => (trip && trip.path.length > 1 ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: trip.path } } : null),
    [trip],
  )
  useGeoJson(
    map,
    'trip-path',
    tripPathData,
    [
      { id: 'trip-path-casing', type: 'line', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 9 } },
      { id: 'trip-path', type: 'line', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': trip?.color ?? '#2563eb', 'line-width': 5 } },
    ],
  )
  const tripStopMarkers = useMemo<HtmlMarker[]>(
    () =>
      (trip?.stops ?? []).map((s) => {
        const sel = selectedStop === s.stopId
        // Same dot as the stops on the main map (in the line's colour; the stop you came from is dark), with the time instead of the platform's badges
        const dot =
          `<div style="position:absolute;left:-22px;top:-22px;width:44px;height:44px;border-radius:50%"></div>` +
          `<div style="position:absolute;left:-7.5px;top:-7.5px;width:15px;height:15px;box-sizing:border-box;border-radius:50%;background:${s.strong ? '#111' : trip!.color};border:2px solid #fff"></div>`
        // Coloured like the stop list (late red, early purple, on time green), live mark when it's realtime
        const live = s.status !== 'scheduled'
        const label = `<div style="position:absolute;left:10px;top:-9px;width:max-content;display:flex;align-items:center;gap:2px;font:600 11px/18px system-ui;padding:0 5px;border-radius:5px;background:rgb(255 255 255/.92);color:${statusCss[s.status] === 'inherit' ? '#111' : statusCss[s.status]}">${formatTime(s.time)}${live ? LIVE_ICON_HTML : ''}</div>`
        return {
          key: `tripstop:${s.stopId}:${s.time.getTime()}`,
          at: [s.lon, s.lat] as [number, number],
          html: `<div style="opacity:${s.passed && !sel ? 0.5 : 1}">${dot}${label}</div>`,
          selected: sel,
          z: sel ? 3000 : 800,
          // Like any stop: the tap selects it, the card at the bottom opens it
          onClick: compact ? undefined : () => (setSelectedStop(s.stopId), setSelected(null)),
        }
      }),
    [trip, selectedStop, compact],
  )
  const allMarkers = useMemo(() => [...stopMarkers, ...tripStopMarkers, ...vehicleMarkers, ...me], [stopMarkers, tripStopMarkers, vehicleMarkers, me])
  useMarkers(map, allMarkers)


  // The tapped stop (a whole group when zoomed out, a single platform when zoomed in), for its bottom card
  const selectedStopInfo = useMemo(() => {
    if (!selectedStop) return null
    // A stop of the trip on show: its time (coloured like the stop list) and where the trip is headed
    const ts = trip?.stops.find((x) => x.stopId === selectedStop)
    if (ts) {
      const at = new Date(ts.time.getTime() - 60_000).toISOString()
      return {
        name: ts.name,
        towards: trip!.headsign ? [trip!.headsign] : [],
        routes: [] as RouteRef[],
        time: ts,
        to: `/stations/${encodeURIComponent(ts.stationId ?? ts.stopId)}?from=${encodeURIComponent(ts.stopId)}&trip=${encodeURIComponent(trip!.tripId)}&at=${encodeURIComponent(at)}`,
      }
    }
    for (const st of groups) {
      if (st.stationId === selectedStop)
        return { name: st.name, towards: [] as string[], routes: st.routes.filter(Boolean), time: null, to: `/stations/${encodeURIComponent(st.stationId)}` }
      const p = st.stops?.find((x) => x.stopId === selectedStop)
      if (p)
        return {
          name: p.name ?? st.name,
          towards: p.headsigns ?? [],
          time: null,
          routes: (p.routes ?? []).filter((r): r is NonNullable<typeof r> => !!r),
          to: `/stations/${encodeURIComponent(st.stationId)}?from=${encodeURIComponent(p.stopId)}`,
        }
    }
    return null
  }, [selectedStop, groups, trip])

  return (
    <div className="relative h-full w-full">
      {/* isolate: markers' z-index stays inside the map, so cards and buttons always draw above them */}
      <div className="absolute inset-0 isolate">
        <div ref={container} className="h-full w-full bg-canvas" />
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={t('map.close')}
          className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] right-3 z-20 rounded-full bg-surface p-2.5 shadow-lg active:opacity-60"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      )}
      {/* Layers (like Google Maps): vehicles, stops, lines by type */}
      {showAll && (
        <button
          type="button"
          onClick={() => setLayersOpen((v) => !v)}
          aria-label={t('layers.title')}
          aria-expanded={layersOpen}
          className={`absolute right-3 z-20 rounded-full bg-surface p-2.5 shadow-lg active:opacity-60 ${
            onClose ? 'top-[calc(env(safe-area-inset-top)+4rem)]' : 'top-3'
          } ${layersOpen ? 'text-accent' : ''}`}
        >
          <LayersThree className="h-5 w-5" />
        </button>
      )}
      {layersOpen && showAll && <LayersMenu onClose={() => setLayersOpen(false)} top={onClose ? 'calc(env(safe-area-inset-top) + 7.25rem)' : '3.75rem'} />}
      {trip && !compact && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-pressed={showAll}
          className={`absolute top-[calc(env(safe-area-inset-top)+0.75rem)] left-3 z-20 rounded-full px-4 py-2.5 text-[15px] font-semibold shadow-lg active:opacity-70 ${
            showAll ? 'bg-accent text-white' : 'bg-surface'
          }`}
        >
          {showAll ? t('map.onlyThisTrip') : t('map.showEverything')}
        </button>
      )}
      {!compact && selectedVehicle && <VehicleCard v={selectedVehicle} onClose={() => setSelected(null)} />}
      {!compact && selectedStopInfo && !selectedVehicle && (
        // Same bottom card as for a vehicle: name, which way, its lines, and a way in
        <CardLayout
          onClose={() => setSelectedStop(null)}
          title={selectedStopInfo.name}
          info={selectedStopInfo.towards.length > 0 ? t('common.towards', { to: selectedStopInfo.towards.join(' / ') }) : null}
          status={
            selectedStopInfo.time ? (
              <span className="flex items-center gap-1 font-semibold tabular-nums" style={{ color: statusCss[selectedStopInfo.time.status] === 'inherit' ? undefined : statusCss[selectedStopInfo.time.status] }}>
                {formatTime(selectedStopInfo.time.time)}
                {selectedStopInfo.time.status !== 'scheduled' && <span dangerouslySetInnerHTML={{ __html: LIVE_ICON_HTML }} />}
              </span>
            ) : (
            <FitBadges routes={selectedStopInfo.routes} />
            )
          }
          action={{ to: selectedStopInfo.to, label: t('card.departures') }}
        />
      )}
      {!compact && <button
        type="button"
        onClick={location.request}
        aria-label={t('map.showMyLocation')}
        className={`absolute right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-accent shadow-lg active:opacity-70 ${
          'bottom-[calc(env(safe-area-inset-bottom)+1.5rem)]'
        }`}
      >
        <LocationIcon filled={!!location.coords} className={`h-5 w-5 ${location.loading ? 'animate-pulse' : ''}`} />
      </button>}
    </div>
  )
}

/** The bottom card over the map: drag it down (or tap its ✕) to close it, like a bottom sheet. */
function SheetCard({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const [dy, setDy] = useState(0)
  const start = useRef<number | null>(null)
  return (
    <div
      className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-20 mx-auto max-w-md touch-pan-x rounded-2xl bg-surface p-gutter shadow-xl"
      style={{ transform: dy ? `translateY(${dy}px)` : undefined, transition: start.current == null ? 'transform 180ms ease-out' : undefined, opacity: dy ? Math.max(0.3, 1 - dy / 200) : undefined }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('a,button')) return
        start.current = e.clientY
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (start.current != null) setDy(Math.max(0, e.clientY - start.current))
      }}
      onPointerUp={() => {
        const far = dy > 70
        start.current = null
        if (far) onClose()
        else setDy(0)
      }}
      onPointerCancel={() => {
        start.current = null
        setDy(0)
      }}
    >
      {children}
    </div>
  )
}

/** Details of the tapped vehicle, as an app card over the map (tap the vehicle again, or the card, to open its trip). */
/** Delay at the last stop with realtime data the vehicle has reached (the same rule as the trip page). */
function reachedDelay(stops: TripStop[], now: number): number | null {
  let delay: number | null = null
  for (const s of stops) {
    const at = Date.parse(s.departure) || Date.parse(s.arrival)
    if (!Number.isFinite(at) || at > now) break
    if (s.realtime) delay = s.departureDelay ?? s.arrivalDelay
  }
  return delay
}

function VehicleCard({ v, onClose }: { v: VehiclePosition; onClose: () => void }) {
  const t = useT()
  const age = v.timestamp ? Math.max(0, Math.round((Date.now() - new Date(v.timestamp).getTime()) / 1000)) : null
  const name = vehicleName(v.vehicleModel)
  // The vehicle's trip, for its delay (refreshed with the vehicle)
  const tripId = v.trip?.tripId ?? null
  const d = v.tripStartDate
  const serviceDate = d && /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : undefined
  const trip = useQuery({
    queryKey: tripKey(tripId ?? '', serviceDate),
    queryFn: () => gql<TripDetails>(TRIP_QUERY, { id: tripId, serviceDate }),
    enabled: !!tripId,
    staleTime: 10_000,
    refetchInterval: 10_000,
  })
  const delay = trip.data?.trip ? reachedDelay(trip.data.trip.stops, Date.now()) : null
  const delayMinutes = delay != null ? Math.round(Math.abs(delay) / 60) : null
  const linked = v.trip ? tripUrl(v) : null
  return (
    <CardLayout
      onClose={onClose}
      badge={v.trip?.route ? <RouteBadge route={v.trip.route} /> : null}
      // No destination: the vehicle's type is the title, and its number the line below
      title={v.trip?.headsign ?? name ?? t('map.unknownDestination')}
      info={(v.trip?.headsign ? [name, formatPlate(v.vehicleLicensePlate)] : [formatPlate(v.vehicleLicensePlate)]).filter(Boolean).join(' · ') || null}
      status={
        <>
          {delayMinutes != null ? (
            delayMinutes === 0 ? (
              <span className="font-semibold text-live">{t('trip.onTime')}</span>
            ) : delay! > 0 ? (
              <span className="font-semibold text-late">{t('trip.late', { n: delayMinutes })}</span>
            ) : (
              <span className="font-semibold text-early">{t('trip.early', { n: delayMinutes })}</span>
            )
          ) : (
            <span />
          )}
          {/* Stopwatch and how long ago the position was refreshed, on the right */}
          {age != null ? <RefreshedAge seconds={age} /> : <span className="ml-auto text-secondary">{t('trip.positionUnknown')}</span>}
        </>
      }
      action={linked ? { to: linked, label: t('card.openTrip') } : null}
    />
  )
}

/** Trip page link for a vehicle; tripStartDate comes as YYYYMMDD. */
function tripUrl(v: { trip: { tripId: string } | null; tripStartDate: string | null }) {
  const d = v.tripStartDate
  const date = d && /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : ''
  return `/trips/${encodeURIComponent(v.trip!.tripId)}${date ? `?date=${date}` : ''}`
}
