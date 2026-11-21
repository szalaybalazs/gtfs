//
//  TripViewModel.swift
//  timetable
//

import Foundation
import Observation
import TimetableAPI

@MainActor
@Observable
final class TripViewModel {
    private(set) var trip: Trip?
    private(set) var state: LoadState = .idle
    private(set) var loaded = false

    private let client: GraphQLClient
    static let refreshSeconds: UInt64 = 30

    init(client: GraphQLClient = Network.shared) {
        self.client = client
    }

    /// Loads, then refreshes every 30 s until the task is cancelled.
    func run(tripId: String, serviceDate: String) async {
        while !Task.isCancelled {
            await load(tripId: tripId, serviceDate: serviceDate)
            try? await Task.sleep(nanoseconds: Self.refreshSeconds * 1_000_000_000)
        }
    }

    func load(tripId: String, serviceDate: String) async {
        if !loaded { state = .loading }
        do {
            let data = try await client.fetch(TripQuery(id: tripId, serviceDate: .some(serviceDate)))
            guard !Task.isCancelled else { return }
            trip = data.trip.map(Trip.init)
            loaded = true
            state = .idle
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled else { return }
            if !loaded { trip = nil }
            state = .failure(error)
        }
    }
}
