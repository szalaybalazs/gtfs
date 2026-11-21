//
//  FavoriteViews.swift
//  timetable
//
//  Favourite cards and the add/remove sheet (web/src/components/FavoriteCards.tsx, FavoriteSheet.tsx).
//

import SwiftUI

/// How many upcoming departures a favourite row shows.
private let maxTimes = 8

/// Upcoming departures in time order, back-to-back ones of the same line merged: [1] 1', 5'  [2] 7'  [1] 10'.
private func runs(_ departures: [Departure], now: Date, only: Set<String>?) -> [(route: LineRef, times: [Departure])] {
    var out: [(route: LineRef, times: [Departure])] = []
    let upcoming = departures
        .filter { d in d.route != nil && (only == nil || only!.contains(d.route!.routeId)) && d.departure >= now.addingTimeInterval(-30) }
        .sorted { $0.departure < $1.departure }
        .prefix(maxTimes)
    for d in upcoming {
        if let last = out.last, last.route.routeId == d.route!.routeId { out[out.count - 1].times.append(d) }
        else { out.append((d.route!, [d])) }
    }
    return out
}

/// The one favourites layout, in time order. Side-scrollable when it doesn't fit; times coloured by realtime status.
private struct LineTimesRow: View {
    let departures: [Departure]
    let pending: Bool
    var only: Set<String>? = nil
    let fallback: [LineRef]

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let groups = runs(departures, now: context.date, only: only)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 16) {
                    if pending || groups.isEmpty {
                        ForEach(fallback, id: \.routeId) { r in
                            HStack(spacing: 6) {
                                LineBadge(line: r, fit: true)
                                Text(pending ? "…" : "–").font(.system(size: 15)).foregroundStyle(Theme.secondary)
                            }
                        }
                    } else {
                        ForEach(Array(groups.enumerated()), id: \.offset) { _, g in
                            HStack(spacing: 6) {
                                LineBadge(line: g.route, fit: true)
                                // Same countdowns as the Lines board: next one big, the rest small, live mark after the number
                                HStack(spacing: 12) {
                                    ForEach(Array(g.times.prefix(4).enumerated()), id: \.element.id) { i, d in
                                        BoardCountdown(departure: d, now: context.date, small: i > 0)
                                    }
                                }
                                .padding(.trailing, 8)
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
            }
            .padding(.horizontal, -16)
        }
    }
}

private struct FavoriteCardBody<Content: View>: View {
    let title: String
    let subtitle: String?
    let link: Bool
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(title).font(.system(size: 17, weight: .semibold)).lineLimit(1)
                    if let subtitle { Text(subtitle).font(.system(size: 13)).foregroundStyle(Theme.secondary).lineLimit(1) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if link { Chevron() }
            }
            content
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}

/// A favourite as it looks on Home: its next departures. `link` false inside the add sheet.
struct FavoriteCard: View {
    let fav: Favorite
    var link = true
    @State private var model = DeparturesViewModel()

    private var stopIds: [String] {
        switch fav.kind {
        case .lines: return fav.stopIds ?? []
        default: return fav.stopId.map { [$0] } ?? []
        }
    }
    private var routeIds: [String]? {
        switch fav.kind {
        case .lineStop: return fav.route.map { [$0.routeId] }
        case .lines: return (fav.routes ?? []).map(\.routeId)
        default: return nil
        }
    }
    private var request: DeparturesRequest {
        DeparturesRequest(stopIds: stopIds, routeIds: routeIds, limit: fav.kind == .stop ? 40 : fav.kind == .lines ? 30 : 8)
    }
    private var target: StationTarget {
        switch fav.kind {
        case .lines: return StationTarget(stationId: fav.stationId ?? "", from: fav.from, lines: routeIds ?? [])
        case .lineStop: return StationTarget(stationId: fav.stationId ?? "", from: fav.stopId, lines: routeIds ?? [])
        default: return StationTarget(stationId: fav.stationId ?? "", from: fav.stopId)
        }
    }

    var body: some View {
        switch fav.kind {
        case .line:
            if let route = fav.route {
                HStack { LineBadge(line: route.line); Spacer() }.padding(.horizontal, 16).padding(.vertical, 12)
            }
        default:
            let title = fav.kind == .lineStop ? (fav.stopName ?? "") : (fav.name ?? "")
            let towards: String? = {
                if fav.kind == .lineStop {
                    // Older ones have no direction saved: take it from the loaded departures of that line
                    var seen = Set<String>()
                    let derived = model.departures.compactMap(\.headsign).filter { seen.insert($0).inserted }.joined(separator: " / ")
                    let h = fav.headsign ?? derived
                    return h.isEmpty ? nil : "towards " + h
                }
                let hs = fav.headsigns ?? []
                return hs.isEmpty ? nil : "towards " + hs.joined(separator: " / ")
            }()
            let subtitle = towards ?? (fav.kind == .lines ? "\((fav.routes ?? []).count) lines" : nil)
            let fallback = fav.kind == .lineStop ? (fav.route.map { [$0.line] } ?? []) : (fav.routes ?? []).map(\.line)
            let card = FavoriteCardBody(title: title, subtitle: subtitle, link: link) {
                LineTimesRow(departures: model.departures, pending: !model.loaded, only: routeIds.map(Set.init), fallback: fallback)
            }
            Group {
                if link {
                    NavigationLink(value: target) { card }.buttonStyle(RowButtonStyle())
                } else {
                    card
                }
            }
            .task(id: request) { await model.run(request) }
        }
    }
}

/// Bottom sheet asking what to save: each option shows how it will look on Home, and toggles on tap.
struct FavoriteSheet: View {
    let options: [Favorite]
    @Environment(\.dismiss) private var dismiss
    @State private var store = FavoritesStore.shared

    private func title(_ k: Favorite.Kind) -> String {
        switch k {
        case .line: return "Just the line"
        case .lineStop: return "This line from this stop"
        case .stop: return "The whole stop"
        case .lines: return "These lines from here"
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    ForEach(options) { option in
                        let saved = store.has(option.id)
                        Button { store.toggle(option) } label: {
                            VStack(spacing: 0) {
                                HStack {
                                    Text(title(option.kind).uppercased()).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.secondary)
                                    Spacer()
                                    Label(saved ? "Saved" : "Add", systemImage: saved ? "star.fill" : "star")
                                        .font(.system(size: 13, weight: .semibold)).foregroundStyle(saved ? Theme.accent : Theme.secondary)
                                }
                                .padding(.horizontal, 16).padding(.top, 12)
                                FavoriteCard(fav: option, link: false)
                            }
                            .background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(saved ? Theme.accent : .clear, lineWidth: 2))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(16)
            }
            .background(Theme.canvas)
            .navigationTitle("Add to favourites")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
    }
}

/// Star button for a toolbar: opens the sheet; filled when any option is saved.
struct FavoriteButton: View {
    let options: [Favorite]
    @State private var store = FavoritesStore.shared
    @State private var sheet = false

    var body: some View {
        if !options.isEmpty {
            let saved = options.contains { store.has($0.id) }
            Button { sheet = true } label: {
                Image(systemName: saved ? "star.fill" : "star").foregroundStyle(saved ? Theme.accent : Color.primary)
            }
            .accessibilityLabel("Favourites")
            .sheet(isPresented: $sheet) { FavoriteSheet(options: options) }
        }
    }
}
