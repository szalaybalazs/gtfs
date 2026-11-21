//
//  SharedDefaults.swift
//  timetable
//
//  UserDefaults in the App Group shared by the app and its widgets: favourites and the language choice live there.
//

import Foundation

enum SharedDefaults {
    /// "group.<app bundle id>"; the widget's bundle id is the app's plus ".widgets".
    static let groupId: String = {
        var id = Bundle.main.bundleIdentifier ?? "com.actegon.budapestgone.app"
        if id.hasSuffix(".widgets") { id.removeLast(".widgets".count) }
        return "group." + id
    }()

    /// The shared store (the app's own defaults if the group isn't available, e.g. an unsigned build).
    static let suite: UserDefaults = UserDefaults(suiteName: groupId) ?? .standard

    /// URL scheme the widgets use to open the app.
    static let urlScheme = "budapestgone"
}
