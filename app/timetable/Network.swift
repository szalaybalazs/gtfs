//
//  Network.swift
//  timetable
//
//  Created by Balázs Szalay on 2025. 02. 08..
//

import Foundation
import Apollo
import TimetableAPI // re-exports ApolloAPI (GraphQLQuery)

/// Anything that can run a GraphQL query. View models depend on this,
/// so tests can swap in a mock instead of hitting the network.
protocol GraphQLClient: Sendable {
    func fetch<Query: GraphQLQuery>(_ query: Query) async throws -> Query.Data
}

enum APIError: LocalizedError {
    case graphQL([String])
    case emptyResponse

    var errorDescription: String? {
        switch self {
        case .graphQL(let messages): return messages.joined(separator: "\n")
        case .emptyResponse: return "The server returned no data."
        }
    }
}

final class Network: GraphQLClient, @unchecked Sendable {
    static let shared = Network()

    /// Set per build configuration via the `API_URL` build setting
    /// (Debug: local server, Release: gtfs.szalay.me), exposed through Info.plist.
    static let apiURL: URL = {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "APIURL") as? String,
              let url = URL(string: raw) else {
            fatalError("APIURL missing from Info.plist. Set the API_URL build setting.")
        }
        return url
    }()

    private let apollo: ApolloClient

    init(url: URL = Network.apiURL) {
        apollo = ApolloClient(url: url)
    }

    func fetch<Query: GraphQLQuery>(_ query: Query) async throws -> Query.Data {
        try await withCheckedThrowingContinuation { continuation in
            apollo.fetch(query: query, cachePolicy: .fetchIgnoringCacheData) { result in
                switch result {
                case .success(let response):
                    if let errors = response.errors, !errors.isEmpty {
                        continuation.resume(throwing: APIError.graphQL(errors.map { $0.message ?? "Unknown error" }))
                    } else if let data = response.data {
                        continuation.resume(returning: data)
                    } else {
                        continuation.resume(throwing: APIError.emptyResponse)
                    }
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
        }
    }
}
