//
//  AppSettings.swift
//  timetable
//
//  User settings kept in UserDefaults (web/src/lib/shownMarks.ts, departuresView.ts, nearbyRadius.ts).
//

import Foundation
import Observation
import SwiftUI
import WidgetKit

/// A marker that can be shown or hidden on departures and lines.
enum Marker: String, CaseIterable, Identifiable {
    case frontDoor, replacement, lowFloor, demand, circular, bikes
    var id: String { rawValue }

    var title: String {
        switch self {
        case .frontDoor: return tr("Front-door boarding")
        case .replacement: return tr("Replacement bus")
        case .lowFloor: return tr("Accessible")
        case .demand: return tr("Demand-responsive (stops on request)")
        case .circular: return tr("Circular line")
        case .bikes: return tr("Bikes allowed")
        }
    }

    var symbol: String {
        switch self {
        case .frontDoor: return "1.circle"
        case .replacement: return "p.circle"
        case .lowFloor: return "figure.roll.circle"
        case .demand: return "phone.circle"
        case .circular: return "arrow.triangle.2.circlepath.circle"
        case .bikes: return "bicycle.circle"
        }
    }
}

enum DeparturesView: String, CaseIterable, Identifiable {
    case lines, timeline
    var id: String { rawValue }
    var title: String { self == .lines ? tr("Lines view") : tr("Timeline") }
    var symbol: String { self == .lines ? "square.grid.2x2" : "list.bullet" }
}

enum AppAppearance: String, CaseIterable, Identifiable {
    case auto, light, dark
    var id: String { rawValue }
    var title: String { self == .auto ? tr("System") : self == .light ? tr("Light") : tr("Dark") }
    var scheme: ColorScheme? { self == .light ? .light : self == .dark ? .dark : nil }
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

    var language: AppLanguage {
        didSet {
            defaults.set(language.rawValue, forKey: L10n.key)
            // The widgets follow the app's language choice through the App Group
            SharedDefaults.suite.set(language.rawValue, forKey: L10n.key)
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    var appearance: AppAppearance {
        didSet { defaults.set(appearance.rawValue, forKey: "appearance") }
    }

    var nearbyRadius: Int {
        didSet { defaults.set(nearbyRadius, forKey: "nearby-radius") }
    }
    /// Countdowns and "Updated Ns ago" roll their digits when they change (on by default; off for a plain swap).
    var animateNumbers: Bool {
        didSet { defaults.set(animateNumbers, forKey: "animate-numbers") }
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        hiddenMarkers = Set((defaults.stringArray(forKey: "hidden-marks") ?? []).compactMap(Marker.init(rawValue:)))
        departuresView = defaults.string(forKey: "departures-view").flatMap(DeparturesView.init(rawValue:)) ?? .lines
        language = defaults.string(forKey: L10n.key).flatMap(AppLanguage.init(rawValue:)) ?? .auto
        appearance = defaults.string(forKey: "appearance").flatMap(AppAppearance.init(rawValue:)) ?? .auto
        let radius = defaults.integer(forKey: "nearby-radius")
        nearbyRadius = Self.radii.contains(radius) ? radius : 1000
        animateNumbers = defaults.object(forKey: "animate-numbers") as? Bool ?? true
        // Older versions kept the language only in the app's own defaults: copy it for the widgets
        if SharedDefaults.suite.string(forKey: L10n.key) == nil { SharedDefaults.suite.set(language.rawValue, forKey: L10n.key) }
    }

    func shows(_ marker: Marker) -> Bool { !hiddenMarkers.contains(marker) }

    func setShown(_ marker: Marker, _ shown: Bool) {
        if shown { hiddenMarkers.remove(marker) } else { hiddenMarkers.insert(marker) }
    }
}
