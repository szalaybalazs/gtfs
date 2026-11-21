//
//  HomeView.swift
//  timetable
//
//  Favourites, then the nearby stops (web/src/pages/HomePage.tsx).
//

import SwiftUI
import Flow

struct HomeView: View {
    @Environment(AppSettings.self) private var settings
    @State private var store = FavoritesStore.shared
    @State private var model = StationsViewModel()

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                if store.favorites.isEmpty {
                    Text("Tap the star on a line or a stop to pin it here.")
                        .foregroundStyle(Theme.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(16)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                let lines = store.ofKind(.line)
                if !lines.isEmpty {
                    VStack(spacing: 0) {
                        SectionTitle("Lines")
                        HFlow(itemSpacing: 8, rowSpacing: 8) {
                            ForEach(lines) { f in
                                if let r = f.route {
                                    NavigationLink(value: RouteTarget(line: r.line)) {
                                        LineBadge(line: r.line)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                let fromStops = store.ofKind(.lineStop) + store.ofKind(.lines)
                if !fromStops.isEmpty {
                    section("Lines from stops", fromStops)
                }
                let stops = store.ofKind(.stop)
                if !stops.isEmpty { section("Stops", stops) }
                nearby
            }
            .padding(16)
        }
        .background(Theme.canvas)
        .scrollsToTopOnReselect(tab: 0)
        .navigationTitle("Home")
        .transitDestinations()
        .task(id: settings.nearbyRadius) { await model.loadNearby(radius: settings.nearbyRadius) }
        .refreshable { await model.loadNearby(radius: settings.nearbyRadius) }
    }

    private func section(_ title: LocalizedStringKey, _ items: [Favorite]) -> some View {
        VStack(spacing: 0) {
            SectionTitle(title)
            Card { RowList(data: items, id: \.id) { FavoriteCard(fav: $0) } }
        }
    }

    private var nearby: some View {
        VStack(spacing: 0) {
            SectionTitle("Nearby stops")
            VStack(spacing: 12) {
                LocationBar(model: model, radius: settings.nearbyRadius)
                if !model.locationAvailable {
                    Text("Tap Use my location to try again.").font(.system(size: 13)).foregroundStyle(Theme.secondary)
                } else if let message = model.nearbyState.errorMessage {
                    ErrorView(message: message) { await model.loadNearby(radius: settings.nearbyRadius) }
                } else if model.nearby.isEmpty {
                    if model.nearbyState.isLoading { Card { SkeletonDepartureRows(count: 3) } }
                    else { Text(tr("No stops within \(settings.nearbyRadius) m.")).foregroundStyle(Theme.secondary) }
                } else {
                    Card { RowList(data: Array(model.nearby.prefix(5)), id: \.station.stationId) { StationRow(station: $0.station, distance: $0.distance) } }
                }
            }
        }
    }
}
