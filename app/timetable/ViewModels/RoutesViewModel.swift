//
//  RoutesViewModel.swift
//  timetable
//
//  Created by Balázs Szalay on 2025. 02. 09..
//

import Foundation
import Observation
import TimetableAPI

@MainActor
@Observable
final class RoutesViewModel {
    typealias Route = RoutesQuery.Data.Routes.Datum

    private(set) var routes: [Route] = []
    private(set) var state: LoadState = .idle
    private var lastConnection: RoutesQuery.Data.Routes?

    private let client: GraphQLClient
    private let pageSize: Int

    init(client: GraphQLClient = Network.shared, pageSize: Int = 50) {
        self.client = client
        self.pageSize = pageSize
    }

    var hasMore: Bool {
        guard let connection = lastConnection else { return true }
        return (connection.pages ?? 0) > (connection.page ?? 0)
    }

    /// Loads the first page, or the next one if a page is already loaded.
    func loadNextPage() async {
        guard !state.isLoading, hasMore else { return }
        let page = lastConnection.map { ($0.page ?? 0) + 1 } ?? 0

        state = .loading
        do {
            let data = try await client.fetch(RoutesQuery(limit: .some(pageSize), page: .some(page)))
            lastConnection = data.routes
            routes.append(contentsOf: data.routes.data)
            state = .idle
        } catch {
            state = .failure(error)
        }
    }

    /// Clears everything and loads from page 0. Used by retry and pull-to-refresh.
    func reload() async {
        routes = []
        lastConnection = nil
        state = .idle
        await loadNextPage()
    }
}
