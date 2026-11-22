//
//  MapView.swift
//  timetable
//
//  The transit map (web/src/pages/MapPage.tsx, TransitMap.tsx) on MapKit: stop groups / platforms,
//  live vehicles as route-coloured badges, a layers menu, bottom cards for a vehicle or a stop.
//

import SwiftUI
import MapKit


/// Layers, like the web's layers card: vehicles, stops, and which kinds of line to show.
private struct MapLayers: Equatable {
    var vehicles = true
    var lines = false
    var stops = true
    var kinds = Set(LineCategory.allCases)
}

/// One stop marker on screen: a group (zoomed out) or a single platform (zoomed in).
private struct StopMarker: Identifiable, Hashable, Sendable {
    let id: String
    let stationId: String
    let stopId: String?
    let latitude: Double
    let longitude: Double
    let category: LineCategory
    var name = ""
    var routes: [LineRef] = []
    var towards: [String] = []
    /// The group's own spot, which a platform spreads out from (and folds back into).
    var homeLat: Double?
    var homeLon: Double?
    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: latitude, longitude: longitude) }
}

struct MapView: View {
    private static let center = CLLocationCoordinate2D(latitude: 47.5073, longitude: 19.0236) // Széll Kálmán tér

    /// Opens a trip or stop from a card in the tab's stack (full-screen), not inside the sheet.
    var openPage: CardOpen = nil
    @State private var model = MapViewModel()
    @State private var handle = MapHandle()
    @State private var region = MKCoordinateRegion(center: MapView.center, span: MKCoordinateSpan(latitudeDelta: 0.012, longitudeDelta: 0.012))
    @State private var layers = MapLayers()
    @State private var selection: MapSelection?
    /// Stops inside the visible area (plus a margin), capped, for both modes; computed off the main thread when the view settles.
    @State private var groupStops: [StopMarker] = []
    @State private var platformStops: [StopMarker] = []
    /// Platforms or groups, switched the instant the zoom crosses the threshold (during the gesture).
    @State private var platformMode = false
    /// Lines in view, thinned to the zoom: drawing every point of every line exhausts Metal buffers and crashes MapKit.
    @State private var visibleLines: [LineFeature] = []
    /// What the map is given, derived when its sources change (not in body, which runs on every selection).
    @State private var lineItems: [MapLine] = []
    @State private var vehicleItems: [MapVehicle] = []
    private static let maxStops = 150
    private var span: Double { region.span.latitudeDelta }
    /// Group markers from here, single platforms when closer still (web: GROUPS_ZOOM / STOPS_ZOOM).
    private static let platformSpan = 0.004
    private var showVehicles: Bool { layers.vehicles && span < 0.25 }
    /// Re-work out the visible lines when the view, the line data or the layer changes.
    private var linesKey: String {
        "\(region.center.latitude)|\(region.center.longitude)|\(span)|\(model.lines.count)|\(layers.lines)"
    }
    /// Re-fetch vehicles when the view moves (coarsely) or the layer toggles.
    private var vehiclesKey: String {
        let lat = Int(region.center.latitude * 1000), lon = Int(region.center.longitude * 1000)
        let zoom = Int(span * 100 * 10)
        return "\(lat)|\(lon)|\(zoom)|\(showVehicles)"
    }
    /// Re-fetch stations when the view moves to a new area or crosses the platform zoom.
    private var stationsKey: String {
        let lat = Int(region.center.latitude * 2000), lon = Int(region.center.longitude * 2000)
        return "\(lat)|\(lon)|\(span < MapView.platformSpan)"
    }

    private var vehicleShape: String { "\(showVehicles)|\(span >= 0.02)" }
    private var stopsKey: String { "\(region.center.latitude)|\(region.center.longitude)|\(span)|\(model.stations.count)" }

    private var visibleVehicles: [Vehicle] {
        Array(model.vehicles.filter { v in
            guard let r = v.route else { return true }
            return layers.kinds.contains(replacesCategory(r) ?? LineCategory.of(r))
        }.prefix(500))
    }

    var body: some View {
        withLoaders(withDerivedData(core))
    }

