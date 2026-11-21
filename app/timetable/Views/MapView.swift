//
//  MapView.swift
//  timetable
//
//  The transit map (web/src/pages/MapPage.tsx, TransitMap.tsx) on MapKit: stop groups / platforms,
//  live vehicles as route-coloured badges, a layers menu, bottom cards for a vehicle or a stop.
//

import SwiftUI
import MapKit

private enum MapSelection: Equatable {
    case vehicle(String)
    case station(String, stopId: String?)
}

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
    @State private var now = Foundation.Date()
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
    private let tick = Timer.publish(every: 0.1, on: .main, in: .common).autoconnect()

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
            .onReceive(tick) { date in
                // Many vehicles: every other tick, so the map isn't rebuilt ten times a second
                if showVehicles, visibleVehicles.count < 150 || Int(date.timeIntervalSinceReferenceDate * 10) % 2 == 0 { now = date }
            }
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
        .overlay(alignment: .bottom) {
            if let selection { card(for: selection).transition(.move(edge: .bottom).combined(with: .opacity)) }
        }
        .animation(.easeOut(duration: 0.2), value: selection)
        .navigationTitle("Map")
        .navigationBarTitleDisplayMode(.inline)
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
                Annotation("", coordinate: at, anchor: m.stopId != nil || span < 0.012 ? .bottom : .center) {
                    marker(m).opacity(morphStart != nil ? max(e, 0.01) : 1)
                        .onTapGesture { selection = .station(m.stationId, stopId: m.stopId) }
                }
            }
            // Platforms folding back into their group
            ForEach(ghosts) { m in
                let h = (m.homeLat ?? m.latitude, m.homeLon ?? m.longitude)
                Annotation("", coordinate: CLLocationCoordinate2D(latitude: m.latitude + (h.0 - m.latitude) * e, longitude: m.longitude + (h.1 - m.longitude) * e), anchor: .bottom) {
                    marker(m).opacity(max(1 - e, 0.01)).allowsHitTesting(false)
                }
            }
        }
    }

    @MapContentBuilder private var vehiclesContent: some MapContent {
        if showVehicles {
            ForEach(visibleVehicles) { v in
                Annotation("", coordinate: model.tracks[v.id]?.position(at: now) ?? v.coordinate) {
                    VehicleDisc(line: v.route, bearing: v.bearing, selected: selection == .vehicle(v.id), compact: span >= 0.02)
                        .onTapGesture { selection = .vehicle(v.id) }
                }
            }
        }
    }

    // MARK: Markers

    @ViewBuilder private func marker(_ m: StopMarker) -> some View {
        let selected = selection == .station(m.stationId, stopId: m.stopId)
        // Names from about web zoom 15 (stop groups) and for every single platform; a plain pictogram dot further out
        if m.stopId != nil || span < 0.012 || selected { stopCard(m, selected: selected) }
        else { groupMarker(m.category, selected: selected) }
    }

    /// Name, direction and a few line badges, like the web's stop cards: the card sits centred above the stop, a pin dot on the stop.
    private func stopCard(_ m: StopMarker, selected: Bool) -> some View {
        let tint = m.stopId != nil ? Theme.secondary : m.category.tint
        return VStack(spacing: 3) {
            VStack(alignment: .leading, spacing: 2) {
                Text(m.name).font(.system(size: 12, weight: .semibold)).lineLimit(1)
                    .frame(maxWidth: 170, alignment: .leading)
                if !m.towards.isEmpty {
                    Text("▸ " + m.towards.prefix(2).joined(separator: " / ")).font(.system(size: 11)).foregroundStyle(Theme.secondary).lineLimit(1)
                        .frame(maxWidth: 170, alignment: .leading)
                }
                HStack(spacing: 2) {
                    ForEach(m.routes.prefix(4), id: \.routeId) { r in
                        Text(r.shortName ?? "").font(.system(size: 10, weight: .bold)).lineLimit(1).fixedSize()
                            .foregroundStyle(Color(hex: r.textColor ?? "#ffffff"))
                            .padding(.horizontal, 4).frame(minHeight: 14).frame(minWidth: 14)
                            .background(Color(hex: r.color ?? "#000000"), in: RoundedRectangle(cornerRadius: 3))
                    }
                    if m.routes.count > 4 { Text("+\(m.routes.count - 4)").font(.system(size: 10, weight: .semibold)).foregroundStyle(Theme.secondary).fixedSize() }
                }
            }
            .padding(.horizontal, 7).padding(.vertical, 5)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(tint, lineWidth: selected ? 3 : 1.5))
            Circle().fill(tint).frame(width: 10, height: 10).overlay(Circle().stroke(Color.white, lineWidth: 2))
        }
        .fixedSize()
        .offset(y: 5)
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

    private func groupMarker(_ c: LineCategory, selected: Bool) -> some View {
        Image(c.asset).renderingMode(.template).resizable().scaledToFit()
            .frame(width: selected ? 20 : 15, height: selected ? 20 : 15).foregroundStyle(c.tint)
            .padding(5).background(Theme.surface, in: Circle()).overlay(Circle().stroke(selected ? Color.primary : Theme.separator, lineWidth: selected ? 2 : 1))
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
            if let s = model.stations.first(where: { $0.stationId == id }) { StopCard(station: s, stopId: stopId) { self.selection = nil } }
        }
    }
}

