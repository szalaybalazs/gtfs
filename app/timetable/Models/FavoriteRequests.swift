//
//  FavoriteRequests.swift
//  timetable
//
//  What a favourite asks the server for and where it opens; used by the favourite cards and the widgets.
//

import Foundation

extension Favorite {
    var departureStopIds: [String] {
        switch kind {
        case .lines: return stopIds ?? []
        default: return stopId.map { [$0] } ?? []
        }
    }

    var departureRouteIds: [String]? {
        switch kind {
        case .lineStop: return route.map { [$0.routeId] }
        case .lines: return (routes ?? []).map(\.routeId)
        default: return nil
        }
    }

    /// `longer` asks for more departures (a widget that stays on screen for a while).
    func makeRequest(longer: Bool = false) -> DeparturesRequest {
        // A bigger favourite lists more departures, so it asks for more
        let base = kind == .stop ? 40 : kind == .lines ? 30 : longer ? 16 : 8
        return DeparturesRequest(stopIds: departureStopIds, routeIds: departureRouteIds, limit: max(base, (size?.rows ?? 1) * 8))
    }

    var departuresRequest: DeparturesRequest { makeRequest() }

    var stationTarget: StationTarget {
        switch kind {
        case .lines: return StationTarget(stationId: stationId ?? "", from: from, lines: departureRouteIds ?? [])
        case .lineStop: return StationTarget(stationId: stationId ?? "", from: stopId, lines: departureRouteIds ?? [])
        default: return StationTarget(stationId: stationId ?? "", from: stopId)
        }
    }
}