    private var core: some View {
        ZStack(alignment: .topTrailing) {
            AppMapView(initialRegion: region, lines: lineItems, stops: mapStops, vehicles: vehicleItems,
                       selectedVehicleId: { if case .vehicle(let id) = selection { id } else { nil } }(),
                       showsUserLocation: true, showsScale: true, handle: handle,
                       onRegionChange: { region = $0 },
                       platformSpan: Self.platformSpan, onPlatformZoom: { platformMode = $0 },
                       onTapStop: { selection = $0.selection },
                       onTapVehicle: { selection = $0.selection })
                // Only under the top: extending the map under the tab bar hid the tab bar's background
                .ignoresSafeArea(edges: .top)

            VStack(spacing: 10) {
                VStack(spacing: 0) {
                    layersMenu
                    Divider().frame(width: 36)
                    MapLocationButton(handle: handle).frame(width: 44, height: 44)
                }
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                MapCompassButton(handle: handle).frame(width: 44, height: 44)
            }
            .padding(.trailing, 12).padding(.top, 8)
        }
        // An overlay, not a safe-area inset: an inset resizes the map, which made it jump when a card opened or closed
        .mapCardSheet(selection: $selection, open: openPage) { card(for: $0, open: $1) }
        .onChange(of: selection) { _, new in
            if case .vehicle(let id) = new { model.pinnedVehicleId = id } else { model.pinnedVehicleId = nil }
        }
        // The map fills the screen; no title bar
        .toolbar(.hidden, for: .navigationBar)
        .transitDestinations()
    }

    /// The map's inputs are rebuilt whenever their sources change, never in body (which runs on every selection).
    private func withDerivedData<V: View>(_ v: V) -> some View {
        v.onChange(of: model.vehicles) { _, _ in rebuildVehicles() }
            .onChange(of: vehicleShape) { _, _ in rebuildVehicles() }
            .onChange(of: layers.kinds) { _, _ in rebuildVehicles(); rebuildLines() }
            .onChange(of: layers.lines) { _, _ in rebuildLines() }
            .onAppear { rebuildVehicles() }
    }

