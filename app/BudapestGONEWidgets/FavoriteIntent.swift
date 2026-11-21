//
//  FavoriteIntent.swift
//  BudapestGONEWidgets
//
//  The widget's configuration: one of the saved favourites, or none picked = all of them.
//

import AppIntents
import WidgetKit

struct FavoriteEntity: AppEntity {
    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Favourite")
    static let defaultQuery = FavoriteQuery()

    var id: String
    var title: String
    var subtitle: String?

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: LocalizedStringResource(stringLiteral: title),
                              subtitle: subtitle.map { LocalizedStringResource(stringLiteral: $0) })
    }

    init(_ f: Favorite) {
        id = f.id
        title = f.widgetTitle
        subtitle = f.widgetSubtitle
    }
}

struct FavoriteQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [FavoriteEntity] {
        FavoritesStore.widgetFavorites().filter { identifiers.contains($0.id) }.map(FavoriteEntity.init)
    }

    func suggestedEntities() async throws -> [FavoriteEntity] {
        FavoritesStore.widgetFavorites().map(FavoriteEntity.init)
    }
}

/// How the departures are laid out.
enum DepartureGrouping: String, AppEnum {
    case byLine, byRoute, byTime

    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Group by")
    static let caseDisplayRepresentations: [DepartureGrouping: DisplayRepresentation] = [
        .byLine: DisplayRepresentation(title: "Line", subtitle: "One row per line, its next times"),
        .byRoute: DisplayRepresentation(title: "Route", subtitle: "One row per line and direction"),
        .byTime: DisplayRepresentation(title: "Time", subtitle: "One list in time order"),
    ]
}

/// How a departure's time is written.
enum DepartureTimeStyle: String, AppEnum {
    case countdown, clock, both

    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Times as")
    static let caseDisplayRepresentations: [DepartureTimeStyle: DisplayRepresentation] = [
        .countdown: DisplayRepresentation(title: "Minutes", subtitle: "5'"),
        .clock: DisplayRepresentation(title: "Clock time", subtitle: "17:23"),
        .both: DisplayRepresentation(title: "Both", subtitle: "5' 17:23"),
    ]
}

struct SelectFavoriteIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Favourite"
    static let description = IntentDescription("Pick a favourite, or leave it empty to show all of them.")

    @Parameter(title: "Favourite")
    var favorite: FavoriteEntity?

    @Parameter(title: "Group by", default: .byLine)
    var grouping: DepartureGrouping

    @Parameter(title: "Times as", default: .countdown)
    var timeStyle: DepartureTimeStyle

    static var parameterSummary: some ParameterSummary {
        Summary("Show \(\.$favorite)") {
            \.$grouping
            \.$timeStyle
        }
    }
}

extension FavoritesStore {
    /// Favourites that have departures to show (a bare line has none).
    nonisolated static func widgetFavorites() -> [Favorite] {
        read().filter { !$0.departureStopIds.isEmpty }
    }
}

extension Favorite {
    var widgetTitle: String {
        switch kind {
        case .lineStop: return [route?.shortName, stopName].compactMap { $0 }.joined(separator: " · ")
        default: return name ?? stopName ?? ""
        }
    }

    var widgetSubtitle: String? {
        let h = kind == .lineStop ? headsign.map { [$0] } ?? [] : headsigns ?? []
        return h.isEmpty ? nil : tr("towards \(h.joined(separator: " / "))")
    }
}
