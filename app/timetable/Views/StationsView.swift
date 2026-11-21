//
//  StationsView.swift
//  timetable
//
//  Search stop groups, or browse the ones nearby with their platforms under them.
//

import SwiftUI

struct StationsView: View {
    @Environment(AppSettings.self) private var settings
    @State private var model = StationsViewModel()
    @State private var searchText = ""

    var body: some View {
        List {
            if searchText.trimmingCharacters(in: .whitespaces).isEmpty {
                nearbySections
            } else {
                searchSection
            }
        }
        .navigationTitle("Stops")
        .searchable(text: $searchText, prompt: "Search stops")
        .navigationDestination(for: StationTarget.self) { StationDetailView(target: $0) }
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
            ForEach(model.results) { station in
                NavigationLink(value: StationTarget(stationId: station.stationId)) {
                    StationRow(station: station, distance: nil)
                }
            }
        }
    }

    @ViewBuilder
    private var nearbySections: some View {
        if !model.locationAvailable {
            Section {
                VStack(spacing: 8) {
                    Label("Location is off", systemImage: "location.slash").font(.headline)
                    Text("Allow location access in Settings to see stops near you, or search above.")
                        .font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    Button("Try again") { Task { await model.loadNearby(radius: settings.nearbyRadius) } }
                        .buttonStyle(.bordered)
                }
                .frame(maxWidth: .infinity)
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
        // The group (opens its lines board) with its platforms under it
        ForEach(model.nearby) { item in
            Section {
                NavigationLink(value: StationTarget(stationId: item.station.stationId)) {
                    StationRow(station: item.station, distance: item.distance)
                }
                ForEach(item.station.sortedPlatforms) { platform in
                    NavigationLink(value: StationTarget(stationId: item.station.stationId, from: platform.stopId)) {
                        PlatformRow(platform: platform)
                    }
                    .padding(.leading, 12)
                }
            }
        }
    }
}

struct StationRow: View {
    let station: Station
    let distance: Double?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(station.name).font(.headline).lineLimit(2)
                Spacer()
                if let distance {
                    Text(distance < 1000 ? "\(Int(distance.rounded())) m" : String(format: "%.1f km", distance / 1000))
                        .font(.subheadline).foregroundStyle(.secondary)
                }
            }
            LineBadges(lines: station.routes)
        }
        .padding(.vertical, 2)
    }
}
