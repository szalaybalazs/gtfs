//
//  DeepLink.swift
//  timetable
//
//  budapestgone://station?id=…&from=…&lines=a,b: how the widgets open a stop page in the app.
//

import Foundation

extension StationTarget {
    var url: URL {
        var c = URLComponents()
        c.scheme = SharedDefaults.urlScheme
        c.host = "station"
        c.queryItems = [URLQueryItem(name: "id", value: stationId)]
            + (from.map { [URLQueryItem(name: "from", value: $0)] } ?? [])
            + (lines.isEmpty ? [] : [URLQueryItem(name: "lines", value: lines.joined(separator: ","))])
        return c.url ?? URL(string: "\(SharedDefaults.urlScheme)://")!
    }

    init?(url: URL) {
        guard url.scheme == SharedDefaults.urlScheme, url.host == "station",
              let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems,
              let id = items.first(where: { $0.name == "id" })?.value, !id.isEmpty else { return nil }
        self.init(
            stationId: id,
            from: items.first(where: { $0.name == "from" })?.value,
            lines: items.first(where: { $0.name == "lines" })?.value?.split(separator: ",").map(String.init) ?? [])
    }
}
