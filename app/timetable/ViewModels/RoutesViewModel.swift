//
//  RoutesViewModel.swift
//  timetable
//
//  Every line in one request (a few hundred small rows), like the web Routes page.
//

import Foundation
import Observation
import TimetableAPI

/// A line with its description, for the Routes list.
struct RouteInfo: Identifiable, Hashable {
    let line: LineRef
    let desc: String?
    let longName: String?
    var id: String { line.routeId }
}

@MainActor
@Observable
final class RoutesViewModel {
    private(set) var routes: [RouteInfo] = []
    private(set) var state: LoadState = .idle
    private(set) var loaded = false

    private let client: GraphQLClient

    init(client: GraphQLClient = Network.shared) {
        self.client = client
    }

    func load() async {
        state = .loading
        do {
            let data = try await client.fetch(RoutesQuery(limit: .some(1000), page: .some(0)))
            guard !Task.isCancelled else { return }
            routes = data.routes.data.map {
                RouteInfo(line: LineRef(routeId: $0.routeId, shortName: $0.shortName, color: $0.color, textColor: $0.textColor, type: $0.type?.rawValue),
                          desc: $0.desc, longName: $0.longName)
            }
            loaded = true
            state = .idle
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled else { return }
            state = .failure(error)
        }
    }
}
