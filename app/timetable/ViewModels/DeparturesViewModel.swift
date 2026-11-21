//
//  DeparturesViewModel.swift
//  timetable
//

import Foundation
import Observation
import TimetableAPI

struct DeparturesRequest: Hashable {
    var stopIds: [String]
    var routeIds: [String]? = nil
    var limit: Int
    var after: Foundation.Date? = nil
    var arrivals = false
    var perLine: Int? = nil
    /// How far ahead to look (the server's default is 3, its most 6).
    var hours: Int? = nil
}

@MainActor
@Observable
final class DeparturesViewModel {
    private(set) var departures: [Departure] = []
    private(set) var state: LoadState = .idle
    private(set) var loaded = false
    /// The stops the current `departures` were fetched for (while a new request is in flight they are still the previous ones).
    private(set) var loadedStopIds: [String] = []

    private let client: GraphQLClient
    /// The times refresh this often, like the web app.
    static let refreshSeconds: UInt64 = 30

    init(client: GraphQLClient = Network.shared) {
        self.client = client
    }

    /// Loads, then refreshes every 30 s until the task is cancelled (the view goes away or the request changes).
    func run(_ request: DeparturesRequest) async {
        guard !request.stopIds.isEmpty else { return }
        while !Task.isCancelled {
            await load(request)
            try? await Task.sleep(nanoseconds: Self.refreshSeconds * 1_000_000_000)
        }
    }

    func load(_ r: DeparturesRequest) async {
        if !loaded { state = .loading }
        do {
            let data = try await client.fetch(DeparturesQuery(
                stopIds: r.stopIds,
                routeIds: r.routeIds.map { .some($0) } ?? .null,
                limit: .some(r.limit),
                hours: r.hours.map { .some($0) } ?? .null,
                after: r.after.map { .some(APIDate.format($0)) } ?? .null,
                arrivals: .some(r.arrivals),
                perLine: r.perLine.map { .some($0) } ?? .null
            ))
            guard !Task.isCancelled else { return }
            departures = data.departures.compactMap(Departure.init)
            loadedStopIds = r.stopIds
            loaded = true
            state = .idle
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled else { return }
            // Keep the old list on a failed refresh
            if !loaded { departures = [] }
            state = .failure(error)
        }
    }
}
