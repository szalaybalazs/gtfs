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
    /// Platforms this close count as "here".
    static let hereMetres = 200.0

    func locate() async {
        phase = .locating
        let here = await LocationManager().currentLocation()
        guard let here else { phase = .noLocation; return }
        phase = .loading
        do {
            let data = try await Network.shared.fetch(NearbyStationsQuery(lat: here.latitude, lon: here.longitude, radius: Self.hereMetres + 100))
            let origin = CLLocation(latitude: here.latitude, longitude: here.longitude)
            let stations = data.stationsByRadius.map(Station.init)
            let near = stations.flatMap { st in st.platforms.map { (st, $0) } }
                .filter { _, p in
                    guard let la = p.lat, let lo = p.lon, !p.routes.isEmpty else { return false }
                    return origin.distance(from: CLLocation(latitude: la, longitude: lo)) <= Self.hereMetres
                }
            stopIds = near.map { $0.1.stopId }
            names = Dictionary(near.map { ($0.1.stopId, $0.1.name ?? $0.0.name) }, uniquingKeysWith: { a, _ in a })
            phase = .ready
        } catch {
            phase = .failed
        }
    }
}

struct NearbyDeparturesView: View {
    @State private var here = NearbyDeparturesModel()
    @State private var departures = DeparturesViewModel()

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
                    if here.stopIds.isEmpty {
                        message(tr("No stops with departures within \(Int(NearbyDeparturesModel.hereMetres)) m."))
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
        .transitDestinations()
        .refreshable { await here.locate() }
        .task { await here.locate() }
        .task(id: here.stopIds) {
            guard !here.stopIds.isEmpty else { return }
            await departures.run(DeparturesRequest(stopIds: here.stopIds, limit: 40, hours: 2))
        }
    }

    private func message(_ text: String) -> some View {
        Text(text).foregroundStyle(Theme.secondary).multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(24)
    }
}
