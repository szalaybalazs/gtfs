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
    var lines = true
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
    private static let maxStops = 300

    private var span: Double { region.span.latitudeDelta }
    /// Group markers from here, single platforms when closer still (web: GROUPS_ZOOM / STOPS_ZOOM).
    private var platformsZoom: Bool { span < 0.007 }
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
            .mapStyle(.standard(pointsOfInterest: .excludingAll))
            .onMapCameraChange(frequency: .onEnd) { region = $0.region }
            .onReceive(tick) { if showVehicles { now = $0 } }
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
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if let selection { card(for: selection).transition(.move(edge: .bottom)) }
        }
        .animation(.easeOut(duration: 0.2), value: selection)
        .navigationTitle("Map")
        .navigationBarTitleDisplayMode(.inline)
        .transitDestinations()
        .task(id: layers.lines) { if layers.lines { await model.loadLines() } }
        // Vehicles every 10 s while the layer is on; stops when the view moves
        .task(id: showVehicles) {
            guard showVehicles else { return }
            while !Task.isCancelled {
                await model.loadVehicles(region)
                try? await Task.sleep(nanoseconds: UInt64(MapViewModel.refreshSeconds * 1_000_000_000))
            }
        }
        // Stops are fetched whenever the view is close enough (whatever the layer switch says), so switching it on is instant
        .task(id: "\(Int(region.center.latitude * 2000))|\(Int(region.center.longitude * 2000))|\(span < 0.007)") {
            if span < 0.06 { await model.loadStations(region) }
        }
        // Debounced: the visible subset is worked out off the main thread once the view has settled
        .task(id: "\(region.center.latitude)|\(region.center.longitude)|\(span)|\(model.stations.count)") {
            try? await Task.sleep(nanoseconds: 150_000_000)
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
        if layers.lines && span < 0.5 {
            let base: Double = span > 0.1 ? 1.2 : span > 0.03 ? 2 : 3
            ForEach(model.lines.filter { layers.kinds.contains($0.category) }) { l in
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
            ForEach(visibleStops) { m in
                Annotation("", coordinate: m.coordinate) {
                    marker(m).onTapGesture { selection = .station(m.stationId, stopId: m.stopId) }
                }
            }
        }
    }

    @MapContentBuilder private var vehiclesContent: some MapContent {
        if showVehicles {
            ForEach(visibleVehicles) { v in
                Annotation("", coordinate: model.tracks[v.id]?.position(at: now) ?? v.coordinate) {
                    VehicleDisc(line: v.route, bearing: v.bearing, selected: selection == .vehicle(v.id), compact: span >= 0.028)
                        .onTapGesture { selection = .vehicle(v.id) }
                }
            }
        }
    }

    // MARK: Markers

    @ViewBuilder private func marker(_ m: StopMarker) -> some View {
        let selected = selection == .station(m.stationId, stopId: m.stopId)
        if m.stopId != nil { stopDot(selected: selected) } else { groupMarker(m.category, selected: selected) }
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
                    out.append((StopMarker(id: p.stopId, stationId: s.stationId, stopId: p.stopId, latitude: lat, longitude: lon, category: .other),
                                (lat - c.latitude) * (lat - c.latitude) + (lon - c.longitude) * (lon - c.longitude)))
                }
            } else if inside(s.lat, s.lon) {
                let cat = LineCategory.allCases.first { k in s.routes.contains { LineCategory.of($0) == k } } ?? .other
                out.append((StopMarker(id: s.stationId, stationId: s.stationId, stopId: nil, latitude: s.lat, longitude: s.lon, category: cat),
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
            .shadow(color: .black.opacity(0.15), radius: 10, y: 2)
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
