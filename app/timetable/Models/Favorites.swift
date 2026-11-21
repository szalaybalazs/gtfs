//
//  Favorites.swift
//  timetable
//
//  Favourites in UserDefaults, same JSON shape as the web app (web/src/lib/favorites.ts, key "favorites-v2").
//

import Foundation
import Observation

/// A route as the web stores it in favourites.
struct FavRoute: Codable, Hashable {
    var routeId: String
    var shortName: String?
    var color: String?
    var textColor: String?
    var type: String?

    init(_ line: LineRef) {
        routeId = line.routeId; shortName = line.shortName; color = line.color; textColor = line.textColor; type = line.type
    }

    var line: LineRef { LineRef(routeId: routeId, shortName: shortName, color: color, textColor: textColor, type: type) }
}

/// One favourite. `kind` is "line", "lineStop", "stop" or "lines"; the other fields depend on it
/// (all optional here, so anything the web wrote decodes).
struct Favorite: Codable, Hashable, Identifiable {
    enum Kind: String, Codable { case line, lineStop, stop, lines }

    var kind: Kind
    var id: String
    var route: FavRoute?
    var routes: [FavRoute]?
    var stopId: String?
    var stationId: String?
    var stopName: String?
    var name: String?
    var headsign: String?
    var headsigns: [String]?
    var stopIds: [String]?
    var from: String?

    /// The id the web derives from the content (so both apps agree on duplicates).
    static func makeId(_ f: Favorite) -> String {
        switch f.kind {
        case .line: return "line:\(f.route?.routeId ?? "")"
        case .lineStop: return "lineStop:\(f.route?.routeId ?? ""):\(f.stopId ?? "")"
        case .lines: return "lines:\((f.routes ?? []).map(\.routeId).sorted().joined(separator: ",")):\(f.from ?? f.stationId ?? "")"
        case .stop: return "stop:\(f.stopId ?? "")"
        }
    }

    static func line(_ r: LineRef) -> Favorite {
        var f = Favorite(kind: .line, id: "", route: FavRoute(r)); f.id = makeId(f); return f
    }

    static func lineStop(route: LineRef, stopId: String, stationId: String, stopName: String, headsign: String?) -> Favorite {
        var f = Favorite(kind: .lineStop, id: "", route: FavRoute(route), stopId: stopId, stationId: stationId, stopName: stopName, headsign: headsign)
        f.id = makeId(f); return f
    }

    static func stop(_ p: Platform, stationId: String) -> Favorite {
        var f = Favorite(kind: .stop, id: "", routes: p.routes.map(FavRoute.init), stopId: p.stopId, stationId: stationId, name: p.name ?? p.stopId, headsigns: p.headsigns)
        f.id = makeId(f); return f
    }

    static func lines(_ routes: [LineRef], stationId: String, stopIds: [String], from: String?, name: String, headsigns: [String]) -> Favorite {
        var f = Favorite(kind: .lines, id: "", routes: routes.map(FavRoute.init), stationId: stationId, name: name, headsigns: headsigns, stopIds: stopIds, from: from)
        f.id = makeId(f); return f
    }
}

@MainActor
@Observable
final class FavoritesStore {
    static let shared = FavoritesStore()
    private static let key = "favorites-v2"

    private let defaults: UserDefaults
    private(set) var favorites: [Favorite]

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        favorites = defaults.string(forKey: Self.key)
            .flatMap { $0.data(using: .utf8) }
            .flatMap { try? JSONDecoder().decode([Favorite].self, from: $0) } ?? []
    }

    private func save() {
        if let data = try? Self.encoder.encode(favorites), let text = String(data: data, encoding: .utf8) {
            defaults.set(text, forKey: Self.key)
        }
    }

    private static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.outputFormatting = [.withoutEscapingSlashes]
        return e
    }()

    func has(_ id: String) -> Bool { favorites.contains { $0.id == id } }

    func toggle(_ f: Favorite) {
        if has(f.id) { favorites.removeAll { $0.id == f.id } } else { favorites.append(f) }
        save()
    }

    func ofKind(_ kind: Favorite.Kind) -> [Favorite] { favorites.filter { $0.kind == kind } }

    /// All favourites as JSON, to move to another device or the web app.
    func exportJSON() -> String {
        struct Export: Encodable { let app = "budapestgone"; let version = 2; let favorites: [Favorite] }
        guard let data = try? Self.encoder.encode(Export(favorites: favorites)) else { return "" }
        return String(data: data, encoding: .utf8) ?? ""
    }

    /// Adds favourites from exported JSON (the object above, or a bare list); ones already here are skipped.
    /// Returns how many were added, or nil if the text isn't valid.
    func importJSON(_ text: String) -> Int? {
        guard let data = text.trimmingCharacters(in: .whitespacesAndNewlines).data(using: .utf8),
              let any = try? JSONSerialization.jsonObject(with: data) else { return nil }
        let list: [Any]
        if let array = any as? [Any] { list = array }
        else if let object = any as? [String: Any], let array = object["favorites"] as? [Any] { list = array }
        else { return nil }
        var valid: [Favorite] = []
        for item in list {
            guard let d = try? JSONSerialization.data(withJSONObject: item), let f = try? JSONDecoder().decode(Favorite.self, from: d) else { continue }
            valid.append(f)
        }
        if valid.isEmpty && !list.isEmpty { return nil }
        var known = Set(favorites.map(\.id))
        let added = valid.filter { known.insert($0.id).inserted }
        if !added.isEmpty { favorites += added; save() }
        return added.count
    }
}
