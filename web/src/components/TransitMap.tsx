import { useQuery } from '@tanstack/react-query'
import type { LngLatBounds } from 'maplibre-gl'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { LngLatBoundsLike } from 'maplibre-gl'
import { Link, useNavigate } from 'react-router'
import { LayersThree } from '@mynaui/icons-react'
import { CloseIcon, LocationIcon } from './Icons'
import RouteBadge from './RouteBadge'
import { gql, MAP_GROUPS_QUERY, MAP_STOPS_QUERY, ROUTE_LINES_QUERY, VEHICLES_QUERY, type NearbyStations, type VehiclePosition, type Vehicles } from '../lib/api'
import { distance, roundedHull } from '../lib/geo'
import { BADGES_ZOOM, groupIcon, GROUPS_ZOOM, mainCategory, stopIcon, STOPS_ZOOM, vehicleIcon } from '../lib/mapIcons'
import { formatTime } from '../lib/time'
import { LIVE_ICON_HTML, statusCss, type RealtimeStatus } from '../lib/realtimeStatus'
import { categoryOf } from '../lib/categories'
import { useMapLayers } from '../lib/mapLayers'
import LayersMenu from './LayersMenu'
import { tappedMarker, useGeoJson, useGlMap, useMarkers, type GlMap, type HtmlMarker } from '../lib/glmap'
import { useGeolocation } from '../lib/useGeolocation'
import { vehicleName } from '../lib/vehicle'
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
  onVehicleCount,
}: {
  trip?: TripOverlay
  bounds?: LngLatBoundsLike
  /** Shows a ✕ (top right) that calls this */
  onClose?: () => void
  onVehicleCount?: (n: number | null) => void
}) {
  const t = useT()
  const location = useGeolocation()
  const container = useRef<HTMLDivElement>(null)
  const map = useGlMap(container, bounds ? { bounds, padding: 48 } : { center: DEFAULT_CENTER, zoom: 15 })
  // With a trip: just that trip until "show everything"
  const [showAll, setShowAll] = useState(!trip)
  const [layers] = useMapLayers()
  const [layersOpen, setLayersOpen] = useState(false)
  const [selectedTripStop, setSelectedTripStop] = useState<string | null>(null)
  const navigate = useNavigate()
  const [view, setView] = useState<View | null>(null)
  const [selectedStop, setSelectedStop] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (!map) return
    setView(viewOf(map))
    const onMove = () => setView(viewOf(map))
    // Tapping empty map clears the selection
    // Tapping empty map clears a selected stop; the vehicle card stays until its ✕
    const onClick = () => {
      if (tappedMarker()) return
      setSelectedStop(null)
      setSelectedTripStop(null)
    }
    map.on('moveend', onMove)
    map.on('click', onClick)
    return () => {
      map.off('moveend', onMove)
      map.off('click', onClick)
    }
  }, [map])

  useEffect(() => {
    if (map && location.coords) map.flyTo({ center: [location.coords.lon, location.coords.lat], zoom: 15.5 })
  }, [map, location.coords])

  // Stop groups around the centre; radius covers the visible area (capped), rounded so small pans reuse the cache
  const zoom = view?.zoom ?? 0
  const enabled = !!view && zoom >= GROUPS_ZOOM && showAll && layers.stops
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
  const zoomedIn = zoom >= STOPS_ZOOM
  const radius = Math.min(zoomedIn ? 1200 : 1500, Math.ceil((corner + (zoomedIn ? 400 : 200)) / 100) * 100)
  const stations = useQuery({
    queryKey: ['mapStations', zoomedIn, center, radius],
    queryFn: () => gql<NearbyStations>(zoomedIn ? MAP_STOPS_QUERY : MAP_GROUPS_QUERY, { ...center, radius }),
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
    refetchInterval: 30_000,
    staleTime: 25_000,
    placeholderData: (prev) => prev,
  })
  const vehicles = useMemo(
    () =>
      (vehicleQuery.data?.vehiclePositions ?? []).filter(
        (v): v is VehiclePosition & { latitude: number; longitude: number } =>
          !!v &&
          v.latitude != null &&
          v.longitude != null &&
          !!view &&
          // The trip's own vehicle always; others only with "show everything" + the Vehicles layer.
          // (Guard on trip: without one, undefined === undefined would keep trip-less vehicles.)
          ((!!trip && v.trip?.tripId === trip.tripId) || (showAll && layers.vehicles && view.bounds.contains([v.longitude, v.latitude]))),
      ),
    [vehicleQuery.data, view, showAll, trip?.tripId, layers.vehicles],
  )

  const groups = useMemo(() => (stations.data?.stationsByRadius ?? []).filter((s) => s.routes.length > 0), [stations.data])

  // Stop markers, and the dashed outline of each stop group when zoomed in
  const { stopMarkers, outlines } = useMemo(() => {
    const markers: HtmlMarker[] = []
    const features: GeoJSON.Feature[] = []
    if (!enabled) return { stopMarkers: markers, outlines: features }
    for (const station of groups) {
      const stops = (station.stops ?? []).filter((s) => s.lat != null && s.lon != null && (s.routes ?? []).some(Boolean))
      if (zoom >= STOPS_ZOOM && stops.length > 0) {
        const c = mainCategory(station.routes)
        if (stops.length > 1) {
          const ring = roundedHull(stops.map((s) => [s.lat!, s.lon!]), 25).map(([lat, lon]) => [lon, lat])
          features.push({ type: 'Feature', properties: { color: c.color }, geometry: { type: 'Polygon', coordinates: [ring] } })
        }
        for (const s of stops) {
          const routes = (s.routes ?? []).filter((r) => r != null)
          const sel = selectedStop === s.stopId
          markers.push({
            key: `stop:${s.stopId}`,
            at: [s.lon!, s.lat!],
            ...(sel ? groupIcon({ name: s.name ?? station.name, routes }, true, true, s.headsigns ?? []) : stopIcon(routes)),
            z: sel ? 1000 : 0,
            onClick: () =>
              sel ? navigate(`/stations/${encodeURIComponent(station.stationId)}?from=${encodeURIComponent(s.stopId)}`) : (setSelectedStop(s.stopId), setSelected(null)),
          })
        }
      } else {
        const sel = selectedStop === station.stationId
        markers.push({
          key: `group:${station.stationId}`,
          at: [station.lon, station.lat],
          // First tap shows the card (or highlights it); tapping it again opens the stop
          ...groupIcon(station, zoom >= BADGES_ZOOM || sel, sel),
          z: sel ? 1000 : 0,
          onClick: () => (sel ? navigate(`/stations/${encodeURIComponent(station.stationId)}`) : (setSelectedStop(station.stationId), setSelected(null))),
        })
      }
    }
    return { stopMarkers: markers, outlines: features }
  }, [enabled, groups, zoom, selectedStop, navigate])


  const me = useMemo<HtmlMarker[]>(
    () =>
      location.coords
        ? [
            {
              key: 'me',
              at: [location.coords.lon, location.coords.lat],
              html: '<div style="width:18px;height:18px;box-sizing:border-box;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 1px 4px rgb(0 0 0/.35)"></div>',
              size: [18, 18],
              z: 1500,
            },
          ]
        : [],
    [location.coords],
  )

  const outlineData = useMemo<GeoJSON.FeatureCollection>(() => ({ type: 'FeatureCollection', features: outlines }), [outlines])
  useGeoJson(map, 'stop-outlines', outlineData, [
    // Stop groups as a neutral grey footprint
    { id: 'stop-outlines-fill', type: 'fill', paint: { 'fill-color': '#8e8e93', 'fill-opacity': 0.1 } },
    { id: 'stop-outlines-line', type: 'line', layout: { 'line-join': 'round' }, paint: { 'line-color': '#8e8e93', 'line-width': 1.5, 'line-opacity': 0.5 } },
  ])
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

  // Line paths per route, both directions (from the Lines layer, when loaded), for vehicles to glide along
  const pathsByRoute = useMemo(() => {
    const m = new Map<string, [number, number][][]>()
    for (const f of lines?.features ?? []) {
      const id = f.properties?.routeId as string
      m.set(id, [...(m.get(id) ?? []), (f.geometry as GeoJSON.LineString).coordinates as [number, number][]])
    }
    return m
  }, [lines])
  const vehicleMarkers = useMemo<HtmlMarker[]>(
    () =>
      vehicles.map((v) => ({
        key: `veh:${v.id}`,
        at: [v.longitude, v.latitude],
        ...vehicleIcon(v.trip?.route ?? null, v.bearing, zoom, selected === v.id),
        // Glide to each new position, along the line's path when we have it
        animate: true,
        paths: trip && v.trip?.tripId === trip.tripId && trip.path.length ? [trip.path] : (pathsByRoute.get(v.trip?.route?.routeId ?? '') ?? null),
        z: selected === v.id ? 2000 : 500,
        // First tap: details card. Tap the same vehicle again: open its trip.
        onClick: () => {
          if (selected === v.id && v.trip) navigate(tripUrl(v))
          else {
            setSelected(v.id)
            setSelectedStop(null)
          }
        },
      })),
    [vehicles, zoom, selected, navigate, pathsByRoute, trip],
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
        const sel = selectedTripStop === s.stopId
        const dot = `<div style="position:absolute;left:-6px;top:-6px;width:12px;height:12px;box-sizing:border-box;border-radius:50%;background:#fff;border:3px solid ${s.strong ? '#111' : trip!.color}"></div>`
        // Time label to the right of the dot, like a timetable on the map
        // Coloured like the stop list (late red, early purple, on time green), live mark when it's realtime
        const live = s.status !== 'scheduled'
        const label = `<div style="position:absolute;left:10px;top:-9px;width:max-content;display:flex;align-items:center;gap:2px;font:600 11px/18px system-ui;padding:0 5px;border-radius:5px;background:rgb(255 255 255/.92);color:${statusCss[s.status] === 'inherit' ? '#111' : statusCss[s.status]};box-shadow:0 1px 2px rgb(0 0 0/.2)">${formatTime(s.time)}${live ? LIVE_ICON_HTML : ''}</div>`
        const card = sel
          ? `<div style="position:absolute;left:0;top:-14px;transform:translate(-50%,-100%);padding:6px 9px;background:#fff;border-radius:10px;border:2px solid ${trip!.color};box-shadow:0 4px 12px rgb(0 0 0/.3);white-space:nowrap;font:600 13px/16px system-ui;color:#111">${s.name.replace(/[<>&"]/g, '')}<div style="font:500 11px/14px system-ui;color:#555">${formatTime(s.time)}${trip!.headsign ? ` · ▸ ${trip!.headsign.replace(/[<>&"]/g, '')}` : ''}</div></div>`
          : ''
        return {
          key: `tripstop:${s.stopId}:${s.time.getTime()}`,
          at: [s.lon, s.lat] as [number, number],
          html: `<div style="opacity:${s.passed && !sel ? 0.5 : 1}">${dot}${label}${card}</div>`,
          z: sel ? 3000 : 800,
          // First tap: name, time and direction. Tap again: open the stop at this trip's time.
          onClick: () => {
            if (sel) {
              const at = new Date(s.time.getTime() - 60_000).toISOString()
              navigate(`/stations/${encodeURIComponent(s.stationId ?? s.stopId)}?from=${encodeURIComponent(s.stopId)}&trip=${encodeURIComponent(trip!.tripId)}&at=${encodeURIComponent(at)}`)
            } else setSelectedTripStop(s.stopId)
          },
        }
      }),
    [trip, selectedTripStop, navigate],
  )
  const allMarkers = useMemo(() => [...stopMarkers, ...tripStopMarkers, ...vehicleMarkers, ...me], [stopMarkers, tripStopMarkers, vehicleMarkers, me])
  useEffect(() => {
    onVehicleCount?.(vehicleQuery.data ? vehicles.length : null)
  }, [onVehicleCount, vehicleQuery.data, vehicles.length])
  useMarkers(map, allMarkers)

  // Keep the last known data of the tapped vehicle, so its card stays when it leaves the view
  const [lastSelected, setLastSelected] = useState<VehiclePosition | null>(null)
  const fresh = (vehicleQuery.data?.vehiclePositions ?? []).find((v) => v?.id === selected) ?? null
  useEffect(() => {
    if (fresh) setLastSelected(fresh)
  }, [fresh])
  const selectedVehicle = selected ? (fresh ?? (lastSelected?.id === selected ? lastSelected : null)) : null

  // The tapped stop (a whole group when zoomed out, a single platform when zoomed in), for its bottom card
  const selectedStopInfo = useMemo(() => {
    if (!selectedStop) return null
    for (const st of groups) {
      if (st.stationId === selectedStop)
        return { name: st.name, towards: [] as string[], routes: st.routes.filter(Boolean), to: `/stations/${encodeURIComponent(st.stationId)}` }
      const p = st.stops?.find((x) => x.stopId === selectedStop)
      if (p)
        return {
          name: p.name ?? st.name,
          towards: p.headsigns ?? [],
          routes: (p.routes ?? []).filter((r): r is NonNullable<typeof r> => !!r),
          to: `/stations/${encodeURIComponent(st.stationId)}?from=${encodeURIComponent(p.stopId)}`,
        }
    }
    return null
  }, [selectedStop, groups])

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
      {trip && (
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
      {selectedVehicle && <VehicleCard v={selectedVehicle} onClose={() => setSelected(null)} />}
      {selectedStopInfo && !selectedVehicle && (
        // Same bottom card as for a vehicle: name, which way, its lines, and a way in
        <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-20 rounded-2xl bg-surface p-gutter pr-12 shadow-xl">
          <button type="button" onClick={() => setSelectedStop(null)} aria-label={t('map.close')} className="absolute top-3 right-3 rounded-full bg-fill p-1.5 active:opacity-60">
            <CloseIcon className="h-4 w-4" />
          </button>
          <p className="truncate text-[17px] font-semibold">{selectedStopInfo.name}</p>
          {selectedStopInfo.towards.length > 0 && <p className="truncate text-[15px] text-secondary">{t('common.towards', { to: selectedStopInfo.towards.join(' / ') })}</p>}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {selectedStopInfo.routes.slice(0, 12).map((r) => (
              <RouteBadge key={r.routeId} route={r} />
            ))}
            {selectedStopInfo.routes.length > 12 && <span className="text-[13px] text-secondary">+{selectedStopInfo.routes.length - 12}</span>}
          </div>
          <Link to={selectedStopInfo.to} className="mt-2 inline-block text-[15px] font-medium text-accent active:opacity-60">
            {t('map.openStop')}
          </Link>
        </div>
      )}
      <button
        type="button"
        onClick={location.request}
        aria-label={t('map.showMyLocation')}
        className={`absolute right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-accent shadow-lg active:opacity-70 ${
          selectedVehicle || selectedStopInfo ? 'bottom-[calc(env(safe-area-inset-bottom)+9.5rem)]' : 'bottom-[calc(env(safe-area-inset-bottom)+1.5rem)]'
        }`}
      >
        <LocationIcon filled={!!location.coords} className={`h-5 w-5 ${location.loading ? 'animate-pulse' : ''}`} />
      </button>
    </div>
  )
}

/** Details of the tapped vehicle, as an app card over the map (tap the vehicle again, or the card, to open its trip). */
function VehicleCard({ v, onClose }: { v: VehiclePosition; onClose: () => void }) {
  const t = useT()
  const age = v.timestamp ? Math.max(0, Math.round((Date.now() - new Date(v.timestamp).getTime()) / 1000)) : null
  const name = vehicleName(v.vehicleModel)
  return (
    <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-20 rounded-2xl bg-surface p-gutter pr-12 shadow-xl">
      <button type="button" onClick={onClose} aria-label={t('map.close')} className="absolute top-3 right-3 rounded-full bg-fill p-1.5 active:opacity-60">
        <CloseIcon className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2">
        {v.trip?.route && <RouteBadge route={v.trip.route} />}
        <span className="truncate text-[17px] font-semibold">{v.trip?.headsign ?? t('map.unknownDestination')}</span>
      </div>
      {/* What it is, then its plate and how fresh the position is */}
      {name && <p className="mt-1 text-[15px] font-medium">{name}</p>}
      <p className="text-[13px] text-secondary">
        {[
          v.vehicleLicensePlate,
          age != null ? (age < 60 ? t('trip.positionSecs', { n: age }) : t('trip.positionMins', { n: Math.round(age / 60) })) : t('trip.positionUnknown'),
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {v.trip && (
        <Link to={tripUrl(v)} className="mt-1.5 inline-block text-[15px] font-medium text-accent active:opacity-60">
          {t('map.openTrip')}
        </Link>
      )}
    </div>
  )
}

/** Trip page link for a vehicle; tripStartDate comes as YYYYMMDD. */
function tripUrl(v: { trip: { tripId: string } | null; tripStartDate: string | null }) {
  const d = v.tripStartDate
  const date = d && /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : ''
  return `/trips/${encodeURIComponent(v.trip!.tripId)}${date ? `?date=${date}` : ''}`
}
