import { useQuery } from '@tanstack/react-query'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { Link } from 'react-router'
import { LocationIcon } from '../components/Icons'
import NavBar from '../components/NavBar'
import { gql, STOPS_BBOX_QUERY, VEHICLES_QUERY, type StopsInBox, type Vehicles } from '../lib/api'
import { hex } from '../lib/geo'
import { useGeolocation } from '../lib/useGeolocation'

const BUDAPEST: [number, number] = [47.4979, 19.0402]
/** Below this zoom there are too many stops to draw. */
const STOPS_MIN_ZOOM = 16

export default function MapPage() {
  const location = useGeolocation()
  const vehicles = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => gql<Vehicles>(VEHICLES_QUERY),
    refetchInterval: 15_000,
    staleTime: 0,
  })
  const count = (vehicles.data?.vehiclePositions ?? []).filter(Boolean).length

  return (
    <div className="flex h-dvh flex-col">
      <NavBar
        menu
        leading={<span className="text-[17px] font-semibold">Map</span>}
        trailing={
          <span className="text-[13px] text-secondary">
            {vehicles.isPending ? 'Loading vehicles…' : vehicles.isError ? 'Vehicles unavailable' : `${count} live vehicles`}
          </span>
        }
      />
      <div className="relative flex-1">
        <MapContainer center={BUDAPEST} zoom={14} className="absolute inset-0" zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <StopsLayer />
          {(vehicles.data?.vehiclePositions ?? []).map((v) =>
            v && v.latitude != null && v.longitude != null ? (
              <Marker key={v.id} position={[v.latitude, v.longitude]} icon={vehicleIcon(v.trip?.route ?? null)}>
                <Popup>
                  <strong>{v.trip?.route?.shortName}</strong> {v.trip?.headsign}
                  {v.vehicleLabel && <div>Vehicle {v.vehicleLabel}</div>}
                </Popup>
              </Marker>
            ) : null,
          )}
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

/** Stops inside the visible area, once zoomed in far enough. */
function StopsLayer() {
  const map = useMap()
  const [view, setView] = useState(() => ({ bounds: map.getBounds(), zoom: map.getZoom() }))
  useMapEvents({ moveend: () => setView({ bounds: map.getBounds(), zoom: map.getZoom() }) })

  const enabled = view.zoom >= STOPS_MIN_ZOOM
  const round = (n: number) => Math.round(n * 1000) / 1000 // ~100 m, so small pans reuse the cache
  const bbox = {
    minLat: round(view.bounds.getSouth()),
    minLon: round(view.bounds.getWest()),
    maxLat: round(view.bounds.getNorth()),
    maxLon: round(view.bounds.getEast()),
  }
  const query = useQuery({
    queryKey: ['stopsInBox', bbox],
    queryFn: () => gql<StopsInBox>(STOPS_BBOX_QUERY, { bbox }),
    enabled,
    staleTime: 60 * 60_000,
    placeholderData: (prev) => prev,
  })
  if (!enabled) return null

  return (query.data?.stopsByBbox ?? []).map((stop) =>
    stop && stop.lat != null && stop.lon != null ? (
      <CircleMarker
        key={stop.stopId}
        center={[stop.lat, stop.lon]}
        radius={6}
        pathOptions={{ color: '#111827', weight: 2, fillColor: '#ffffff', fillOpacity: 1 }}
      >
        <Popup>
          <Link to={`/stops/${encodeURIComponent(stop.stopId)}`}>{stop.name ?? stop.stopId}</Link>
        </Popup>
      </CircleMarker>
    ) : null,
  )
}

function vehicleIcon(route: { shortName: string | null; color: string | null; textColor: string | null } | null) {
  const bg = hex(route?.color, '#111827')
  const fg = hex(route?.textColor, '#ffffff')
  const label = (route?.shortName ?? '•').replace(/[<>&"]/g, '')
  return L.divIcon({
    className: '',
    iconSize: [36, 22],
    iconAnchor: [18, 11],
    html: `<div style="background:${bg};color:${fg};font:700 12px/22px system-ui;border-radius:8px;text-align:center;box-shadow:0 1px 4px rgb(0 0 0/.35)">${label}</div>`,
  })
}
