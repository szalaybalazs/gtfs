//
//  MapViewModel.swift
//  timetable
//
//  Live vehicles (smoothly moving between updates) and stop groups around the visible area.
//

import Foundation
import CoreLocation
import MapKit
import Observation
import TimetableAPI

/// One line + direction of the Lines layer.
struct LineFeature: Identifiable {
    let id: Int
    let routeId: String
    let category: LineCategory
    let colorHex: String
    let coordinates: [CLLocationCoordinate2D]
    /// Bounding box, so a view can skip lines far away without walking their points.
    let minLat: Double, maxLat: Double, minLon: Double, maxLon: Double

    init(id: Int, routeId: String, category: LineCategory, colorHex: String, coordinates: [CLLocationCoordinate2D]) {
        self.id = id; self.routeId = routeId; self.category = category; self.colorHex = colorHex; self.coordinates = coordinates
        minLat = coordinates.map(\.latitude).min() ?? 0; maxLat = coordinates.map(\.latitude).max() ?? 0
        minLon = coordinates.map(\.longitude).min() ?? 0; maxLon = coordinates.map(\.longitude).max() ?? 0
    }
}

struct Vehicle: Identifiable, Hashable {
    let id: String
    var coordinate: CLLocationCoordinate2D
    let bearing: Double?
    let label: String?
    let plate: String?
    let model: String?
    let tripId: String?
    let serviceDate: String?
    let headsign: String?
    let route: LineRef?

    static func == (a: Vehicle, b: Vehicle) -> Bool { a.id == b.id && a.coordinate.latitude == b.coordinate.latitude && a.coordinate.longitude == b.coordinate.longitude }
    func hash(into h: inout Hasher) { h.combine(id) }
}

/// Where a vehicle was and where it is going, so it glides between two reports.
struct VehicleTrack {
    var from: CLLocationCoordinate2D
    var to: CLLocationCoordinate2D
    var start: Foundation.Date
    var duration: TimeInterval

    func position(at now: Foundation.Date) -> CLLocationCoordinate2D {
        let t = min(1, max(0, now.timeIntervalSince(start) / duration))
        return CLLocationCoordinate2D(latitude: from.latitude + (to.latitude - from.latitude) * t,
                                      longitude: from.longitude + (to.longitude - from.longitude) * t)
    }
}

@MainActor
@Observable
final class MapViewModel {
    private(set) var vehicles: [Vehicle] = []
    private(set) var tracks: [String: VehicleTrack] = [:]
    private(set) var stations: [Station] = []
    private(set) var lines: [LineFeature] = []
    private var linesRequested = false

    /// Vehicles are re-fetched this often; they glide to the new spot over the same time.
    static let refreshSeconds: Double = 10

    private let client: GraphQLClient
    init(client: GraphQLClient = Network.shared) { self.client = client }

    func loadVehicles(_ region: MKCoordinateRegion) async {
        // A margin around the view, so a small pan already finds its vehicles
        let m = 1.4
        let bbox = BboxInput(
            minLat: region.center.latitude - region.span.latitudeDelta / 2 * m, minLon: region.center.longitude - region.span.longitudeDelta / 2 * m,
            maxLat: region.center.latitude + region.span.latitudeDelta / 2 * m, maxLon: region.center.longitude + region.span.longitudeDelta / 2 * m)
        guard let data = try? await client.fetch(VehiclesQuery(bbox: .some(bbox))), !Task.isCancelled else { return }
        let now = Foundation.Date()
        var next: [Vehicle] = []
        var newTracks: [String: VehicleTrack] = [:]
        for v in data.vehiclePositions.compactMap({ $0 }) {
            guard let lat = v.latitude, let lon = v.longitude else { continue }
            let to = CLLocationCoordinate2D(latitude: lat, longitude: lon)
            let route = v.trip?.route.map { r in LineRef(routeId: r.routeId, shortName: r.shortName, color: r.color, textColor: r.textColor, type: r.type?.rawValue) }
            next.append(Vehicle(id: v.id, coordinate: to, bearing: v.bearing, label: v.vehicleLabel, plate: v.vehicleLicensePlate, model: v.vehicleModel,
                                tripId: v.trip?.tripId, serviceDate: v.tripStartDate, headsign: v.trip?.headsign, route: route))
            // Glide from wherever it is drawn now
            let from = tracks[v.id]?.position(at: now) ?? to
            newTracks[v.id] = VehicleTrack(from: from, to: to, start: now, duration: Self.refreshSeconds)
        }
        vehicles = next
        tracks = newTracks
    }