    private func withLoaders<V: View>(_ v: V) -> some View {
        v
        .task(id: layers.lines) { if layers.lines { await model.loadLines() } }
        // Vehicles: right away when the view settles (after a pan or zoom), then every 10 s while the layer is on
        .task(id: vehiclesKey) {
            guard showVehicles else { return }
            try? await Task.sleep(nanoseconds: 200_000_000)
            guard !Task.isCancelled else { return }
            await model.loadVehicles(region)
        }
        .task(id: showVehicles) {
            guard showVehicles else { return }
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(MapViewModel.refreshSeconds * 1_000_000_000))
                guard !Task.isCancelled else { return }
                await model.loadVehicles(region)
            }
        }
        // Stops are fetched whenever the view is close enough (whatever the layer switch says), so switching it on is instant
        .task(id: stationsKey) {
            if span < 0.06 { await model.loadStations(region) }
        }
        // Debounced: the visible subset is worked out off the main thread once the view has settled
        .task(id: linesKey) {
            try? await Task.sleep(nanoseconds: 150_000_000)
            guard !Task.isCancelled else { return }
            guard layers.lines, span < 0.25 else { visibleLines = []; rebuildLines(); return }
            let lines = model.lines, region = region
            let out = await Task.detached { MapView.thinned(lines, region: region) }.value
            if !Task.isCancelled { visibleLines = out; rebuildLines() }
        }
        .task(id: stopsKey) {
            guard span < 0.06 else { groupStops = []; platformStops = []; return }
            let stations = model.stations, region = region
            async let groups = Task.detached { MapView.stopMarkers(stations, region: region, platforms: false) }.value
            async let platforms = Task.detached { MapView.stopMarkers(stations, region: region, platforms: true) }.value
            let (g, p) = await (groups, platforms)
            if !Task.isCancelled { groupStops = g; platformStops = p }
        }
    }

    // MARK: Map data (plain values for AppMapView)

    /// Every line in its own colour, under everything else; thinner when zoomed out, metro a bit bolder.
    /// Rebuilt only when lines, layers or the zoom change, never for a selection.
    private func rebuildLines() {
        guard layers.lines && span < 0.25 else { lineItems = []; return }
        let base: Double = span > 0.1 ? 1.2 : span > 0.03 ? 2 : 3
        lineItems = visibleLines.filter { layers.kinds.contains($0.category) }.map {
            MapLine(id: "\($0.id)", coordinates: $0.coordinates, color: Color(hex: $0.colorHex).opacity(0.85), width: $0.category == .metro ? base + 1 : base)
        }
    }

    private func rebuildVehicles() {
        guard showVehicles else { vehicleItems = []; return }
        let compact = span >= 0.02
        vehicleItems = visibleVehicles.map { MapVehicle(id: $0.id, coordinate: $0.coordinate, bearing: $0.bearing, line: $0.route, compact: compact) }
    }

    private var mapStops: [MapStop] {
        guard layers.stops else { return [] }
        return (platformMode ? platformStops : groupStops).map { m in
            let sel = selection == .station(m.stationId, stopId: m.stopId)
            // Zoomed in (and for every single platform): the first few line badges under the dot; further out, a plain dot
            let badges = m.stopId != nil || span < 0.012 || sel
            return MapStop(id: m.id, coordinate: m.coordinate, selection: .station(m.stationId, stopId: m.stopId),
                           tint: stopPinTint(routes: m.routes, fallback: m.category.tint), dot: 10,
                           routes: badges ? m.routes : [], selected: sel)
        }
    }

    /// Lines touching the view (with a margin), points closer together than the screen can show dropped.
    private nonisolated static func thinned(_ lines: [LineFeature], region: MKCoordinateRegion) -> [LineFeature] {
        let latHalf = region.span.latitudeDelta * 0.75, lonHalf = region.span.longitudeDelta * 0.75
        let c = region.center
        let minStep = region.span.latitudeDelta / 300
        var out: [LineFeature] = []
        var points = 0
        for l in lines {
            guard let first = l.coordinates.first else { continue }
            // Whole line outside the view: skip without walking its points
            if l.maxLat < c.latitude - latHalf || l.minLat > c.latitude + latHalf || l.maxLon < c.longitude - lonHalf || l.minLon > c.longitude + lonHalf { continue }
            var kept = [first], last = first, touches = false
            for p in l.coordinates.dropFirst() {
                if abs(p.latitude - c.latitude) <= latHalf && abs(p.longitude - c.longitude) <= lonHalf { touches = true }
                if abs(p.latitude - last.latitude) + abs(p.longitude - last.longitude) >= minStep { kept.append(p); last = p }
            }
            if let end = l.coordinates.last, kept.count > 1 || touches { if kept.last.map({ $0.latitude != end.latitude || $0.longitude != end.longitude }) ?? true { kept.append(end) } }
            guard touches, kept.count > 1 else { continue }
            points += kept.count
            if points > 60_000 { break }
            out.append(LineFeature(id: l.id, routeId: l.routeId, category: l.category, colorHex: l.colorHex, coordinates: kept))
        }
        return out
    }

    /// The stops to draw for this view: inside the region with a margin, nearest the centre first, capped.
    private nonisolated static func stopMarkers(_ stations: [Station], region: MKCoordinateRegion, platforms: Bool) -> [StopMarker] {
        let margin = 1.2
        let latHalf = region.span.latitudeDelta / 2 * margin, lonHalf = region.span.longitudeDelta / 2 * margin
        let c = region.center
        func inside(_ lat: Double, _ lon: Double) -> Bool { abs(lat - c.latitude) <= latHalf && abs(lon - c.longitude) <= lonHalf }
        var out: [(StopMarker, Double)] = []
        for s in stations {
            if platforms {
                for p in s.sortedPlatforms {
                    guard let lat = p.lat, let lon = p.lon, inside(lat, lon) else { continue }
                    out.append((StopMarker(id: p.stopId, stationId: s.stationId, stopId: p.stopId, latitude: lat, longitude: lon, category: .other, name: p.name ?? s.name, routes: p.routes.sorted(by: lineOrder), towards: p.headsigns, homeLat: s.lat, homeLon: s.lon),
                                (lat - c.latitude) * (lat - c.latitude) + (lon - c.longitude) * (lon - c.longitude)))
                }
            } else if inside(s.lat, s.lon) {
                let cat = LineCategory.allCases.first { k in s.routes.contains { LineCategory.of($0) == k } } ?? .other
                out.append((StopMarker(id: s.stationId, stationId: s.stationId, stopId: nil, latitude: s.lat, longitude: s.lon, category: cat, name: s.name, routes: s.routes.sorted(by: lineOrder)),
                            (s.lat - c.latitude) * (s.lat - c.latitude) + (s.lon - c.longitude) * (s.lon - c.longitude)))
            }
        }
        return out.sorted { $0.1 < $1.1 }.prefix(maxStops).map(\.0)
    }

    // MARK: Controls

    private var layersMenu: some View {
        Menu {
            Toggle("Vehicles", isOn: $layers.vehicles)
            Toggle("Stops", isOn: $layers.stops)
            Toggle("Routes", isOn: $layers.lines)
            Divider()
            Section("Lines") {
                ForEach(LineCategory.allCases, id: \.self) { c in
                    Toggle(c.title, isOn: Binding(get: { layers.kinds.contains(c) },
                                                  set: { if $0 { layers.kinds.insert(c) } else { layers.kinds.remove(c) } }))
                }
            }
        } label: {
            Image(systemName: "square.3.layers.3d").font(.system(size: 17)).foregroundStyle(Theme.accent)
                .frame(width: 44, height: 44)
        }
        .menuActionDismissBehavior(.disabled)
        .accessibilityLabel("Map layers")
    }

    // MARK: Bottom cards

    @ViewBuilder
    private func card(for selection: MapSelection, open: CardOpen) -> some View {
        switch selection {
        case .vehicle(let id):
            if let v = model.vehicles.first(where: { $0.id == id }) { VehicleCard(vehicle: v, open: open) { self.selection = nil } }
        case .station(let id, let stopId):
            if let s = model.stations.first(where: { $0.stationId == id }) { StopCard(stationId: id, stopId: stopId, station: s, open: open) { self.selection = nil } }
        }
    }
}
