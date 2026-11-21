import { useQuery } from '@tanstack/react-query'
import type { LngLatBounds } from 'maplibre-gl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { CloseIcon, LocationIcon } from '../components/Icons'
import NavBar from '../components/NavBar'
import RouteBadge from '../components/RouteBadge'
import { gql, MAP_GROUPS_QUERY, MAP_STOPS_QUERY, VEHICLES_QUERY, type NearbyStations, type RouteRef, type Station, type VehiclePosition, type Vehicles } from '../lib/api'
import { CATEGORIES, categoryOf, type Category } from '../lib/categories'
import { distance, hex, roundedHull } from '../lib/geo'
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

/** Stop groups appear from this zoom; individual stops + group outline from STOPS_ZOOM. */
const GROUPS_ZOOM = 14
const BADGES_ZOOM = 15
const STOPS_ZOOM = 16

/** The most prominent vehicle type at a stop decides its colour and pictogram. */
function mainCategory(routes: RouteRef[]): Category {
  const keys = new Set(routes.map((r) => categoryOf(r).key))
  return CATEGORIES.find((c) => keys.has(c.key)) ?? CATEGORIES[CATEGORIES.length - 1]
}

const esc = (s: string) => s.replace(/[<>&"]/g, '')

/** CSS mask for a pictogram inside an HTML string (inlined data URLs contain quotes). */
const maskCss = (url: string) => {
  const u = url.replace(/"/g, '%22').replace(/'/g, '%27')
  return `-webkit-mask:url('${u}') center/contain no-repeat;mask:url('${u}') center/contain no-repeat`
}

/** Tiny badges row (HTML, for map markers). */
function badgesHtml(routes: RouteRef[], max = 4, justify = 'center') {
  const shown = routes.slice(0, max)
  const more = routes.length - shown.length
  return (
    `<div style="display:flex;gap:2px;justify-content:${justify};white-space:nowrap">` +
    shown
      .map(
        (r) =>
          `<span style="background:${hex(r.color, '#000')};color:${hex(r.textColor, '#fff')};font:700 10px/14px system-ui;padding:0 4px;min-width:14px;text-align:center;border-radius:3px">${esc(r.shortName ?? '')}</span>`,
      )
      .join('') +
    (more > 0 ? `<span style="font:600 10px/14px system-ui;color:#555">+${more}</span>` : '') +
    `</div>`
  )
}

type Icon = Pick<HtmlMarker, 'html' | 'size' | 'anchor'>

/** Stop group: a pictogram dot zoomed out; a card with name and lines closer in or when selected. */
function groupIcon(station: Pick<Station, 'name' | 'routes'>, withBadges: boolean, selected = false, towards?: string[]): Icon {
  const c = mainCategory(station.routes)
  const mask = maskCss(c.icon)
  if (!withBadges)
    return {
      html: `<div style="width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgb(0 0 0/.3);display:flex;align-items:center;justify-content:center"><span style="width:20px;height:20px;background:${c.color};${mask}"></span></div>`,
      size: [22, 22],
      anchor: [11, 11],
    }
  return {
    html:
      `<div style="position:absolute;left:0;top:0;transform:translate(-50%,calc(-100% - 6px));display:inline-flex;flex-direction:column;align-items:flex-start;gap:3px;padding:5px 7px;background:#fff;border-radius:10px;border:${selected ? 3 : 2}px solid ${c.color};box-shadow:0 ${selected ? 4 : 2}px ${selected ? 12 : 6}px rgb(0 0 0/${selected ? '.4' : '.25'});white-space:nowrap">` +
      `<div style="display:flex;align-items:center;gap:5px;font:600 12px/14px system-ui;color:#111">` +
      `<span style="width:16px;height:16px;flex:none;background:${c.color};${mask}"></span>${esc(station.name)}</div>` +
      // A single platform: which way it goes, like the BKK app ("▸ Széll Kálmán tér")
      (towards?.length
        ? `<div style="font:500 11px/13px system-ui;color:#555;max-width:180px;overflow:hidden;text-overflow:ellipsis">▸ ${esc(towards.slice(0, 2).join(' / '))}</div>`
        : '') +
      badgesHtml(station.routes, 4, 'flex-start') +
      `</div>` +
      `<div style="position:absolute;left:-5px;top:-5px;width:10px;height:10px;border-radius:50%;background:${c.color};border:2px solid #fff;box-sizing:border-box"></div>`,
  }
}

/** Single stop: a small ring in its main category colour, with its lines below. */
function stopIcon(routes: RouteRef[]): Icon {
  const c = mainCategory(routes)
  return {
    html:
      `<div style="display:flex;flex-direction:column;align-items:center;gap:3px">` +
      `<div style="width:12px;height:12px;border-radius:50%;background:#fff;border:3px solid ${c.color};box-shadow:0 1px 2px rgb(0 0 0/.3)"></div>` +
      badgesHtml(routes, 3) +
      `</div>`,
    size: [80, 34],
    anchor: [40, 9],
  }
}

/** Vehicle: a round marker in the line's colour with its number; an arrow on the rim shows the heading. */
function vehicleIcon(route: RouteRef | null, bearing: number | null, zoom: number, selected: boolean): Icon {
  const c = route ? categoryOf(route) : CATEGORIES[CATEGORIES.length - 1]
  const bg = hex(route?.color, c.color)
  const fg = hex(route?.textColor, '#ffffff')
  if (zoom < GROUPS_ZOOM || !route)
    return {
      html: `<div style="width:14px;height:14px;box-sizing:border-box;border-radius:50%;background:${bg};border:2px solid #fff;box-shadow:0 1px 3px rgb(0 0 0/.35)"></div>`,
      size: [14, 14],
    }
  const label = esc(route.shortName ?? '')
  const size = label.length > 3 ? 34 : 28
  const arrow =
    bearing != null
      ? `<div style="position:absolute;inset:-7px;transform:rotate(${Math.round(bearing)}deg)"><div style="margin:0 auto;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:7px solid ${bg}"></div></div>`
      : ''
  return {
    html:
      `<div style="position:relative;width:${size}px;height:${size}px">${arrow}` +
      `<div style="position:absolute;inset:0;border-radius:50%;background:${bg};color:${fg};border:2px solid ${selected ? '#111' : '#fff'};box-shadow:0 1px 4px rgb(0 0 0/.4);display:flex;align-items:center;justify-content:center;font:700 ${label.length > 3 ? 10 : 12}px system-ui">${label}</div></div>`,
    size: [size, size],
  }
}

type View = { center: { lat: number; lon: number }; bounds: LngLatBounds; zoom: number }
const viewOf = (map: GlMap): View => {
  const c = map.getCenter()
  return { center: { lat: c.lat, lon: c.lng }, bounds: map.getBounds(), zoom: map.getZoom() }
}

export default function MapPage() {
  const t = useT()
  const location = useGeolocation()
  const container = useRef<HTMLDivElement>(null)
  const map = useGlMap(container, { center: DEFAULT_CENTER, zoom: 15 })
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
  const enabled = !!view && zoom >= GROUPS_ZOOM
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
  const vbox = view
    ? {
        minLat: r3(view.bounds.getSouth() - pad),
        minLon: r3(view.bounds.getWest() - pad),
        maxLat: r3(view.bounds.getNorth() + pad),
        maxLon: r3(view.bounds.getEast() + pad),
      }
    : null
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
          !!v && v.latitude != null && v.longitude != null && !!view && view.bounds.contains([v.longitude, v.latitude]),
      ),
    [vehicleQuery.data, view],
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
              sel ? navigate(`/stations/${encodeURIComponent(station.stationId)}?from=${encodeURIComponent(s.stopId)}`) : setSelectedStop(s.stopId),
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
          onClick: () => (sel ? navigate(`/stations/${encodeURIComponent(station.stationId)}`) : setSelectedStop(station.stationId)),
        })
      }
    }
    return { stopMarkers: markers, outlines: features }
  }, [enabled, groups, zoom, selectedStop, navigate])

  const vehicleMarkers = useMemo<HtmlMarker[]>(
    () =>
      vehicles.map((v) => ({
        key: `veh:${v.id}`,
        at: [v.longitude, v.latitude],
        ...vehicleIcon(v.trip?.route ?? null, v.bearing, zoom, selected === v.id),
        z: selected === v.id ? 2000 : 500,
        // First tap: details card. Tap the same vehicle again: open its trip.
        onClick: () => {
          if (selected === v.id && v.trip) navigate(tripUrl(v))
          else setSelected(v.id)
        },
      })),
    [vehicles, zoom, selected, navigate],
  )

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

  useGeoJson(map, 'stop-outlines', { type: 'FeatureCollection', features: outlines }, [
    // Stop groups as a neutral grey footprint
    { id: 'stop-outlines-fill', type: 'fill', paint: { 'fill-color': '#8e8e93', 'fill-opacity': 0.1 } },
    { id: 'stop-outlines-line', type: 'line', layout: { 'line-join': 'round' }, paint: { 'line-color': '#8e8e93', 'line-width': 1.5, 'line-opacity': 0.5 } },
  ])
  const allMarkers = useMemo(() => [...stopMarkers, ...vehicleMarkers, ...me], [stopMarkers, vehicleMarkers, me])
  useMarkers(map, allMarkers)

  // Keep the last known data of the tapped vehicle, so its card stays when it leaves the view
  const [lastSelected, setLastSelected] = useState<VehiclePosition | null>(null)
  const fresh = (vehicleQuery.data?.vehiclePositions ?? []).find((v) => v?.id === selected) ?? null
  useEffect(() => {
    if (fresh) setLastSelected(fresh)
  }, [fresh])
  const selectedVehicle = selected ? (fresh ?? (lastSelected?.id === selected ? lastSelected : null)) : null

  return (
    <div className="flex h-dvh flex-col">
      <NavBar
        menu
        leading={<span className="text-[17px] font-semibold">{t('map.title')}</span>}
        trailing={
          <span className="text-[13px] text-secondary">
            {!vehicleQuery.data ? t('map.loadingVehicles') : t('map.vehiclesInView', { n: vehicles.length })}
          </span>
        }
      />
      <div className="relative flex-1">
        {/* isolate: markers' z-index stays inside the map, so cards and buttons always draw above them */}
        <div className="absolute inset-0 isolate">
          <div ref={container} className="h-full w-full bg-canvas" />
        </div>
        {selectedVehicle && <VehicleCard v={selectedVehicle} onClose={() => setSelected(null)} />}
        <button
          type="button"
          onClick={location.request}
          aria-label={t('map.showMyLocation')}
          className={`absolute right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-accent shadow-lg active:opacity-70 ${
            selectedVehicle ? 'bottom-[calc(env(safe-area-inset-bottom)+8.5rem)]' : 'bottom-[calc(env(safe-area-inset-bottom)+1.5rem)]'
          }`}
        >
          <LocationIcon filled={!!location.coords} className={`h-5 w-5 ${location.loading ? 'animate-pulse' : ''}`} />
        </button>
      </div>
    </div>
  )
}

/** Details of the tapped vehicle, as an app card over the map (tap the vehicle again, or the card, to open its trip). */
function VehicleCard({ v, onClose }: { v: VehiclePosition; onClose: () => void }) {
  const t = useT()
  const age = v.timestamp ? Math.max(0, Math.round((Date.now() - new Date(v.timestamp).getTime()) / 1000)) : null
  const name = vehicleName(v.vehicleModel)
  return (
    <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-20 rounded-2xl bg-surface p-4 pr-12 shadow-xl">
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
