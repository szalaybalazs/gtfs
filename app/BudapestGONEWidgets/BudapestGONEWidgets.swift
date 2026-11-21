//
//  BudapestGONEWidgets.swift
//  BudapestGONEWidgets
//
//  Home-screen and lock-screen widgets with the next departures of the user's favourites.
//

import SwiftUI
import WidgetKit

@main
struct BudapestGONEWidgets: WidgetBundle {
    var body: some Widget {
        FavoritesWidget()
    }
}

struct FavoritesWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "FavoriteDepartures", intent: SelectFavoriteIntent.self, provider: FavoritesProvider()) { entry in
            FavoritesWidgetView(entry: entry)
        }
        .configurationDisplayName(tr("Departures"))
        .description(tr("Next departures of your favourites."))
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryInline])
    }
}
