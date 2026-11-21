//
//  TripViewModel.swift
//  timetable
//

import CoreLocation
import Foundation
import Observation
import TimetableAPI

@MainActor
@Observable
final class TripViewModel {
    private(set) var trip: Trip?
    private(set) var state: LoadState = .idle
    private(set) var loaded = false
    private(set) var vehicle: TripVehicle?
    private(set) var path: [CLLocationCoordinate2D] = []
    private var pathLoaded = false

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
            // Vehicle is separate and non-fatal: the trip shows even if this part fails
            vehicle = (try? await client.fetch(TripVehicleQuery(id: tripId, serviceDate: .some(serviceDate))))?.trip?.vehicle.map(TripVehicle.init)
            if !pathLoaded {
                pathLoaded = true
                if let d = try? await client.fetch(TripPathQuery(id: tripId, serviceDate: .some(serviceDate))),
                   let cs = d.trip?.path?.coordinates {
                    path = cs.compactMap { c in
                        guard let c, c.count >= 2 else { return nil }
                        return CLLocationCoordinate2D(latitude: c[1], longitude: c[0])
                    }
                }
            }
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled else { return }
            if !loaded { trip = nil }
            state = .failure(error)
        }
    }
}
