//
//  RouteDetailsViewModel.swift
//  timetable
//

import Foundation
import Observation
import TimetableAPI

struct RouteDirection: Identifiable, Hashable {
    struct StopRef: Identifiable, Hashable { let stopId: String; let name: String; var id: String { stopId } }
    let directionId: Int
    let headsign: String
    let stops: [StopRef]
    var id: Int { directionId }
}

struct RouteDetail {
    let line: LineRef
    let title: String
    let flags: [Marker]
    let directions: [RouteDirection]
}

@MainActor
@Observable
final class RouteDetailsViewModel {
    let routeId: String
    private(set) var route: RouteDetail?
    private(set) var state: LoadState = .idle
    var directionId = 0

    private let client: GraphQLClient

    init(routeId: String, client: GraphQLClient = Network.shared) {
        self.routeId = routeId
        self.client = client
    }

    var direction: RouteDirection? { route?.directions.first { $0.directionId == directionId } ?? route?.directions.first }
    var otherDirection: RouteDirection? { route?.directions.first { $0.directionId != direction?.directionId } }

    func load() async {
        state = .loading
        do {
            let data = try await client.fetch(RouteByIdQuery(routeId: routeId))
            guard let r = data.route else { state = .failed(tr("Route not found.")); return }
            var marks: [Marker] = []
            if r.flags.frontDoor { marks.append(.frontDoor) }
            if r.flags.replacement { marks.append(.replacement) }
            if r.flags.lowFloor { marks.append(.lowFloor) }
            if r.flags.demandResponsive { marks.append(.demand) }
            if r.flags.circular { marks.append(.circular) }
            let line = LineRef(routeId: r.routeId, shortName: r.shortName, color: r.color, textColor: r.textColor, type: r.type?.rawValue)
            let directions = (r.directions ?? []).map { d in
                RouteDirection(directionId: d.directionId, headsign: d.headsign,
                               stops: d.stops.map { RouteDirection.StopRef(stopId: $0.stopId, name: $0.name ?? $0.stopId) })
            }
            route = RouteDetail(line: line, title: r.desc ?? r.longName ?? r.shortName ?? r.routeId, flags: marks, directions: directions)
            directionId = directions.first?.directionId ?? 0
            state = .idle
        } catch {
            state = .failure(error)
        }
    }
}
