import Foundation
import TimetableAPI
@testable import timetable

/// Returns canned JSON per query, or throws. Records every query it receives.
final class MockGraphQLClient: GraphQLClient, @unchecked Sendable {
    var responses: [(any GraphQLQuery) throws -> [String: Any]] = []
    private(set) var queries: [any GraphQLQuery] = []

    func fetch<Query: GraphQLQuery>(_ query: Query) async throws -> Query.Data {
        queries.append(query)
        guard !responses.isEmpty else { throw APIError.emptyResponse }
        let json = try responses.removeFirst()(query)
        return try Query.Data(data: json as JSONObject)
    }
}

struct TestError: LocalizedError {
    var errorDescription: String? { "offline" }
}

enum Fixtures {
    static func routesPage(page: Int, pages: Int, ids: [String]) -> [String: Any] {
        ["routes": [
            "__typename": "RoutePaginated",
            "limit": 50, "page": page, "pages": pages,
            "data": ids.map { id -> [String: Any] in
                ["__typename": "Route", "routeId": id, "shortName": id, "longName": NSNull(),
                 "desc": NSNull(), "color": "FFD800", "textColor": "000000", "stops": []] as [String: Any]
            },
        ]]
    }

    static func route(closestStopId: String?) -> [String: Any] {
        func stop(_ id: String) -> [String: Any] { ["__typename": "Stop", "stopId": id, "name": "Stop \(id)"] }
        return ["route": [
            "__typename": "Route",
            "routeId": "R1",
            "closestStop": closestStopId.map { ["__typename": "Stop", "stopId": $0, "code": NSNull(), "name": "Stop \($0)"] as Any } ?? NSNull(),
            "directions": [
                ["__typename": "Direction", "headsign": "Out", "directionId": 0, "stops": [stop("A"), stop("B")]],
                ["__typename": "Direction", "headsign": "Back", "directionId": 1, "stops": [stop("C"), stop("D")]],
            ],
        ] as [String: Any]]
    }
}