private struct CardChrome<Content: View>: View {
    let close: () -> Void
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 8) { content }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(alignment: .topTrailing) {
                Button(action: close) { Image(systemName: "xmark.circle.fill").font(.system(size: 22)).foregroundStyle(Theme.secondary.opacity(0.7)) }
                    .padding(10)
            }
            .padding(.horizontal, 12).padding(.bottom, 8)
    }
}

/// Route badge, destination, vehicle model and plate, delay.
private struct VehicleCard: View {
    let vehicle: Vehicle
    let close: () -> Void
    @State private var delay: Int?
    @State private var delayKnown = false

    var body: some View {
        CardChrome(close: close) {
            HStack(spacing: 10) {
                if let r = vehicle.route { LineBadge(line: r) }
                Text(vehicle.headsign ?? tr("Unknown destination")).font(.system(size: 17, weight: .semibold)).lineLimit(2)
                    .padding(.trailing, 28)
            }
            let info = [vehicle.model, vehicle.plate].compactMap { $0 }.joined(separator: " · ")
            if !info.isEmpty { Text(info).font(.system(size: 15)).foregroundStyle(Theme.secondary) }
            if delayKnown, let delay {
                let minutes = Int((Double(abs(delay)) / 60).rounded())
                Text(minutes == 0 ? tr("On time") : delay > 0 ? tr("\(minutes) min late") : tr("\(minutes) min early"))
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(minutes == 0 ? Theme.live : delay > 0 ? Theme.late : Theme.early)
            }
            if let tripId = vehicle.tripId, let date = vehicle.serviceDate {
                NavigationLink(value: TripTarget(tripId: tripId, serviceDate: date, route: vehicle.route, headsign: vehicle.headsign)) {
                    Text("Open trip →").font(.system(size: 15, weight: .medium)).foregroundStyle(Theme.accent)
                }
            }
        }
        .task(id: vehicle.tripId) {
            delay = nil; delayKnown = false
            guard let tripId = vehicle.tripId, let date = vehicle.serviceDate else { return }
            let m = TripViewModel()
            await m.load(tripId: tripId, serviceDate: date)
            // Delay at the last stop with realtime data that the vehicle has reached
            let now = Date()
            let reached = (m.trip?.stops ?? []).filter { $0.departure <= now || $0.arrival <= now }
            delay = reached.last(where: { $0.realtime }).flatMap { $0.departureDelay ?? $0.arrivalDelay }
            delayKnown = true
        }
    }
}

/// A stop's (or group's) next departures.
private struct StopCard: View {
    let station: Station
    let stopId: String?
    let close: () -> Void
    @State private var model = DeparturesViewModel()

    private var platform: Platform? { station.platforms.first { $0.stopId == stopId } }
    private var request: DeparturesRequest {
        DeparturesRequest(stopIds: stopId.map { [$0] } ?? station.sortedPlatforms.map(\.stopId), limit: 5)
    }

    var body: some View {
        CardChrome(close: close) {
            Text(platform?.name ?? station.name).font(.system(size: 17, weight: .semibold)).padding(.trailing, 28)
            if let p = platform, !p.headsigns.isEmpty {
                Text(tr("towards \(p.headsigns.joined(separator: " / "))")).font(.system(size: 13)).foregroundStyle(Theme.secondary)
            }
            TimelineView(.periodic(from: .now, by: 1)) { ctx in
                VStack(spacing: 6) {
                    ForEach(model.departures.filter { !$0.terminates }.prefix(5)) { d in
                        HStack(spacing: 10) {
                            if let r = d.route { LineBadge(line: r) }
                            Text(d.headsign ?? "—").font(.system(size: 15)).lineLimit(1)
                            Spacer()
                            let c = Countdown.text(seconds: d.time.timeIntervalSince(ctx.date), at: d.time, fixed: false)
                            Text(c.unit.map { "\(c.value) \($0)" } ?? c.value).font(.system(size: 15, weight: .semibold)).monospacedDigit()
                        }
                    }
                }
            }
            NavigationLink(value: StationTarget(stationId: station.stationId, from: stopId)) {
                Text("Departures →").font(.system(size: 15, weight: .medium)).foregroundStyle(Theme.accent)
            }
        }
        .task(id: request) { await model.run(request) }
    }
}
