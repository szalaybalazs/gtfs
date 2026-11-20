//
//  TimetableViewModel.swift
//  timetable
//

import Foundation
import Observation
import TimetableAPI

@MainActor
@Observable
final class TimetableViewModel {
    private(set) var entries: [TimetableQuery.Data.Timetable] = []
    private(set) var state: LoadState = .idle

    private let client: GraphQLClient

    init(client: GraphQLClient = Network.shared) {
        self.client = client
    }

    func load(routeId: TimetableAPI.ID, stopId: TimetableAPI.ID) async {
        state = .loading
        do {
            let data = try await client.fetch(TimetableQuery(stopId: stopId, routeId: routeId, range: .null))
            // A newer request (stop changed) may have started meanwhile; drop stale results.
            guard !Task.isCancelled else { return }
            entries = data.timetable
            state = .idle
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled else { return }
            entries = []
            state = .failure(error)
        }
    }
}
