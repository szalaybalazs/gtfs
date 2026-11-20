import { useQuery } from '@tanstack/react-query'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Marker, Polygon, Popup, useMap, useMapEvents } from 'react-leaflet'
import { Link, useNavigate } from 'react-router'
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

/** CSS mask for a pictogram inside an HTML string (inlined data URLs contain quotes). */
const maskCss = (url: string) => {
  const u = url.replace(/"/g, '%22').replace(/'/g, '%27')
  return `-webkit-mask:url('${u}') center/contain no-repeat;mask:url('${u}') center/contain no-repeat`
}

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

/**
 * Stop group marker: a rounded card with the pictogram, the name and its
 * first lines. Big enough to hit with a thumb; tap opens the stop.
 */
function groupIcon(station: Station, withBadges: boolean, selected = false) {
  const c = mainCategory(station.routes)
  const mask = maskCss(c.icon)
  if (!withBadges) {
    // Zoomed out: just the pictogram, so labels don't pile up
    return L.divIcon({
      className: '',
      html: `<div style="width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgb(0 0 0/.3);display:flex;align-items:center;justify-content:center;cursor:pointer"><span style="width:20px;height:20px;background:${c.color};${mask}"></span></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    })
  }
  const html =
    `<div style="transform:translate(-50%,-100%);display:inline-flex;flex-direction:column;align-items:flex-start;gap:3px;padding:5px 7px;background:#fff;border-radius:10px;border:${selected ? 3 : 2}px solid ${c.color};box-shadow:0 ${selected ? 4 : 2}px ${selected ? 12 : 6}px rgb(0 0 0/${selected ? '.4' : '.25'});white-space:nowrap;cursor:pointer">` +
    `<div style="display:flex;align-items:center;gap:5px;font:600 12px/14px system-ui;color:#111">` +
    `<span style="width:16px;height:16px;flex:none;background:${c.color};${mask}"></span>${esc(station.name)}</div>` +
    (withBadges ? badgesHtml(station.routes, 4).replace('justify-content:center;margin-top:3px', 'justify-content:flex-start;margin-top:0') : '') +
    `</div>` +
    `<div style="position:absolute;left:-4px;top:-4px;width:8px;height:8px;border-radius:50%;background:${c.color};border:2px solid #fff"></div>`
  return L.divIcon({ className: '', html, iconSize: [0, 0], iconAnchor: [0, 0] })
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

/**
 * Vehicle: a round marker in the line's colour with its number; a small arrow
 * on the rim shows the heading. Zoomed out, just a coloured dot.
 */
function vehicleIcon(route: RouteRef | null, bearing: number | null, zoom: number, selected: boolean) {
  const c = route ? categoryOf(route) : CATEGORIES[CATEGORIES.length - 1]
  const bg = hex(route?.color, c.color)
  const fg = hex(route?.textColor, '#ffffff')
  if (zoom < GROUPS_ZOOM || !route) {
    return L.divIcon({
      className: '',
      html: `<div style="width:10px;height:10px;border-radius:50%;background:${bg};border:2px solid #fff;box-shadow:0 1px 3px rgb(0 0 0/.35)"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    })
  }
  const label = esc(route.shortName ?? '')
  const size = label.length > 3 ? 34 : 28
  const arrow =
    bearing != null
      ? `<div style="position:absolute;inset:-7px;transform:rotate(${bearing}deg)"><div style="margin:0 auto;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:7px solid ${bg}"></div></div>`
      : ''
  return L.divIcon({
    className: '',
    html:
      `<div style="position:relative;width:${size}px;height:${size}px">${arrow}` +
      `<div style="position:absolute;inset:0;border-radius:50%;background:${bg};color:${fg};border:2px solid ${selected ? '#111' : '#fff'};box-shadow:0 1px 4px rgb(0 0 0/.4);display:flex;align-items:center;justify-content:center;font:700 ${label.length > 3 ? 10 : 12}px system-ui">${label}</div></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
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
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string | null>(null)
  const [selectedStop, setSelectedStop] = useState<string | null>(null)
  // Tapping empty map clears the selected stop
  useMapEvents({ click: () => setSelectedStop(null) })
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
                  <Marker
                    key={s.stopId}
                    position={[s.lat!, s.lon!]}
                    icon={
                      selectedStop === s.stopId
                        ? groupIcon({ ...station, name: s.name ?? station.name, routes: (s.routes ?? []).filter((r) => r != null) }, true, true)
                        : stopIcon((s.routes ?? []).filter((r) => r != null))
                    }
                    zIndexOffset={selectedStop === s.stopId ? 1000 : 0}
                    eventHandlers={{
                      click: () =>
                        selectedStop === s.stopId
                          ? navigate(`/stations/${encodeURIComponent(station.stationId)}?from=${encodeURIComponent(s.stopId)}`)
                          : setSelectedStop(s.stopId),
                    }}
                  />
                ))}
              </span>
            )
          }
          return (
            <Marker
              key={station.stationId}
              position={[station.lat, station.lon]}
              // First tap shows the card (or highlights it); tapping the card again opens the stop
              icon={groupIcon(station, view.zoom >= BADGES_ZOOM || selectedStop === station.stationId, selectedStop === station.stationId)}
              zIndexOffset={selectedStop === station.stationId ? 1000 : 0}
              eventHandlers={{
                click: () =>
                  selectedStop === station.stationId
                    ? navigate(`/stations/${encodeURIComponent(station.stationId)}`)
                    : setSelectedStop(station.stationId),
              }}
            />
          )
        })}
      {vehicles.map((v) =>
        v && v.latitude != null && v.longitude != null && view.bounds.contains([v.latitude, v.longitude]) ? (
          <Marker
            key={v.id}
            position={[v.latitude, v.longitude]}
            icon={vehicleIcon(v.trip?.route ?? null, v.bearing, view.zoom, selected === v.id)}
            eventHandlers={{
              // First tap: details. Tap the same vehicle again: open its trip.
              click: () => {
                if (selected === v.id && v.trip) navigate(tripUrl(v))
                else setSelected(v.id)
              },
              popupclose: () => setSelected((s) => (s === v.id ? null : s)),
            }}
          >
            <Popup>
              <div style={{ minWidth: 160 }}>
                <strong>
                  {v.trip?.route?.shortName} → {v.trip?.headsign ?? '?'}
                </strong>
                {v.vehicleLicensePlate && <div>Plate: {v.vehicleLicensePlate}</div>}
                {v.vehicleLabel && <div>Vehicle: {v.vehicleLabel}</div>}
                {v.vehicleId && <div style={{ opacity: 0.6 }}>ID: {v.vehicleId}</div>}
                {v.trip && (
                  <div style={{ marginTop: 6 }}>
                    <Link to={tripUrl(v)}>Open trip →</Link> <span style={{ opacity: 0.6 }}>(or tap again)</span>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ) : null,
      )}
    </>
  )
}

/** Trip page link for a vehicle; tripStartDate comes as YYYYMMDD. */
function tripUrl(v: { trip: { tripId: string } | null; tripStartDate: string | null }) {
  const d = v.tripStartDate
  const date = d && /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : ''
  return `/trips/${encodeURIComponent(v.trip!.tripId)}${date ? `?date=${date}` : ''}`
}
