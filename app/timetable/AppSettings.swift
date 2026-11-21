//
//  AppSettings.swift
//  timetable
//
//  User settings kept in UserDefaults (web/src/lib/shownMarks.ts, departuresView.ts, nearbyRadius.ts).
//

import Foundation
import Observation

/// A marker that can be shown or hidden on departures and lines.
enum Marker: String, CaseIterable, Identifiable {
    case frontDoor, replacement, lowFloor, demand, circular, bikes
    var id: String { rawValue }

    var title: String {
        switch self {
        case .frontDoor: return "Front-door boarding"
        case .replacement: return "Replacement bus"
        case .lowFloor: return "All vehicles low-floor"
        case .demand: return "Demand-responsive (stops on request)"
        case .circular: return "Circular line"
        case .bikes: return "Bikes allowed"
        }
    }

    var symbol: String {
        switch self {
        case .frontDoor: return "1.circle"
        case .replacement: return "p.circle"
        case .lowFloor: return "figure.roll"
        case .demand: return "phone.circle"
        case .circular: return "arrow.triangle.2.circlepath.circle"
        case .bikes: return "bicycle"
        }
    }
}

enum DeparturesView: String, CaseIterable, Identifiable {
    case lines, timeline
    var id: String { rawValue }
    var title: String { self == .lines ? "Lines" : "Timeline" }
    var symbol: String { self == .lines ? "square.grid.2x2" : "list.bullet" }
}

@MainActor
@Observable
final class AppSettings {
    static let shared = AppSettings()
    static let radii = [500, 1000, 2000, 5000]

    private let defaults: UserDefaults

    /// Stored as the hidden ones, so a marker added later shows by default.
    private(set) var hiddenMarkers: Set<Marker> {
        didSet { defaults.set(hiddenMarkers.map(\.rawValue).sorted(), forKey: "hidden-marks") }
    }

    var departuresView: DeparturesView {
        didSet { defaults.set(departuresView.rawValue, forKey: "departures-view") }
    }

    var nearbyRadius: Int {
        didSet { defaults.set(nearbyRadius, forKey: "nearby-radius") }
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        hiddenMarkers = Set((defaults.stringArray(forKey: "hidden-marks") ?? []).compactMap(Marker.init(rawValue:)))
        departuresView = defaults.string(forKey: "departures-view").flatMap(DeparturesView.init(rawValue:)) ?? .lines
        let radius = defaults.integer(forKey: "nearby-radius")
        nearbyRadius = Self.radii.contains(radius) ? radius : 1000
    }

    func shows(_ marker: Marker) -> Bool { !hiddenMarkers.contains(marker) }

    func setShown(_ marker: Marker, _ shown: Bool) {
        if shown { hiddenMarkers.remove(marker) } else { hiddenMarkers.insert(marker) }
    }
}
