//
//  RouteDetailsViewModel.swift
//  timetable
//

import Foundation
import CoreLocation
import Observation
import TimetableAPI

struct RouteDirection: Identifiable, Hashable {
    struct StopRef: Identifiable, Hashable { let stopId: String; let name: String; var lat: Double? = nil; var lon: Double? = nil; var id: String { stopId } }
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
    /// The stop whose departures the page shows: picked by hand, else the nearest to you (like the web).
    var stopId: String?
    /// "Nearest stop on this line, 300 m away" and the like; empty when the stop was picked by hand.
    private(set) var hint = ""
    private(set) var locating = false
    private var chosenAutomatically = false

    private let client: GraphQLClient

    init(routeId: String, client: GraphQLClient = Network.shared) {
        self.routeId = routeId
        self.client = client
    }

    /// The shown stop: never a direction's last stop (nothing departs there).
    var stop: RouteDirection.StopRef? {
        guard let d = direction else { return nil }
        return d.stops.first { $0.stopId == stopId } ?? d.stops.first
    }

    /// Same place by name when switching direction, unless that is where the new direction ends: then its first stop.
    func swapDirection() {
        guard let target = otherDirection else { return }
        let name = stop?.name
        let match = target.stops.dropLast().first { $0.name == name } ?? target.stops.first
        directionId = target.directionId
        stopId = match?.stopId
        hint = ""
    }

    func pick(_ stopId: String) { self.stopId = stopId; hint = "" }

    /// Nearest stop on the line within 1 km (skipping each direction's last stop), else the end stop closest to you, else the first stop.
    func chooseNearest() async {
        guard let route, !route.directions.isEmpty, !chosenAutomatically else { return }
        chosenAutomatically = true
        locating = true
        hint = tr("Finding your location…")
        let here = await LocationManager().currentLocation()
        locating = false
        guard let here else {
            hint = ""
            if stopId == nil { stopId = route.directions.first?.stops.first?.stopId; directionId = route.directions.first?.directionId ?? 0 }
            return
        }
        func metres(_ s: RouteDirection.StopRef) -> Double? {
            guard let la = s.lat, let lo = s.lon else { return nil }
            return CLLocation(latitude: la, longitude: lo).distance(from: CLLocation(latitude: here.latitude, longitude: here.longitude))
        }
        var nearest: (RouteDirection, RouteDirection.StopRef, Double)?
        for d in route.directions {
            for s in d.stops.dropLast() { if let m = metres(s), m < (nearest?.2 ?? .infinity) { nearest = (d, s, m) } }
        }
        if let n = nearest, n.2 <= 1000 {
            directionId = n.0.directionId; stopId = n.1.stopId
            hint = tr("Nearest stop on this line, \(Self.distance(n.2)) away")
            return
        }
        // Not near the line: stay on one end stop and don't move the view to the closest end.
        // The direction button switches to the other end (see swapDirection).
        if stopId == nil {
            directionId = route.directions.first?.directionId ?? 0
            stopId = route.directions.first?.stops.first?.stopId
        }
        hint = ""
    }

    /// Back to the automatic choice (the location button).
    func useNearest() async { chosenAutomatically = false; stopId = nil; await chooseNearest() }

    private static func distance(_ m: Double) -> String { m < 1000 ? "\(Int(m.rounded())) m" : String(format: "%.1f km", m / 1000) }

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
                               stops: d.stops.map { RouteDirection.StopRef(stopId: $0.stopId, name: $0.name ?? $0.stopId, lat: $0.lat, lon: $0.lon) })
            }
            route = RouteDetail(line: line, title: r.desc ?? r.longName ?? r.shortName ?? r.routeId, flags: marks, directions: directions)
            directionId = directions.first?.directionId ?? 0
            state = .idle
        } catch {
            state = .failure(error)
        }
    }
}

/// Line pages built ahead of the tap: the list prefetches a line as soon as a finger lands on it,
/// so the page usually opens with its data already there.
@MainActor
enum RouteCache {
    private static var models: [String: RouteDetailsViewModel] = [:]

    static func model(for id: String) -> RouteDetailsViewModel {
        if let m = models[id] { return m }
        if models.count > 60 { models.removeAll() }
        let m = RouteDetailsViewModel(routeId: id)
        models[id] = m
        return m
    }

    static func prefetch(_ id: String) {
        let m = model(for: id)
        guard m.route == nil, !m.state.isLoading else { return }
        Task { await m.load() }
    }
}
