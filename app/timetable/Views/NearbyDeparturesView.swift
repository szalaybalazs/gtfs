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
            let data = try await Network.shared.fetch(NearbyStationsQuery(lat: here.latitude, lon: here.longitude, radius: AimCone.range + 100))
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
    /// Frozen: the cone stays where it is, so you can lower the phone and read the list.
    @State private var frozen = false
    @State private var compass = HeadingTracker()

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
                        NearbyList(departures: departures.departures, names: here.names, spots: here.spots, at: aiming ? here.here : nil)
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
                    if aiming { frozen = false; compass.start() } else { compass.stop() }
                } label: { Image(systemName: aiming ? "scope" : "location.north.line") }
                    .accessibilityLabel(aiming ? tr("Stop pointing") : tr("Point at a stop"))
                    .tint(aiming ? Theme.accent : nil)
            }
        }
        .onChange(of: aiming) { _, _ in here.refreshStops(aim: aiming ? cone : nil) }
        .onChange(of: cone) { _, new in if aiming { here.refreshStops(aim: new) } }
        // Follow the compass unless frozen; small wobbles are ignored
        .onChange(of: compass.heading) { _, h in
            guard aiming, !frozen, let h, abs(Geo.angleDiff(h, cone.heading)) >= 3 else { return }
            cone.heading = h
        }
        .onDisappear { compass.stop() }
        .onChange(of: here.spots) { _, _ in here.refreshStops(aim: aiming ? cone : nil) }
        .transitDestinations()
        .refreshable { await here.locate() }
        .task { await here.locate() }
        .task(id: here.stopIds) {
            guard !here.stopIds.isEmpty else { return }
            await departures.run(DeparturesRequest(stopIds: here.stopIds, limit: 40, hours: 2))
        }
    }

    /// The map at full width, the Freeze toggle full width under it.
    @ViewBuilder private func aimPanel(_ at: CLLocationCoordinate2D) -> some View {
        VStack(spacing: 10) {
            AimMap(here: at, spots: here.spots, cone: cone)
                .frame(maxWidth: .infinity)
                .frame(height: 240)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            Button { frozen.toggle() } label: {
                Label(frozen ? "Unfreeze" : "Freeze", systemImage: "snowflake")
                    .font(.system(size: 15, weight: .semibold)).frame(maxWidth: .infinity).padding(.vertical, 12)
                    .foregroundStyle(frozen ? Color.white : Color.primary)
                    .background(frozen ? Theme.accent : Theme.fill, in: Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 12)
    }

    private static func compassName(_ deg: Double) -> String {
        let names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
        return names[Int(((deg + 22.5).truncatingRemainder(dividingBy: 360)) / 45) % 8]
    }

    private func message(_ text: String) -> some View {
        Text(text).foregroundStyle(Theme.secondary).multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(24)
    }
}

/// The departures in time order (or, while pointing, nearest platform first). A departure that left stays a few seconds,
/// counting -1, -2…, greyed, then fades and slides away.
private struct NearbyList: View {
    let departures: [Departure]
    let names: [String: String]
    let spots: [AimSpot]
    /// Where you are, when ranking by distance.
    let at: CLLocationCoordinate2D?

    private func ordered(_ now: Foundation.Date) -> [Departure] {
        var list = departures.filter { $0.time >= now.addingTimeInterval(-8) }
        if let at {
            var dist: [String: Double] = [:]
            for sp in spots where dist[sp.stopId] == nil { dist[sp.stopId] = Geo.distance(at, sp.coordinate) }
            list.sort { x, y in
                let dx = dist[x.stopId] ?? Double.infinity, dy = dist[y.stopId] ?? Double.infinity
                return dx != dy ? dx < dy : x.time < y.time
            }
        }
        return Array(list.prefix(25))
    }

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let list = ordered(context.date)
            Card {
                VStack(spacing: 0) {
                    ForEach(list) { d in
                        row(d, now: context.date, isLast: d.id == list.last?.id)
                    }
                }
                .animation(.easeInOut(duration: 0.45), value: list.map(\.id))
            }
        }
    }

    @ViewBuilder private func row(_ d: Departure, now: Foundation.Date, isLast: Bool) -> some View {
        let target = TripTarget(tripId: d.tripId, serviceDate: d.serviceDate, from: d.stopId, route: d.route, headsign: d.headsign)
        NavigationLink(value: target) {
            DepartureRow(departure: d, now: now, platform: names[d.stopId])
        }
        .buttonStyle(RowButtonStyle())
        .opacity(d.time < now ? 0.5 : 1)
        .transition(.opacity)
        if !isLast { Divider().overlay(Theme.separator) }
    }
}
