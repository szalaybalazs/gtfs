//
//  StationsViewModel.swift
//  timetable
//
//  Stop-group search and the nearby list.
//

import Foundation
import CoreLocation
import Observation
import TimetableAPI

@MainActor
@Observable
final class StationsViewModel {
    struct Nearby: Identifiable {
        let station: Station
        let distance: Double
        var id: String { station.stationId }
    }

    private(set) var results: [Station] = []
    private(set) var nearby: [Nearby] = []
    private(set) var searchState: LoadState = .idle
    private(set) var nearbyState: LoadState = .idle
    /// False when location permission is denied or unavailable.
    private(set) var locationAvailable = true

    private let client: GraphQLClient
    private let locate: () async -> CLLocationCoordinate2D?

    init(client: GraphQLClient = Network.shared, locate: (() async -> CLLocationCoordinate2D?)? = nil) {
        self.client = client
        self.locate = locate ?? { await LocationManager().currentLocation() }
    }

    /// Pages of stop groups: the search results, or all of them when the text is empty.
    private(set) var page = 0
    private(set) var pages = 0
    var hasMore: Bool { page + 1 < pages }

    func search(_ text: String) async {
        let query = text.trimmingCharacters(in: .whitespaces)
        searchState = .loading
        do {
            let data = try await client.fetch(StationsQuery(limit: .some(30), page: .some(0), search: query.isEmpty ? .null : .some(query)))
            guard !Task.isCancelled else { return }
            results = data.stations.data.map(Station.init).filter { !$0.routes.isEmpty }
            page = data.stations.page
            pages = data.stations.pages
            searchState = .idle
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled else { return }
            results = []
            searchState = .failure(error)
        }
    }

    func loadMore(_ text: String) async {
        guard hasMore, !searchState.isLoading else { return }
        let query = text.trimmingCharacters(in: .whitespaces)
        searchState = .loading
        do {
            let data = try await client.fetch(StationsQuery(limit: .some(30), page: .some(page + 1), search: query.isEmpty ? .null : .some(query)))
            guard !Task.isCancelled else { return }
            results += data.stations.data.map(Station.init).filter { !$0.routes.isEmpty }
            page = data.stations.page
            pages = data.stations.pages
            searchState = .idle
        } catch {
            searchState = .idle
        }
    }

    /// A position that never arrives (permission prompt ignored, no fix) counts as "location off" after a few seconds.
    private func locateWithTimeout() async -> CLLocationCoordinate2D? {
        let locate = self.locate
        return await withTaskGroup(of: CLLocationCoordinate2D?.self) { group in
            group.addTask { await locate() }
            group.addTask { try? await Task.sleep(nanoseconds: 6_000_000_000); return nil }
            let first = await group.next() ?? nil
            group.cancelAll()
            return first
        }
    }

    func loadNearby(radius: Int) async {
        nearbyState = .loading
        guard let here = await locateWithTimeout() else {
            locationAvailable = false
            nearby = []
            nearbyState = .idle
            return
        }
        locationAvailable = true
        do {
            let data = try await client.fetch(NearbyStationsQuery(lat: here.latitude, lon: here.longitude, radius: Double(radius)))
            guard !Task.isCancelled else { return }
            let origin = CLLocation(latitude: here.latitude, longitude: here.longitude)
            nearby = data.stationsByRadius
                .map(Station.init)
                .filter { !$0.routes.isEmpty }
                .map { Nearby(station: $0, distance: origin.distance(from: CLLocation(latitude: $0.lat, longitude: $0.lon))) }
                .sorted { $0.distance < $1.distance }
            nearbyState = .idle
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled else { return }
            nearby = []
            nearbyState = .failure(error)
        }
    }
}
