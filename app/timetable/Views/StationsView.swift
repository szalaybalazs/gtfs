//
//  StationsView.swift
//  timetable
//
//  Search stop groups, or browse the ones nearby with their platforms under them.
//

import SwiftUI
import Flow

struct StationsView: View {
    @Environment(AppSettings.self) private var settings
    @State private var model = StationsViewModel()
    @State private var searchText = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if searchText.trimmingCharacters(in: .whitespaces).isEmpty {
                    nearbySections
                } else {
                    searchSection
                }
            }
            .padding(16)
        }
        .background(Theme.canvas)
        .navigationTitle("Stops")
        .searchable(text: $searchText, prompt: "Search stops")
        .navigationDestination(for: StationTarget.self) { StationDetailView(target: $0) }
        .navigationDestination(for: TripTarget.self) { TripView(target: $0) }
        .task(id: searchText) {
            // Debounce typing; a new keystroke cancels this one
            try? await Task.sleep(nanoseconds: 250_000_000)
            guard !Task.isCancelled else { return }
            await model.search(searchText)
        }
        .task(id: settings.nearbyRadius) { await model.loadNearby(radius: settings.nearbyRadius) }
        .refreshable { await model.loadNearby(radius: settings.nearbyRadius) }
    }

    @ViewBuilder
    private var searchSection: some View {
        if let message = model.searchState.errorMessage {
            ErrorView(message: message) { await model.search(searchText) }
        } else if model.results.isEmpty && !model.searchState.isLoading {
            ContentUnavailableView.search(text: searchText)
        } else {
            Card {
                RowList(data: model.results, id: \.stationId) { StationRow(station: $0, distance: nil) }
            }
        }
    }

    @ViewBuilder
    private var nearbySections: some View {
        if !model.locationAvailable {
            Card {
                VStack(spacing: 8) {
                    Label("Location is off", systemImage: "location.slash").font(.headline)
                    Text("Allow location access in Settings to see stops near you, or search above.")
                        .font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    Button("Try again") { Task { await model.loadNearby(radius: settings.nearbyRadius) } }
                        .buttonStyle(.bordered)
                }
                .padding(16)
            }
        } else if let message = model.nearbyState.errorMessage {
            ErrorView(message: message) { await model.loadNearby(radius: settings.nearbyRadius) }
        } else if model.nearby.isEmpty {
            if model.nearbyState.isLoading {
                ProgressView().frame(maxWidth: .infinity)
            } else {
                Text("No stops within \(settings.nearbyRadius) m.").foregroundStyle(.secondary)
            }
        }
        if !model.nearby.isEmpty {
            // The group (opens its departures) with its platforms under it
            Card {
                RowList(data: model.nearby, id: \.station.stationId) { StationRow(station: $0.station, distance: $0.distance) }
            }
        }
    }
}

private func formatDistance(_ m: Double) -> String {
    m < 1000 ? "\(Int(m.rounded())) m" : String(format: "%.1f km", m / 1000)
}

/// A stop group in a list: the group itself (opens the whole group's departures), with its platforms in a
/// tinted block under it (each "towards ..." with its lines; opens that platform). Web: StationRow.tsx.
struct StationRow: View {
    let station: Station
    let distance: Double?

    var body: some View {
        let platforms = station.sortedPlatforms
        let several = platforms.count > 1
        if !platforms.isEmpty {
            VStack(spacing: 0) {
                NavigationLink(value: StationTarget(stationId: station.stationId)) {
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 0) {
                            (Text(station.name).font(.system(size: 17, weight: .semibold))
                             + Text(distance.map { "  " + formatDistance($0) } ?? "").font(.system(size: 17)).foregroundColor(Theme.secondary))
                                .lineLimit(1)
                            if several {
                                // The lines are listed once, per platform below; the group shows which kinds run here
                                HStack(spacing: 6) {
                                    ForEach(LineCategory.allCases.filter { c in station.routes.contains { LineCategory.of($0) == c } }, id: \.self) { c in
                                        Image(systemName: c.symbol).font(.system(size: 15)).foregroundStyle(c.tint).frame(width: 20, height: 20)
                                    }
                                    Text("\(platforms.count) platforms · \(station.routes.count) lines")
                                        .font(.system(size: 13)).foregroundStyle(Theme.secondary).padding(.leading, 2)
                                }
                                .padding(.top, 4)
                            } else {
                                HFlow(itemSpacing: 4, rowSpacing: 4) {
                                    ForEach(station.routes.sorted(by: lineOrder), id: \.routeId) { LineBadge(line: $0) }
                                }
                                .padding(.top, 6)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        Chevron(double: several)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                }
                .buttonStyle(RowButtonStyle())
                if several {
                    // The tint groups the platforms: no indent or tree lines
                    VStack(spacing: 0) {
                        ForEach(Array(platforms.enumerated()), id: \.element.stopId) { i, platform in
                            if i > 0 { Rectangle().fill(Theme.separator).frame(height: 1 / UIScreen.main.scale) }
                            NavigationLink(value: StationTarget(stationId: station.stationId, from: platform.stopId)) {
                                HStack(spacing: 12) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(platform.headsigns.isEmpty ? "Terminus · arrivals only" : "towards " + platform.headsigns.joined(separator: " / "))
                                            .font(.system(size: 15, weight: .medium)).lineLimit(1)
                                        HFlow(itemSpacing: 4, rowSpacing: 4) {
                                            ForEach(platform.routes.sorted(by: lineOrder), id: \.routeId) { LineBadge(line: $0) }
                                        }
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    Chevron()
                                }
                                .padding(.horizontal, 8)
                                .padding(.vertical, 10)
                            }
                            .buttonStyle(RowButtonStyle())
                        }
                    }
                    .background(Theme.fill.opacity(0.6))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .padding(.horizontal, 8)
                    .padding(.bottom, 8)
                }
            }
        }
    }
}
