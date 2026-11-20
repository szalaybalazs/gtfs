import { useQuery } from '@tanstack/react-query'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Marker, Polygon, Popup, useMap, useMapEvents } from 'react-leaflet'
import { Link } from 'react-router'
import { LocationIcon } from '../components/Icons'
import NavBar from '../components/NavBar'
import { gql, MAP_GROUPS_QUERY, MAP_STOPS_QUERY, VEHICLES_QUERY, type NearbyStations, type RouteRef, type Station, type Vehicles } from '../lib/api'
import Basemap from '../components/Basemap'
import { CATEGORIES, categoryOf, type Category } from '../lib/categories'
import { distance, hex, hull } from '../lib/geo'
import { useGeolocation } from '../lib/useGeolocation'

const BUDAPEST: [number, number] = [47.4979, 19.0402]
/** Stop groups appear from this zoom; individual stops + group outline from STOPS_ZOOM. */
const GROUPS_ZOOM = 15
const BADGES_ZOOM = 16
const STOPS_ZOOM = 17

/** The most prominent vehicle type at a stop decides its colour and pictogram. */
function mainCategory(routes: RouteRef[]): Category {
  const keys = new Set(routes.map((r) => categoryOf(r).key))
  return CATEGORIES.find((c) => keys.has(c.key)) ?? CATEGORIES[CATEGORIES.length - 1]
}

