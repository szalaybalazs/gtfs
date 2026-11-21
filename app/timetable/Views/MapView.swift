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
private struct MapLayers {
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

    @State private var model = MapViewModel()
    @State private var position: MapCameraPosition = .region(MKCoordinateRegion(center: MapView.center, span: MKCoordinateSpan(latitudeDelta: 0.012, longitudeDelta: 0.012)))
    @State private var region = MKCoordinateRegion(center: MapView.center, span: MKCoordinateSpan(latitudeDelta: 0.012, longitudeDelta: 0.012))
    @State private var layers = MapLayers()
    @State private var selection: MapSelection?
    @Namespace private var mapScope
    /// Stops inside the visible area (plus a margin), capped; computed off the main thread when the view settles.
    @State private var visibleStops: [StopMarker] = []
    /// Lines in view, thinned to the zoom: drawing every point of every line exhausts Metal buffers and crashes MapKit.
    @State private var visibleLines: [LineFeature] = []
    private static let maxStops = 150
    /// Groups spread into platforms (and fold back) over 0.3 s: progress 0...1, the platforms that are folding away.
    @State private var morphStart: Foundation.Date?
    @State private var morphT = 1.0
    @State private var ghosts: [StopMarker] = []
    private let morphTick = Timer.publish(every: 1.0 / 30, on: .main, in: .common).autoconnect()
    private static let morphSeconds = 0.3

    private var span: Double { region.span.latitudeDelta }
    /// Group markers from here, single platforms when closer still (web: GROUPS_ZOOM / STOPS_ZOOM).
    private var platformsZoom: Bool { span < 0.004 }
    private var showVehicles: Bool { layers.vehicles && span < 0.25 }

    private var followed: CLLocationCoordinate2D? {
        guard case .vehicle(let id) = selection else { return nil }
        return model.vehicles.first { $0.id == id }?.coordinate
    }

