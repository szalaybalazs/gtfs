//
//  FavoritesWidgetView.swift
//  BudapestGONEWidgets
//
//  Layouts per widget size. Departures are always in time order, times as minutes ("Now", "5'", a clock time past an hour).
//  Small: the title, then each departure as a badge with its time. Medium / large: rows with the destination;
//  two favourites share a medium widget side by side and a large one one above the other.
//

import SwiftUI
import WidgetKit

/// Departures still to come at `now`, in time order.
private func upcoming(_ f: FavoriteData, now: Date, _ count: Int) -> [Departure] {
    Array(f.departures.filter { $0.departure >= now && $0.route != nil }.sorted { $0.departure < $1.departure }.prefix(count))
}

/// "Now", "5'" or "17:23" (an hour or more away).
private func timeText(_ d: Departure, now: Date) -> String {
    let s = d.departure.timeIntervalSince(now)
    if s < 60 { return tr("Now") }
    if s >= 3600 { return TimeFormat.clock(d.departure) }
    return "\(Int(s / 60))'"
}

private func isLive(_ d: Departure) -> Bool {
    RealtimeStatus(realtime: d.realtime, delay: d.delay) != .scheduled
}

private struct TimeText: View {
    let departure: Departure
    let now: Date
    var size: CGFloat = 16

    var body: some View {
        HStack(alignment: .top, spacing: 1) {
            Text(timeText(departure, now: now)).font(.system(size: size, weight: .semibold)).monospacedDigit().lineLimit(1).fixedSize()
            if isLive(departure) { LiveIcon(size: size * 0.6).foregroundStyle(.secondary).padding(.top, 1) }
        }
    }
}

/// A badge with its time next to it.
private struct Chip: View {
    let departure: Departure
    let now: Date
    var body: some View {
        HStack(spacing: 5) {
            LineBadge(line: departure.route!, fit: true)
            TimeText(departure: departure, now: now)
            Spacer(minLength: 0)
        }
    }
}

/// A badge, where it is headed, and its time.
private struct DepartureRow: View {
    let departure: Departure
    let now: Date
    var showHeadsign = true
    var body: some View {
        HStack(spacing: 6) {
            LineBadge(line: departure.route!, fit: true)
            if showHeadsign {
                Text(departure.headsign ?? "").font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                Spacer(minLength: 0)
            }
            TimeText(departure: departure, now: now)
        }
    }
}

private struct Title: View {
    let fav: FavoriteData
    var showSubtitle = false
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(fav.title).font(.system(size: 14, weight: .semibold)).lineLimit(1)
            if showSubtitle, let s = fav.subtitle {
                Text(s).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1)
            }
        }
    }
}

private struct NoDepartures: View {
    let fav: FavoriteData
    var body: some View {
        HStack(spacing: 6) {
            ForEach(fav.lines.prefix(3), id: \.routeId) { LineBadge(line: $0, fit: true) }
            Text(tr("No departures")).font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(1)
        }
        .padding(.top, 2)
    }
}

/// One favourite as a list in time order.
private struct ListBlock: View {
    let fav: FavoriteData
    let now: Date
    let rows: Int
    var showHeadsign = true
    var showSubtitle = false

    var body: some View {
        let list = upcoming(fav, now: now, rows)
        VStack(alignment: .leading, spacing: 5) {
            Title(fav: fav, showSubtitle: showSubtitle)
            if list.isEmpty { NoDepartures(fav: fav) }
            else { ForEach(list) { DepartureRow(departure: $0, now: now, showHeadsign: showHeadsign) } }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }
}

/// Small: the title and the next departures as badge + time chips, two to a row.
private struct ChipBlock: View {
    let fav: FavoriteData
    let now: Date

    var body: some View {
        let list = upcoming(fav, now: now, 8)
        VStack(alignment: .leading, spacing: 6) {
            Title(fav: fav)
            if list.isEmpty { NoDepartures(fav: fav) }
            else {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], alignment: .leading, spacing: 6) {
                    ForEach(list) { Chip(departure: $0, now: now) }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }
}

private struct EmptyState: View {
    var compact = false
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label(tr("No favourites yet"), systemImage: "star").font(.system(size: 14, weight: .semibold)).lineLimit(compact ? 1 : 2)
            if !compact {
                Text(tr("Save a stop or line in the app to see its departures here.")).font(.system(size: 12)).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct FavoritesWidgetView: View {
    let entry: FavoritesEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        content
            .widgetURL(entry.favorites.first?.url)
            .containerBackground(for: .widget) { Color(.systemBackground) }
    }

    @ViewBuilder private var content: some View {
        let now = entry.date
        switch family {
        case .accessoryInline:
            if let fav = entry.favorites.first, !upcoming(fav, now: now, 2).isEmpty {
                Text(upcoming(fav, now: now, 2).map { "\($0.route!.shortName ?? $0.route!.routeId) \(timeText($0, now: now))" }.joined(separator: " · "))
            } else {
                Text(entry.noFavorites ? tr("No favourites yet") : tr("No departures"))
            }
        case .accessoryRectangular:
            if entry.noFavorites {
                EmptyState(compact: true)
            } else if let fav = entry.favorites.first {
                VStack(alignment: .leading, spacing: 1) {
                    Text(fav.title).font(.system(size: 13, weight: .semibold)).lineLimit(1)
                    let list = upcoming(fav, now: now, 4)
                    if list.isEmpty { Text(tr("No departures")).font(.system(size: 12)) }
                    // Next departures in time order, two per line
                    ForEach(Array(stride(from: 0, to: list.count, by: 2)), id: \.self) { i in
                        HStack(spacing: 10) {
                            ForEach(list[i..<min(i + 2, list.count)]) { d in
                                HStack(spacing: 4) {
                                    Text(d.route!.shortName ?? d.route!.routeId).font(.system(size: 12, weight: .bold)).monospacedDigit()
                                        .padding(.horizontal, 4).background(.white.opacity(0.25), in: RoundedRectangle(cornerRadius: 3))
                                    Text(timeText(d, now: now)).font(.system(size: 13, weight: .semibold)).monospacedDigit().lineLimit(1)
                                }
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        case .systemSmall:
            if entry.noFavorites { EmptyState() }
            else if let fav = entry.favorites.first { ChipBlock(fav: fav, now: now) }
        case .systemMedium:
            if entry.noFavorites { EmptyState() }
            else if entry.favorites.count == 1 {
                ListBlock(fav: entry.favorites[0], now: now, rows: 4, showSubtitle: true)
            } else {
                HStack(alignment: .top, spacing: 14) {
                    ForEach(entry.favorites, id: \.id) { fav in
                        Link(destination: fav.url) { ListBlock(fav: fav, now: now, rows: 4, showHeadsign: false) }
                    }
                }
            }
        default: // large
            if entry.noFavorites { EmptyState() }
            else if entry.favorites.count == 1 {
                ListBlock(fav: entry.favorites[0], now: now, rows: 10, showSubtitle: true)
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(entry.favorites.enumerated()), id: \.element.id) { i, fav in
                        if i > 0 { Divider() }
                        Link(destination: fav.url) { ListBlock(fav: fav, now: now, rows: 5) }
                    }
                    Spacer(minLength: 0)
                }
            }
        }
    }
}
