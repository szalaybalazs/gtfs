//
//  StationViewModel.swift
//  timetable
//

import Foundation
import Observation
import TimetableAPI

@MainActor
@Observable
final class StationViewModel {
    private(set) var station: Station?
    private(set) var state: LoadState = .idle

    private let client: GraphQLClient

    init(client: GraphQLClient = Network.shared) {
        self.client = client
    }

    func load(id: String) async {
        state = .loading
        do {
            let data = try await client.fetch(StationQuery(id: id))
            guard !Task.isCancelled else { return }
            guard let station = data.station else { state = .failed(tr("Stop not found.")); return }
            self.station = Station(station)
            state = .idle
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled else { return }
            state = .failure(error)
        }
    }
}
