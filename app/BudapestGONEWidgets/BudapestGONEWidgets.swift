//
//  BudapestGONEWidgets.swift
//  BudapestGONEWidgets
//
//  The medium widget: two favourites, each a skinny row of its next departures in time order.
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
        .supportedFamilies([.systemMedium])
    }
}
