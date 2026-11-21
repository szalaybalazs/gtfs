//
//  NearbyDeparturesView.swift
//  timetable
//
//  Nearby tab: by GPS alone, the platforms right around you and what leaves from them next, soonest first
//  (web/src/pages/NearbyDeparturesPage.tsx).
//

import SwiftUI
import CoreLocation
import TimetableAPI

@MainActor
@Observable
final class NearbyDeparturesModel {
    enum Phase { case locating, noLocation, loading, ready, failed }
    private(set) var phase: Phase = .locating
    private(set) var stopIds: [String] = []
    /// Platform name by stop id, for "from where" on each row.
    private(set) var names: [String: String] = [:]
    /// Where you are, and every platform within reach (for the aim map and its filter).
    private(set) var here: CLLocationCoordinate2D?
    private(set) var spots: [AimSpot] = []
    /// Platforms this close count as "here".
    static let hereMetres = 200.0

    /// The platforms to list: those right here, or (aiming) those inside the cone.
    func refreshStops(aim: AimCone?) {
        guard let here else { return }
        let next: [String]
        if let aim { next = spots.filter { aim.contains($0.coordinate, from: here) }.map(\.stopId) }
        else { next = spots.filter { Geo.distance(here, $0.coordinate) <= Self.hereMetres }.map(\.stopId) }
        if next != stopIds { stopIds = next }
    }

    func locate() async {
        phase = .locating
        let located = await LocationManager().currentLocation()
        guard let here = located else { phase = .noLocation; return }
        self.here = here
        phase = .loading
        do {
            let data = try await Network.shared.fetch(NearbyStationsQuery(lat: here.latitude, lon: here.longitude, radius: AimCone.maxRange + 100))
            let origin = CLLocation(latitude: here.latitude, longitude: here.longitude)
            let stations = data.stationsByRadius.map(Station.init)
            spots = stations.flatMap { st in
                st.platforms.compactMap { p -> AimSpot? in
                    guard let la = p.lat, let lo = p.lon, !p.routes.isEmpty else { return nil }
                    return AimSpot(stopId: p.stopId, name: p.name ?? st.name, lat: la, lon: lo)
                }
            }
            names = Dictionary(spots.map { ($0.stopId, $0.name) }, uniquingKeysWith: { a, _ in a })
            refreshStops(aim: nil)
            phase = .ready
        } catch {
            phase = .failed
        }
    }
}

struct NearbyDeparturesView: View {
    @State private var here = NearbyDeparturesModel()
    @State private var departures = DeparturesViewModel()
    /// "Point at the stop": a cone from where you stand picks the platforms (otherwise it's the ones right here).
    @State private var aiming = false
    @State private var cone = AimCone()
    @State private var compassNote: String?
    private let compass = HeadingReader()

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                switch here.phase {
                case .locating, .loading:
                    Card { SkeletonDepartureRows(count: 6) }
                case .noLocation:
                    message(tr("Location is off. Allow it in Settings to see what leaves near you."))
                case .failed:
                    ErrorView(message: tr("Couldn't load nearby stops.")) { await here.locate() }
                case .ready:
                    if aiming, let at = here.here { aimPanel(at) }
                    if here.stopIds.isEmpty {
                        message(aiming ? tr("No stops in that direction. Widen the cone or turn it.") : tr("No stops with departures within \(Int(NearbyDeparturesModel.hereMetres)) m."))
                    } else if !departures.loaded {
                        Card { SkeletonDepartureRows(count: 6) }
                    } else {
                        TimelineView(.periodic(from: .now, by: 1)) { context in
                            // A departure that left stays a few seconds (counting -1, -2…), fading, then slides away
                            let list = Array(departures.departures.filter { $0.time >= context.date.addingTimeInterval(-8) }.prefix(25))
                            Card {
                                VStack(spacing: 0) {
                                    ForEach(list) { d in
                                        NavigationLink(value: TripTarget(tripId: d.tripId, serviceDate: d.serviceDate, from: d.stopId, route: d.route, headsign: d.headsign)) {
                                            DepartureRow(departure: d, now: context.date, platform: here.names[d.stopId])
                                        }
                                        .buttonStyle(RowButtonStyle())
                                        .opacity(d.time < context.date ? 0.5 : 1)
                                        .transition(.opacity.combined(with: .move(edge: .leading)))
                                        if d.id != list.last?.id { Divider().overlay(Theme.separator) }
                                    }
                                }
                                .animation(.easeInOut(duration: 0.45), value: list.map(\.id))
                            }
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.canvas)
        .navigationTitle("Nearby")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    aiming.toggle()
                    if aiming { Task { await useCompass() } }
                } label: { Image(systemName: aiming ? "scope" : "location.north.line") }
                    .accessibilityLabel(aiming ? tr("Stop pointing") : tr("Point at a stop"))
                    .tint(aiming ? Theme.accent : nil)
            }
        }
        .onChange(of: aiming) { _, _ in here.refreshStops(aim: aiming ? cone : nil) }
        .onChange(of: cone) { _, new in if aiming { here.refreshStops(aim: new) } }
        .onChange(of: here.spots) { _, _ in here.refreshStops(aim: aiming ? cone : nil) }
        .transitDestinations()
        .refreshable { await here.locate() }
        .task { await here.locate() }
        .task(id: here.stopIds) {
            guard !here.stopIds.isEmpty else { return }
            await departures.run(DeparturesRequest(stopIds: here.stopIds, limit: 40, hours: 2))
        }
    }

    /// The small map with the cone, a button for the phone's heading, and what the cone is set to.
    @ViewBuilder private func aimPanel(_ at: CLLocationCoordinate2D) -> some View {
        VStack(spacing: 8) {
            AimMap(here: at, spots: here.spots, cone: $cone)
            HStack {
                Button { Task { await useCompass() } } label: {
                    Label("Use phone heading", systemImage: "location.north.line.fill").font(.system(size: 15, weight: .semibold))
                }
                .buttonStyle(.bordered)
                Spacer()
                Text("\(Int(cone.heading.rounded()))° · \(Int(cone.angle.rounded()))° wide · \(Int(cone.range.rounded())) m")
                    .font(.system(size: 13)).monospacedDigit().foregroundStyle(Theme.secondary)
            }
            if let compassNote { Text(compassNote).font(.system(size: 13)).foregroundStyle(Theme.secondary).frame(maxWidth: .infinity, alignment: .leading) }
            Text("Point at the stop you want. Drag the white dot to change the width and the range.")
                .font(.system(size: 13)).foregroundStyle(Theme.secondary).frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.bottom, 12)
    }

    private func useCompass() async {
        if let h = await compass.read() { cone.heading = h; compassNote = nil }
        else { compassNote = tr("No compass reading. Allow location, or this device has no compass.") }
    }

    private func message(_ text: String) -> some View {
        Text(text).foregroundStyle(Theme.secondary).multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(24)
    }
}
