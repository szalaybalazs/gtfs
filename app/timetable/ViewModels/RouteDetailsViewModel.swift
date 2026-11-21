//
//  RouteDetailsViewModel.swift
//  timetable
//

import Foundation
import CoreLocation
import Observation
import TimetableAPI

@MainActor
@Observable
final class RouteDetailsViewModel {
    typealias Route = RouteByIdQuery.Data.Route
    typealias Direction = Route.Direction
    typealias Stop = Direction.Stop

    let routeId: TimetableAPI.ID
    private(set) var route: Route?
    private(set) var state: LoadState = .idle

    /// nil until the route has loaded.
    var stopId: TimetableAPI.ID?
    var directionId: Int = 0

    var directions: [Direction] { route?.directions ?? [] }
    var stops: [Stop] { directions.first { $0.directionId == directionId }?.stops ?? [] }

    private let client: GraphQLClient
    private let locate: () async -> CLLocationCoordinate2D?

    init(
        routeId: TimetableAPI.ID,
        client: GraphQLClient = Network.shared,
        locate: (() async -> CLLocationCoordinate2D?)? = nil
    ) {
        self.routeId = routeId
        self.client = client
        self.locate = locate ?? { await LocationManager().currentLocation() }
    }

    func load() async {
        state = .loading
        let location = await locate()
        do {
            let data = try await client.fetch(RouteByIdQuery(
                routeId: routeId,
                lat: location.map { .some($0.latitude) } ?? .null,
                lon: location.map { .some($0.longitude) } ?? .null
            ))
            guard let route = data.route else {
                state = .failed(tr("Route not found."))
                return
            }
            self.route = route
            selectInitialStop(for: route)
            state = .idle
        } catch {
            state = .failure(error)
        }
    }

    /// When the direction changes, keep the same stop if it exists there, else pick the first one.
    func directionChanged() {
        if let stopId, stops.contains(where: { $0.stopId == stopId }) { return }
        stopId = stops.first?.stopId
    }

    private func selectInitialStop(for route: Route) {
        let directions = route.directions ?? []
        if let closest = route.closestStop,
           let direction = directions.first(where: { $0.stops.contains { $0.stopId == closest.stopId } }) {
            directionId = direction.directionId
            stopId = closest.stopId
        } else {
            directionId = directions.first?.directionId ?? 0
            stopId = directions.first?.stops.first?.stopId
        }
    }
}