    private var visibleVehicles: [Vehicle] {
        Array(model.vehicles.filter { v in
            guard let r = v.route else { return true }
            return layers.kinds.contains(replacesCategory(r) ?? LineCategory.of(r))
        }.prefix(500))
    }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Map(position: $position, scope: mapScope) {
                linesContent
                userContent
                stopsContent
                vehiclesContent
            }
            .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll, showsTraffic: false))
            .onMapCameraChange(frequency: .onEnd) { region = $0.region }
            .onReceive(morphTick) { date in
                guard let start = morphStart else { return }
                let t = min(1, date.timeIntervalSince(start) / MapView.morphSeconds)
                morphT = t
                if t >= 1 { morphStart = nil; ghosts = [] }
            }
            .onChange(of: platformsZoom) { _, expanding in
                ghosts = expanding ? [] : visibleStops.filter { $0.stopId != nil }
                morphT = 0; morphStart = Foundation.Date()
            }
            .mapControls { MapScaleView() }
            // A highlighted vehicle keeps the map centred on it as it moves
            .onChange(of: followed.map { [$0.latitude, $0.longitude] }) { _, p in
                guard let p else { return }
                let c = CLLocationCoordinate2D(latitude: p[0], longitude: p[1])
                position = .region(MKCoordinateRegion(center: c, span: region.span))
            }

            VStack(spacing: 10) {
                VStack(spacing: 0) {
                    layersMenu
                    Divider().frame(width: 36)
                    MapUserLocationButton(scope: mapScope)
                        .labelStyle(.iconOnly).frame(width: 44, height: 44)
                }
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                MapCompass(scope: mapScope)
            }
            .padding(.trailing, 12).padding(.top, 8)
        }
        .mapScope(mapScope)
        // An overlay, not a safe-area inset: an inset resizes the map, which made it jump when a card opened or closed
        .mapCardSheet(selection: $selection) { card(for: $0) }
        .onChange(of: selection) { _, new in
            if case .vehicle(let id) = new { model.pinnedVehicleId = id } else { model.pinnedVehicleId = nil }
        }
        // The map fills the screen; no title bar
        .toolbar(.hidden, for: .navigationBar)
        .transitDestinations()
        .task(id: layers.lines) { if layers.lines { await model.loadLines() } }
        // Vehicles: right away when the view settles (after a pan or zoom), then every 10 s while the layer is on
        .task(id: "\(Int(region.center.latitude * 1000))|\(Int(region.center.longitude * 1000))|\(Int(span * 100 * 10))|\(showVehicles)") {
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
        .task(id: "\(Int(region.center.latitude * 2000))|\(Int(region.center.longitude * 2000))|\(span < 0.004)") {
            if span < 0.06 { await model.loadStations(region) }
        }
        // Debounced: the visible subset is worked out off the main thread once the view has settled
        .task(id: "\(region.center.latitude)|\(region.center.longitude)|\(span)|\(model.lines.count)|\(layers.lines)") {
            try? await Task.sleep(nanoseconds: 150_000_000)
            guard !Task.isCancelled else { return }
            guard layers.lines, span < 0.25 else { visibleLines = []; return }
            let lines = model.lines, region = region
            let out = await Task.detached { MapView.thinned(lines, region: region) }.value
            if !Task.isCancelled { visibleLines = out }
        }
        .task(id: "\(region.center.latitude)|\(region.center.longitude)|\(span)|\(model.stations.count)") {
            try? await Task.sleep(nanoseconds: 30_000_000)
            guard !Task.isCancelled else { return }
            guard span < 0.06 else { visibleStops = []; return }
            let stations = model.stations, region = region, platforms = platformsZoom
            let markers = await Task.detached { MapView.stopMarkers(stations, region: region, platforms: platforms) }.value
            if !Task.isCancelled { visibleStops = markers }
        }
    }

    // MARK: Map content

    /// Every line in its own colour, under everything else; thinner when zoomed out, metro a bit bolder.
    @MapContentBuilder private var linesContent: some MapContent {
        if layers.lines && span < 0.25 {
            let base: Double = span > 0.1 ? 1.2 : span > 0.03 ? 2 : 3
            ForEach(visibleLines.filter { layers.kinds.contains($0.category) }) { l in
                MapPolyline(coordinates: l.coordinates)
                    .stroke(Color(hex: l.colorHex).opacity(0.85), lineWidth: l.category == .metro ? base + 1 : base)
            }
        }
    }

    @MapContentBuilder private var userContent: some MapContent {
        UserAnnotation()
    }

    /// Only hides or shows the precomputed markers, so toggling the layer costs nothing.
    @MapContentBuilder private var stopsContent: some MapContent {
        if layers.stops {
            let e = 1 - pow(1 - morphT, 3) // ease out
            ForEach(visibleStops) { m in
                // Platforms spread out of their group's spot; groups fade in as the platforms fold back
                let from: (Double, Double)? = m.stopId != nil && morphStart != nil ? m.homeLat.flatMap { la in m.homeLon.map { (la, $0) } } : nil
                let at = from.map { CLLocationCoordinate2D(latitude: $0.0 + (m.latitude - $0.0) * e, longitude: $0.1 + (m.longitude - $0.1) * e) } ?? m.coordinate
                Annotation("", coordinate: at, anchor: .center) {
                    marker(m).opacity(morphStart != nil ? max(e, 0.01) : 1)
                        .onTapGesture { selection = .station(m.stationId, stopId: m.stopId) }
                }
            }
            // Platforms folding back into their group
            ForEach(ghosts) { m in
                let h = (m.homeLat ?? m.latitude, m.homeLon ?? m.longitude)
                Annotation("", coordinate: CLLocationCoordinate2D(latitude: m.latitude + (h.0 - m.latitude) * e, longitude: m.longitude + (h.1 - m.longitude) * e), anchor: .center) {
                    marker(m).opacity(max(1 - e, 0.01)).allowsHitTesting(false)
                }
            }
        }
    }

    @MapContentBuilder private var vehiclesContent: some MapContent {
        if showVehicles {
            ForEach(visibleVehicles) { v in
                Annotation("", coordinate: v.coordinate) {
                    VehicleDisc(line: v.route, bearing: v.bearing, selected: selection == .vehicle(v.id), compact: span >= 0.02)
                        .onTapGesture { selection = .vehicle(v.id) }
                }
            }
        }
    }

    // MARK: Markers

    @ViewBuilder private func marker(_ m: StopMarker) -> some View {
        let selected = selection == .station(m.stationId, stopId: m.stopId)
        // Zoomed in (and for every single platform): a small dot with its first few line badges under it; the name is on the card once tapped.
        // Further out: a plain pictogram dot
        if m.stopId != nil || span < 0.012 || selected { stopCard(m, selected: selected) }
        else { groupMarker(m.category, selected: selected) }
    }

    private func stopCard(_ m: StopMarker, selected: Bool) -> some View {
        let tint = m.category.tint
        return Circle().fill(tint).frame(width: selected ? 14 : 10, height: selected ? 14 : 10)
            .overlay(Circle().stroke(Color.white, lineWidth: 2))
            .overlay(alignment: .top) {
                // Up to two rows of four badges, then "+N"
                // Variants (56A, 56É…) are left out when the base line (56) is there too
                let names = Set(m.routes.compactMap(\.shortName))
                let base = m.routes.filter { r in
                    guard let n = r.shortName, let last = n.last, last.isLetter, n.count > 1 else { return true }
                    let head = String(n.dropLast())
                    return !(head.allSatisfy(\.isNumber) && names.contains(head))
                }
                let shown = Array(base.prefix(8))
                VStack(spacing: 2) {
                    let perRow = shown.count > 4 ? (shown.count + 1) / 2 : max(shown.count, 1) // two even rows, or one
                    ForEach(Array(stride(from: 0, to: shown.count, by: perRow)), id: \.self) { start in
                        HStack(spacing: 2) {
                            ForEach(shown[start..<min(start + perRow, shown.count)], id: \.routeId) { r in
                                Text(r.shortName ?? "").font(.system(size: 10, weight: .bold)).lineLimit(1).fixedSize()
                                    .foregroundStyle(Color(hex: r.textColor ?? "#ffffff"))
                                    .padding(.horizontal, 4).frame(minHeight: 14).frame(minWidth: 14)
                                    .background(Color(hex: r.color ?? "#000000"), in: RoundedRectangle(cornerRadius: 3))
                            }
                            // More lines than fit: a grey badge with an ellipsis instead of a count
                            if start + perRow >= shown.count && base.count > 8 {
                                Text("…").font(.system(size: 10, weight: .bold)).fixedSize().foregroundStyle(.white)
                                    .padding(.horizontal, 4).frame(minHeight: 14).frame(minWidth: 14)
                                    .background(Color.gray, in: RoundedRectangle(cornerRadius: 3))
                            }
                        }
                    }
                }
                .fixedSize()
                .offset(y: 14)
            }
            .padding(10)
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

    private func stopDot(selected: Bool) -> some View {
        Circle().fill(Theme.surface).frame(width: selected ? 16 : 11, height: selected ? 16 : 11)
            .overlay(Circle().stroke(selected ? Color.primary : Theme.secondary, lineWidth: 2)).padding(8)
    }

    /// Zoomed out: a coloured circle in the category's colour with its pictogram in white (no outer ring).
    private func groupMarker(_ c: LineCategory, selected: Bool) -> some View {
        let d: CGFloat = selected ? 26 : 22
        return Circle().fill(c.tint).frame(width: d, height: d)
            .overlay(Circle().stroke(Color.white, lineWidth: 2))
            .overlay(ModeIcon(category: c, size: d * 0.55, flat: .white))
            .padding(4)
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
    private func card(for selection: MapSelection) -> some View {
        switch selection {
        case .vehicle(let id):
            if let v = model.vehicles.first(where: { $0.id == id }) { VehicleCard(vehicle: v) { self.selection = nil } }
        case .station(let id, let stopId):
            if let s = model.stations.first(where: { $0.stationId == id }) { StopCard(stationId: id, stopId: stopId, station: s) { self.selection = nil } }
        }
    }
}
