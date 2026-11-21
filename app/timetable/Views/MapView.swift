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
    var stops = true
    var kinds = Set(LineCategory.allCases)
}

struct MapView: View {
    private static let center = CLLocationCoordinate2D(latitude: 47.5073, longitude: 19.0236) // Széll Kálmán tér

    @State private var model = MapViewModel()
    @State private var position: MapCameraPosition = .region(MKCoordinateRegion(center: MapView.center, span: MKCoordinateSpan(latitudeDelta: 0.012, longitudeDelta: 0.012)))
    @State private var region = MKCoordinateRegion(center: MapView.center, span: MKCoordinateSpan(latitudeDelta: 0.012, longitudeDelta: 0.012))
    @State private var layers = MapLayers()
    @State private var selection: MapSelection?
    @State private var here: CLLocationCoordinate2D?
    @State private var now = Foundation.Date()

    private var span: Double { region.span.latitudeDelta }
    /// Group markers from here, single platforms when closer still (web: GROUPS_ZOOM / STOPS_ZOOM).
    private var showStops: Bool { layers.stops && span < 0.06 }
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
        ZStack(alignment: .bottom) {
            Map(position: $position) {
                userContent
                stopsContent
                vehiclesContent
            }
            .mapStyle(.standard(pointsOfInterest: .excludingAll))
            .onMapCameraChange(frequency: .onEnd) { region = $0.region }
            .onReceive(tick) { if showVehicles { now = $0 } }

            VStack(spacing: 8) {
                HStack {
                    Spacer()
                    VStack(spacing: 8) {
                        layersMenu
                        mapButton("location.fill", label: "Show my location") { Task { await locate() } }
                    }
                }
                .padding(.horizontal, 12).padding(.top, 8)
                Spacer()
                if let selection { card(for: selection).transition(.move(edge: .bottom)) }
            }
            .animation(.easeOut(duration: 0.2), value: selection)
        }
        .navigationTitle("Map")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Text(model.vehiclesLoaded && showVehicles ? tr("\(visibleVehicles.count) vehicles in view") : tr("Loading vehicles…"))
                    .font(.system(size: 13)).foregroundStyle(Theme.secondary)
            }
        }
        .transitDestinations()
        // Vehicles every 10 s while the layer is on; stops when the view moves
        .task(id: showVehicles) {
            guard showVehicles else { return }
            while !Task.isCancelled {
                await model.loadVehicles(region)
                try? await Task.sleep(nanoseconds: UInt64(MapViewModel.refreshSeconds * 1_000_000_000))
            }
        }
        .task(id: "\(Int(region.center.latitude * 2000))|\(Int(region.center.longitude * 2000))|\(span < 0.007)") {
            if showStops { await model.loadStations(region) }
        }
    }

    // MARK: Map content

    @MapContentBuilder private var userContent: some MapContent {
        if let here {
            Annotation("", coordinate: here) {
                Circle().fill(Color.blue).frame(width: 14, height: 14).overlay(Circle().stroke(Color.white, lineWidth: 2))
            }
        }
    }

    @MapContentBuilder private var stopsContent: some MapContent {
        if showStops {
            ForEach(model.stations) { station in
                if platformsZoom {
                    ForEach(station.sortedPlatforms.filter { $0.lat != nil && $0.lon != nil }) { p in
                        Annotation("", coordinate: CLLocationCoordinate2D(latitude: p.lat ?? 0, longitude: p.lon ?? 0)) {
                            stopDot(selected: selection == .station(station.stationId, stopId: p.stopId))
                                .onTapGesture { selection = .station(station.stationId, stopId: p.stopId) }
                        }
                    }
                } else {
                    Annotation("", coordinate: CLLocationCoordinate2D(latitude: station.lat, longitude: station.lon)) {
                        groupMarker(station, selected: selection == .station(station.stationId, stopId: nil))
                            .onTapGesture { selection = .station(station.stationId, stopId: nil) }
                    }
                }
            }
        }
    }

    @MapContentBuilder private var vehiclesContent: some MapContent {
        if showVehicles {
            ForEach(visibleVehicles) { v in
                Annotation("", coordinate: model.tracks[v.id]?.position(at: now) ?? v.coordinate) {
                    vehicleBadge(v, selected: selection == .vehicle(v.id))
                        .onTapGesture { selection = .vehicle(v.id) }
                }
            }
        }
    }

    // MARK: Markers

    private func stopDot(selected: Bool) -> some View {
        Circle().fill(Theme.surface).frame(width: selected ? 16 : 11, height: selected ? 16 : 11)
            .overlay(Circle().stroke(selected ? Color.primary : Theme.secondary, lineWidth: 2)).padding(8)
    }

    private func groupMarker(_ s: Station, selected: Bool) -> some View {
        let c = LineCategory.allCases.first { c in s.routes.contains { LineCategory.of($0) == c } } ?? .other
        return Image(c.asset).renderingMode(.template).resizable().scaledToFit()
            .frame(width: selected ? 20 : 15, height: selected ? 20 : 15).foregroundStyle(c.tint)
            .padding(5).background(Theme.surface, in: Circle()).overlay(Circle().stroke(selected ? Color.primary : Theme.separator, lineWidth: selected ? 2 : 1))
            .padding(4)
    }

    private func vehicleBadge(_ v: Vehicle, selected: Bool) -> some View {
        let line = v.route
        return Text(line?.shortName ?? "?")
            .font(.system(size: selected ? 12 : 10, weight: .bold)).lineLimit(1).minimumScaleFactor(0.6)
            .foregroundStyle(Color(hex: line?.textColor ?? "#ffffff"))
            .frame(width: selected ? 34 : 28, height: selected ? 18 : 15)
            .background(Color(hex: line?.color ?? "#6b7280"), in: RoundedRectangle(cornerRadius: 4, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 4, style: .continuous).stroke(selected ? Color.primary : .white, lineWidth: selected ? 2 : 1))
            .padding(6)
    }

    // MARK: Controls

    private func mapButton(_ symbol: String, label: LocalizedStringKey, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 17)).foregroundStyle(Theme.accent)
                .frame(width: 44, height: 44).background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .accessibilityLabel(label)
    }

    private var layersMenu: some View {
        Menu {
            Toggle("Vehicles", isOn: $layers.vehicles)
            Toggle("Stops", isOn: $layers.stops)
            Divider()
            Section("Lines") {
                ForEach(LineCategory.allCases, id: \.self) { c in
                    Toggle(c.title, isOn: Binding(get: { layers.kinds.contains(c) },
                                                  set: { if $0 { layers.kinds.insert(c) } else { layers.kinds.remove(c) } }))
                }
            }
        } label: {
            Image(systemName: "square.3.layers.3d").font(.system(size: 17)).foregroundStyle(Theme.accent)
                .frame(width: 44, height: 44).background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .accessibilityLabel("Map layers")
    }

    private func locate() async {
        guard let c = await LocationManager().currentLocation() else { return }
        here = c
        withAnimation { position = .region(MKCoordinateRegion(center: c, span: MKCoordinateSpan(latitudeDelta: 0.008, longitudeDelta: 0.008))) }
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