const esc = (s: string) => s.replace(/[<>&"]/g, '')

/** Tiny badges row (HTML, for map markers). */
function badgesHtml(routes: RouteRef[], max = 4) {
  const shown = routes.slice(0, max)
  const more = routes.length - shown.length
  return (
    `<div style="display:flex;gap:2px;justify-content:center;margin-top:3px;white-space:nowrap">` +
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

/** Stop group marker: white disc with a category-coloured ring and BKK pictogram. */
function groupIcon(station: Station, withBadges: boolean) {
  const c = mainCategory(station.routes)
  const mask = `-webkit-mask:url('${c.icon}') center/contain no-repeat;mask:url('${c.icon}') center/contain no-repeat`
  const html =
    `<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-11px)">` +
    `<div style="width:22px;height:22px;border-radius:50%;background:#fff;border:2.5px solid ${c.color};box-shadow:0 1px 3px rgb(0 0 0/.25);display:flex;align-items:center;justify-content:center">` +
    `<span style="width:16px;height:16px;background:${c.color};${mask}"></span></div>` +
    (withBadges ? badgesHtml(station.routes) : '') +
    `</div>`
  return L.divIcon({ className: '', html, iconSize: [80, 44], iconAnchor: [40, 11] })
}

/** Single stop marker: small ring in its main category colour, with its lines below. */
function stopIcon(routes: RouteRef[]) {
  const c = mainCategory(routes)
  const html =
    `<div style="display:flex;flex-direction:column;align-items:center">` +
    `<div style="width:12px;height:12px;border-radius:50%;background:#fff;border:3px solid ${c.color};box-shadow:0 1px 2px rgb(0 0 0/.3)"></div>` +
    badgesHtml(routes, 3) +
    `</div>`
  return L.divIcon({ className: '', html, iconSize: [80, 34], iconAnchor: [40, 6] })
}

/** Vehicle: coloured dot; zoomed in, a small badge in the line's colours. */
function vehicleIcon(route: RouteRef | null, zoom: number) {
  const c = route ? categoryOf(route) : CATEGORIES[CATEGORIES.length - 1]
  if (zoom < BADGES_ZOOM || !route) {
    return L.divIcon({
      className: '',
      html: `<div style="width:10px;height:10px;border-radius:50%;background:${c.color};border:2px solid #fff;box-shadow:0 1px 3px rgb(0 0 0/.35)"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    })
  }
  return L.divIcon({
    className: '',
    html: `<div style="background:${hex(route.color, c.color)};color:${hex(route.textColor, '#fff')};font:700 11px/18px system-ui;padding:0 5px;min-width:18px;text-align:center;border-radius:5px;border:1.5px solid #fff;box-shadow:0 1px 4px rgb(0 0 0/.35);white-space:nowrap">${esc(route.shortName ?? '')}</div>`,
    iconSize: [40, 20],
    iconAnchor: [20, 10],
  })
}

export default function MapPage() {
  const location = useGeolocation()
  const [count, setCount] = useState<number | null>(null)

  return (
    <div className="flex h-dvh flex-col">
      <NavBar
        menu
        leading={<span className="text-[17px] font-semibold">Map</span>}
        trailing={
          <span className="text-[13px] text-secondary">
            {count == null ? 'Loading vehicles…' : `${count} vehicles in view`}
          </span>
        }
      />
      <div className="relative flex-1">
        <MapContainer center={BUDAPEST} zoom={15} className="absolute inset-0" zoomControl={false}>
          <Basemap />
          <Layers onVehicleCount={setCount} />
          {location.coords && (
            <CircleMarker
              center={[location.coords.lat, location.coords.lon]}
              radius={8}
              pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}
            />
          )}
          <FlyTo coords={location.coords} />
        </MapContainer>
        <button
          type="button"
          onClick={location.request}
          aria-label="Show my location"
          className="absolute right-4 bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] z-[1000] flex h-12 w-12 items-center justify-center rounded-full bg-surface text-accent shadow-lg active:opacity-70"
        >
          <LocationIcon filled={!!location.coords} className={`h-5 w-5 ${location.loading ? 'animate-pulse' : ''}`} />
        </button>
      </div>
    </div>
  )
}

function FlyTo({ coords }: { coords: { lat: number; lon: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (coords) map.flyTo([coords.lat, coords.lon], 16)
  }, [coords, map])
  return null
}

/** Everything that depends on the visible area and zoom. */
function Layers({ onVehicleCount }: { onVehicleCount: (n: number) => void }) {
  const map = useMap()
  const [view, setView] = useState(() => ({ center: map.getCenter(), bounds: map.getBounds(), zoom: map.getZoom() }))
  useMapEvents({ moveend: () => setView({ center: map.getCenter(), bounds: map.getBounds(), zoom: map.getZoom() }) })

  // Stop groups around the centre; radius covers the visible area (capped), rounded so small pans reuse the cache
  const enabled = view.zoom >= GROUPS_ZOOM
  const round = (n: number) => Math.round(n * 500) / 500
  const center = { lat: round(view.center.lat), lon: round(view.center.lng) }
  const ne = view.bounds.getNorthEast()
  const radius = Math.min(1500, Math.ceil(distance(center, { lat: ne.lat, lon: ne.lng }) / 100) * 100)
  const zoomedIn = view.zoom >= STOPS_ZOOM
  const stations = useQuery({
    queryKey: ['mapStations', zoomedIn, center, zoomedIn ? Math.min(radius, 400) : radius],
    queryFn: () =>
      gql<NearbyStations>(zoomedIn ? MAP_STOPS_QUERY : MAP_GROUPS_QUERY, { ...center, radius: zoomedIn ? Math.min(radius, 400) : radius }),
    enabled,
    staleTime: 60 * 60_000,
    placeholderData: (prev) => prev,
  })
  // Vehicles in the visible area only (padded a little), every 30 s (the server's realtime cache)
  const b = view.bounds.pad(0.2)
  const r3 = (n: number) => Math.round(n * 200) / 200
  const vbox = { minLat: r3(b.getSouth()), minLon: r3(b.getWest()), maxLat: r3(b.getNorth()), maxLon: r3(b.getEast()) }
  const vehicleQuery = useQuery({
    queryKey: ['vehicles', vbox],
    queryFn: () => gql<Vehicles>(VEHICLES_QUERY, { bbox: vbox }),
    refetchInterval: 30_000,
    staleTime: 25_000,
    placeholderData: (prev) => prev,
  })
  const vehicles = useMemo(() => vehicleQuery.data?.vehiclePositions ?? [], [vehicleQuery.data])
  useEffect(() => {
    if (vehicleQuery.data) onVehicleCount(vehicles.filter((v) => v && v.latitude != null && view.bounds.contains([v.latitude, v.longitude!])).length)
  }, [vehicleQuery.data, view.bounds, onVehicleCount, vehicles])

  const groups = useMemo(() => (stations.data?.stationsByRadius ?? []).filter((s) => s.routes.length > 0), [stations.data])

  return (
    <>
      {enabled &&
        groups.map((station) => {
          const stops = (station.stops ?? []).filter((s) => s.lat != null && s.lon != null && (s.routes ?? []).some(Boolean))
          if (view.zoom >= STOPS_ZOOM && stops.length > 0) {
            const c = mainCategory(station.routes)
            return (
              <span key={station.stationId}>
                {stops.length > 2 && (
                  <Polygon
                    positions={hull(stops.map((s) => [s.lat!, s.lon!]))}
                    pathOptions={{ color: c.color, weight: 1.5, fillOpacity: 0.08, dashArray: '4 4' }}
                  />
                )}
                {stops.map((s) => (
                  <Marker key={s.stopId} position={[s.lat!, s.lon!]} icon={stopIcon((s.routes ?? []).filter((r) => r != null))}>
                    <Popup>
                      <Link to={`/stations/${encodeURIComponent(station.stationId)}?from=${encodeURIComponent(s.stopId)}`}>
                        {s.name}
                      </Link>
                    </Popup>
                  </Marker>
                ))}
              </span>
            )
          }
          return (
            <Marker key={station.stationId} position={[station.lat, station.lon]} icon={groupIcon(station, view.zoom >= BADGES_ZOOM)}>
              <Popup>
                <Link to={`/stations/${encodeURIComponent(station.stationId)}`}>{station.name}</Link>
              </Popup>
            </Marker>
          )
        })}
      {vehicles.map((v) =>
        v && v.latitude != null && v.longitude != null && view.bounds.contains([v.latitude, v.longitude]) ? (
          <Marker key={v.id} position={[v.latitude, v.longitude]} icon={vehicleIcon(v.trip?.route ?? null, view.zoom)}>
            <Popup>
              <strong>{v.trip?.route?.shortName}</strong> {v.trip?.headsign}
              {v.vehicleLabel && <div>Vehicle {v.vehicleLabel}</div>}
            </Popup>
          </Marker>
        ) : null,
      )}
    </>
  )
}
