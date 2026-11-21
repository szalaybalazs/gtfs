//
//  StationsView.swift
//  timetable
//
//  Search stop groups, or browse the ones nearby with their platforms under them.
//

import SwiftUI
import Flow

/// Compact one-line location control: asks for permission or refreshes the position (web: NearbyList).
struct LocationBar: View {
    let model: StationsViewModel
    let radius: Int

    var body: some View {
        if !model.locationAvailable { bar }
    }

    private var bar: some View {
        Button { Task { await model.loadNearby(radius: radius) } } label: {
            HStack(spacing: 8) {
                Image(systemName: "location.slash")
                    .foregroundStyle(Theme.accent)
                Text(model.nearbyState.isLoading ? tr("Finding your location…") : tr("Location off"))
                    .foregroundStyle(Theme.secondary)
                Spacer()
                Text(tr("Use my location")).fontWeight(.medium).foregroundStyle(Theme.accent)
            }
            .font(.system(size: 15))
            .padding(.horizontal, 16).padding(.vertical, 10)
        }
        .buttonStyle(RowButtonStyle())
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

struct StationsView: View {
    @Environment(AppSettings.self) private var settings
    @State private var model = StationsViewModel()
    @State private var searchText = ""

    private var searching: Bool { !searchText.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if !searching {
                    LocationBar(model: model, radius: settings.nearbyRadius)
                }
                if searching || !model.locationAvailable {
                    // Search results, or every stop group when there is no location: always something to browse
                    allSection
                } else {
                    nearbySection
                }
            }
            .padding(16)
        }
        .background(Theme.canvas)
        .navigationTitle("Stops")
        .searchable(text: $searchText, prompt: "Search stops")
        .transitDestinations()
        .task(id: "\(searchText)|\(model.locationAvailable)") {
            guard searching || !model.locationAvailable else { return }
            // Debounce typing; a new keystroke cancels this one
            if searching { try? await Task.sleep(nanoseconds: 250_000_000) }
            guard !Task.isCancelled else { return }
            await model.search(searchText)
        }
        .task(id: settings.nearbyRadius) { await model.loadNearby(radius: settings.nearbyRadius) }
        .refreshable { await model.loadNearby(radius: settings.nearbyRadius) }
    }

    @ViewBuilder
    private var allSection: some View {
        if let message = model.searchState.errorMessage {
            ErrorView(message: message) { await model.search(searchText) }
        } else if model.results.isEmpty {
            if model.searchState.isLoading { ProgressView().frame(maxWidth: .infinity).padding(.top, 24) }
            else if searching { ContentUnavailableView.search(text: searchText) }
        } else {
            Card {
                RowList(data: model.results, id: \.stationId) { station in
                    StationRow(station: station, distance: nil)
                        .onAppear { if station.stationId == model.results.last?.stationId { Task { await model.loadMore(searchText) } } }
                }
            }
            if model.hasMore { ProgressView() }
        }
    }

    @ViewBuilder
    private var nearbySection: some View {
        if let message = model.nearbyState.errorMessage {
            ErrorView(message: message) { await model.loadNearby(radius: settings.nearbyRadius) }
        } else if model.nearby.isEmpty {
            if model.nearbyState.isLoading { ProgressView().frame(maxWidth: .infinity) }
            else { Text(tr("No stops within \(settings.nearbyRadius) m.")).foregroundStyle(Theme.secondary) }
        } else {
            // The group (opens its departures) with its platforms under it
            Card {
                RowList(data: model.nearby, id: \.station.stationId) { StationRow(station: $0.station, distance: $0.distance) }
            }
        }
    }
}

extension View {
    /// Where stop and trip links lead, for any navigation stack.
    func transitDestinations() -> some View {
        navigationDestination(for: StationTarget.self) { StationDetailView(target: $0) }
            .navigationDestination(for: TripTarget.self) { TripView(target: $0) }
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
        // Arrival-only platforms (lines but no directions) are not listed here
        let platforms = station.sortedPlatforms.filter { !$0.isTerminus }
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
                                        ModeIcon(category: c)
                                    }
                                    Text(tr("\(platforms.count) platforms · \(station.routes.count) lines"))
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
                                        Text(platform.headsigns.isEmpty ? tr("Terminus · arrivals only") : tr("towards \(platform.headsigns.joined(separator: " / "))"))
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
