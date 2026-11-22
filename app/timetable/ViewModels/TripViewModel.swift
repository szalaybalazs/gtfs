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
    /// The whole trip reloads every 30 s; the vehicle's position every 10 s (it moves, and the map shows it).
    static let refreshSeconds: UInt64 = 30
    static let vehicleSeconds: UInt64 = 10

    init(client: GraphQLClient = Network.shared) {
        self.client = client
    }

    /// Loads, then refreshes until the task is cancelled: the vehicle every 10 s, the whole trip every 30 s.
    func run(tripId: String, serviceDate: String) async {
        var tick: UInt64 = 0
        while !Task.isCancelled {
            if tick % (Self.refreshSeconds / Self.vehicleSeconds) == 0 {
                await load(tripId: tripId, serviceDate: serviceDate)
            } else {
                await refreshVehicle(tripId: tripId, serviceDate: serviceDate)
            }
            tick += 1
            try? await Task.sleep(nanoseconds: Self.vehicleSeconds * 1_000_000_000)
        }
    }

    /// Only the vehicle's position (cheap; the trip's stops don't change between full loads).
    func refreshVehicle(tripId: String, serviceDate: String) async {
        guard loaded else { return }
        let v = (try? await client.fetch(TripVehicleQuery(id: tripId, serviceDate: .some(serviceDate))))?.trip?.vehicle.map(TripVehicle.init)
        if !Task.isCancelled { vehicle = v }
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
