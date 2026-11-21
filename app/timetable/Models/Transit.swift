//
//  Transit.swift
//  timetable
//
//  Domain models and line ordering, mirroring web/src/lib/categories.ts.
//

import Foundation

/// A line as shown on a badge.
struct LineRef: Hashable {
    let routeId: String
    let shortName: String?
    let color: String?
    let textColor: String?
    /// GraphQL RouteType raw value: "TRAM", "SUBWAY", "BUS", ...
    let type: String?
}

/// Line categories in BKK's order.
enum LineCategory: Int, CaseIterable {
    case metro, tram, trolleybus, bus, night, boat, other

    static func of(_ line: LineRef) -> LineCategory {
        switch line.type {
        case "SUBWAY": return .metro
        case "TRAM": return .tram
        case "TROLLEYBUS": return .trolleybus
        case "BUS": return isNight(line) ? .night : .bus
        case "FERRY": return .boat
        default: return .other
        }
    }

    /// BKK night buses are the black ones.
    private static func isNight(_ line: LineRef) -> Bool {
        let c = (line.color ?? "").replacingOccurrences(of: "#", with: "").lowercased()
        return c == "000000" || c == "1e1e1e" || c == "231f20"
    }

    var title: String {
        switch self {
        case .metro: return "Metro"
        case .tram: return "Tram"
        case .trolleybus: return "Trolleybus"
        case .bus: return "Bus"
        case .night: return "Night"
        case .boat: return "Boat"
        case .other: return "Other"
        }
    }
}

private let hungarian = Locale(identifier: "hu")

/// Numeric-aware, Hungarian-locale comparison ("2" < "10").
func compareText(_ a: String?, _ b: String?) -> ComparisonResult {
    (a ?? "").compare(b ?? "", options: [.numeric], range: nil, locale: hungarian)
}

/// Metro first, then tram, trolleybus, bus, ...; by line number within each.
func lineOrder(_ a: LineRef, _ b: LineRef) -> Bool {
    let ra = LineCategory.of(a).rawValue, rb = LineCategory.of(b).rawValue
    if ra != rb { return ra < rb }
    return compareText(a.shortName, b.shortName) == .orderedAscending
}

struct Platform: Identifiable, Hashable {
    let stopId: String
    let name: String?
    let code: String?
    let lat: Double?
    let lon: Double?
    let headsigns: [String]
    let routes: [LineRef]
    var id: String { stopId }

    /// Nothing leaves here: a terminus platform.
    var isTerminus: Bool { headsigns.isEmpty && !routes.isEmpty }
}

/// Platforms ordered by the most important line stopping there.
func platformOrder(_ a: Platform, _ b: Platform) -> Bool {
    let x = a.routes.sorted(by: lineOrder).first
    let y = b.routes.sorted(by: lineOrder).first
    guard let x, let y else { return x != nil && y == nil }
    return lineOrder(x, y)
}

struct Station: Identifiable, Hashable {
    let stationId: String
    let name: String
    let lat: Double
    let lon: Double
    let routes: [LineRef]
    let platforms: [Platform]
    var id: String { stationId }

    /// Platforms something stops at, most important line first.
    var sortedPlatforms: [Platform] {
        platforms.filter { !$0.routes.isEmpty }.sorted(by: platformOrder)
    }
}

struct Departure: Identifiable, Hashable {
    let tripId: String
    let serviceDate: String
    let stopId: String
    let headsign: String?
    let arrival: Date
    let departure: Date
    let arrivalDelay: Int?
    let departureDelay: Int?
    let realtime: Bool
    let wheelchairAccessible: Bool
    let bikesAllowed: Bool
    let frontDoor: Bool
    let onRequest: Bool
    let terminates: Bool
    let route: LineRef?

    var id: String { "\(tripId)-\(serviceDate)-\(stopId)" }
    /// An arrival (trip ends here) counts down to when it arrives.
    var time: Date { terminates ? arrival : departure }
    var delay: Int? { departureDelay ?? arrivalDelay }
}

/// How a time relates to the schedule.
enum RealtimeStatus {
    case scheduled, onTime, early, late

    init(realtime: Bool, delay: Int?) {
        if !realtime { self = .scheduled }
        else if let delay, abs(delay) >= 60 { self = delay > 0 ? .late : .early }
        else { self = .onTime }
    }
}

/// Selected target for a station (group) or one of its platforms.
struct StationTarget: Hashable {
    let stationId: String
    var from: String? = nil
    var lines: [String] = []
    /// Count from this time instead of now.
    var reference: Date? = nil
    /// The trip you arrived on, marked "Your trip".
    var trip: String? = nil
}

/// A departure's trip. `from` is the stop you came from; the route and headsign are what the
/// tapped row already knew, shown while the trip loads.
struct TripTarget: Hashable {
    let tripId: String
    let serviceDate: String
    var from: String? = nil
    var route: LineRef? = nil
    var headsign: String? = nil
}

struct TripStop: Identifiable, Hashable {
    let stopSequence: Int
    let stopId: String
    let stationId: String?
    let name: String
    let arrival: Date
    let departure: Date
    let arrivalDelay: Int?
    let departureDelay: Int?
    let realtime: Bool
    var id: Int { stopSequence }
}

struct Trip: Hashable {
    let tripId: String
    let serviceDate: String
    let headsign: String?
    let route: LineRef?
    let stops: [TripStop]
}

enum TimeFormat {
    static let budapest = TimeZone(identifier: "Europe/Budapest")!

    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        f.timeZone = budapest
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    static func clock(_ date: Date) -> String { formatter.string(from: date) }
}
