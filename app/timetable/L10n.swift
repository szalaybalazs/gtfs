//
//  L10n.swift
//  timetable
//
//  Language choice (System / Magyar / English) and lookup of strings that are not SwiftUI literals.
//  Strings live in Localizable.xcstrings (en = development language, hu from web/src/lib/i18n.ts).
//

import Foundation

enum AppLanguage: String, CaseIterable, Identifiable {
    case auto, hu, en
    var id: String { rawValue }
    var title: String {
        switch self {
        case .auto: return tr("System")
        case .hu: return "Magyar"
        case .en: return "English"
        }
    }
}

enum L10n {
    static let key = "language"

    static var language: AppLanguage {
        UserDefaults.standard.string(forKey: key).flatMap(AppLanguage.init(rawValue:)) ?? .auto
    }

    /// The language code in use: the picked one, else the device's if we have it, else English.
    static var code: String {
        if language != .auto { return language.rawValue }
        let preferred = Bundle.main.preferredLocalizations.first ?? "en"
        return preferred.hasPrefix("hu") ? "hu" : "en"
    }

    static var locale: Locale { Locale(identifier: code) }

    static var bundle: Bundle {
        Bundle.main.path(forResource: code, ofType: "lproj").flatMap(Bundle.init(path:)) ?? .main
    }
}

/// A localised string for non-literal uses (view models, computed text), in the chosen language.
func tr(_ key: String.LocalizationValue) -> String {
    String(localized: key, bundle: L10n.bundle, locale: L10n.locale)
}