    private var stationCache: [String: Station] = [:]
    /// Circles already fetched: (centre, radius in metres).
    private var fetchedAreas: [(CLLocationCoordinate2D, Double)] = []

    /// Stations accumulate: a view inside an area already fetched costs nothing, and panning back is instant.
    func loadStations(_ region: MKCoordinateRegion) async {
        let c = region.center
        let viewMetres = region.span.latitudeDelta * 111_000 / 2 * 1.3
        let covered = fetchedAreas.contains { area in
            let dLat = (area.0.latitude - c.latitude) * 111_000, dLon = (area.0.longitude - c.longitude) * 111_000 * cos(c.latitude * .pi / 180)
            return (dLat * dLat + dLon * dLon).squareRoot() + viewMetres <= area.1
        }
        if covered { return }
        let radius = min(1500, max(800, viewMetres * 2))
        guard let data = try? await client.fetch(NearbyStationsQuery(lat: c.latitude, lon: c.longitude, radius: radius)),
              !Task.isCancelled else { return }
        for s in data.stationsByRadius.map(Station.init) where !s.routes.isEmpty { stationCache[s.stationId] = s }
        fetchedAreas.append((c, radius))
        if fetchedAreas.count > 40 { fetchedAreas.removeFirst() }
        stations = Array(stationCache.values)
    }

    /// Every line's simplified path, fetched once (cached on disk for a day).
    func loadLines() async {
        guard !linesRequested else { return }
        linesRequested = true
        let file = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("route-lines.geojson")
        var json: String?
        if let attrs = try? FileManager.default.attributesOfItem(atPath: file.path), let modified = attrs[.modificationDate] as? Foundation.Date,
           Foundation.Date().timeIntervalSince(modified) < 24 * 3600 {
            json = try? String(contentsOf: file, encoding: .utf8)
        }
        if json == nil {
            let types: [GraphQLEnum<RouteType>] = [.case(.subway), .case(.tram), .case(.trolleybus), .case(.bus), .case(.ferry)]
            guard let data = try? await client.fetch(RouteLinesQuery(types: .some(types))), !Task.isCancelled else { linesRequested = false; return }
            json = data.routeLines
            try? json?.write(to: file, atomically: true, encoding: .utf8)
        }
        guard let bytes = json?.data(using: .utf8) else { return }
        // Decoding the whole GeoJSON takes a while: off the main thread
        let out = await Task.detached { Self.parseLines(bytes) }.value
        lines = out
    }

    private nonisolated static func parseLines(_ bytes: Data) -> [LineFeature] {
        guard let objects = try? MKGeoJSONDecoder().decode(bytes) else { return [] }
        var out: [LineFeature] = []
        for case let feature as MKGeoJSONFeature in objects {
            let props = feature.properties.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] } ?? [:]
            let color = (props["color"] as? String) ?? "#6b7280"
            let line = LineRef(routeId: props["routeId"] as? String ?? "", shortName: nil, color: color, textColor: nil, type: props["type"] as? String)
            let category = replacesCategory(line) ?? LineCategory.of(line)
            for shape in feature.geometry {
                let polylines: [MKPolyline] = (shape as? MKPolyline).map { [$0] } ?? (shape as? MKMultiPolyline)?.polylines ?? []
                for pl in polylines {
                    var coords = [CLLocationCoordinate2D](repeating: CLLocationCoordinate2D(), count: pl.pointCount)
                    pl.getCoordinates(&coords, range: NSRange(location: 0, length: pl.pointCount))
                    out.append(LineFeature(id: out.count, routeId: line.routeId, category: category, colorHex: color, coordinates: coords))
                }
            }
        }
        return out
    }
}
