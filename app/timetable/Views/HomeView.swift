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
    @State private var reorderKey: String?
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
                    section("Lines from stops", "fromStops", fromStops)
                }
                let stops = store.ofKind(.stop)
                if !stops.isEmpty { section("Stops", "stops", stops) }
                nearby
            }
            .padding(16)
        }
        .background(Theme.canvas)
        .scrollsToTopOnReselect(tab: 0)
        .navigationTitle("Home")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    if store.favorites.count > 1 {
                        NavigationLink { FavoritesEditView() } label: { Label("Edit favourites", systemImage: "arrow.up.arrow.down") }
                    }
                    NavigationLink { SettingsView() } label: { Label("Settings", systemImage: "gearshape") }
                } label: { Image(systemName: "ellipsis.circle") }
                    .accessibilityLabel("Menu")
            }
        }
        .transitDestinations()
        .task(id: settings.nearbyRadius) { await model.loadNearby(radius: settings.nearbyRadius) }
        .refreshable { await model.loadNearby(radius: settings.nearbyRadius) }
    }

    /// Which section is in reorder mode (only one at a time).
    private func section(_ title: LocalizedStringKey, _ key: String, _ items: [Favorite]) -> some View {
        let reordering = reorderKey == key
        return VStack(spacing: 0) {
            HStack {
                SectionTitle(title)
                if reordering {
                    Button(tr("Done")) { reorderKey = nil }.font(.system(size: 17, weight: .semibold))
                }
            }
            Card {
                RowList(data: items, id: \.id) { fav in
                    HStack(spacing: 10) {
                        FavoriteCard(fav: fav, link: !reordering)
                        if reordering {
                            // The handle on the right: drag it up or down, within this section only
                            Image(systemName: "line.3.horizontal")
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundStyle(Theme.secondary)
                                .padding(.trailing, 4)
                                .contentShape(Rectangle())
                                .draggable(fav.id)
                        }
                    }
                    // Long press: the system menu, with the background blurred; "Reorder" turns on the handles
                    .contextMenu {
                        if !reordering {
                            Button { reorderKey = key } label: { Label(tr("Reorder"), systemImage: "arrow.up.arrow.down") }
                        }
                    }
                    .dropDestination(for: String.self) { ids, _ in
                        guard reordering, let dragged = ids.first, items.contains(where: { $0.id == dragged }) else { return false }
                        FavoritesStore.shared.move(id: dragged, before: fav.id)
                        return true
                    }
                }
            }
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
