//
//  FavoritesWidgetView.swift
//  BudapestGONEWidgets
//
//  Layouts per widget size. Rows are one line each: badge, (direction,) next times; same look as the favourite cards.
//

import SwiftUI
import WidgetKit

/// A line's next departures, merged into one row.
private struct LineRow: Identifiable {
    let line: LineRef
    let headsign: String?
    let times: [Departure]
    var id: String { line.routeId }
}

/// Lines in order of their next departure, each with its next `times` departures still to come at `now`.
private func rows(_ departures: [Departure], now: Date, lines: Int, times: Int) -> [LineRow] {
    var order: [String] = []
    var groups: [String: [Departure]] = [:]
    for d in departures where d.departure >= now {
        guard let id = d.route?.routeId else { continue }
        if groups[id] == nil { order.append(id) }
        groups[id, default: []].append(d)
    }
    return order.prefix(lines).map { id in
        let list = Array(groups[id]!.prefix(times))
        return LineRow(line: list[0].route!, headsign: list[0].headsign, times: list)
    }
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

/// One favourite: its name and a row per line.
private struct FavoriteBlock: View {
    let fav: FavoriteData
    let now: Date
    let lines: Int
    let times: Int
    var showHeadsign = false
    var showSubtitle = false

    var body: some View {
        let list = rows(fav.departures, now: now, lines: lines, times: times)
        VStack(alignment: .leading, spacing: 4) {
            VStack(alignment: .leading, spacing: 0) {
                Text(fav.title).font(.system(size: 14, weight: .semibold)).lineLimit(1)
                if showSubtitle, let s = fav.subtitle {
                    Text(s).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1)
                }
            }
            if list.isEmpty {
                // Nothing coming (or nothing loaded): the badges with a dash, like a card that has no times
                HStack(spacing: 6) {
                    ForEach(fav.lines.prefix(3), id: \.routeId) { LineBadge(line: $0, fit: true) }
                    Text(tr("No departures")).font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(1)
                }
                .padding(.top, 2)
            } else {
                ForEach(list) { row in
                    HStack(spacing: 6) {
                        LineBadge(line: row.line, fit: true)
                        if showHeadsign {
                            Text(row.headsign ?? "").font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(1)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        HStack(spacing: 7) {
                            ForEach(row.times) { TimeText(departure: $0, now: now) }
                        }
                        .minimumScaleFactor(0.7)
                        if !showHeadsign { Spacer(minLength: 0) }
                    }
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
            if let fav = entry.favorites.first, let row = rows(fav.departures, now: now, lines: 1, times: 2).first {
                Text("\(row.line.shortName ?? row.line.routeId) \(row.times.map { timeText($0, now: now) }.joined(separator: " · "))")
            } else {
                Text(entry.noFavorites ? tr("No favourites yet") : tr("No departures"))
            }
        case .accessoryRectangular:
            if entry.noFavorites {
                EmptyState(compact: true)
            } else if let fav = entry.favorites.first {
                VStack(alignment: .leading, spacing: 1) {
                    Text(fav.title).font(.system(size: 13, weight: .semibold)).lineLimit(1)
                    let list = rows(fav.departures, now: now, lines: 2, times: 3)
                    if list.isEmpty { Text(tr("No departures")).font(.system(size: 12)) }
                    ForEach(list) { row in
                        HStack(spacing: 5) {
                            Text(row.line.shortName ?? row.line.routeId).font(.system(size: 12, weight: .bold)).monospacedDigit()
                                .padding(.horizontal, 4).background(.white.opacity(0.25), in: RoundedRectangle(cornerRadius: 3))
                            Text(row.times.map { timeText($0, now: now) }.joined(separator: "  ")).font(.system(size: 13, weight: .semibold)).monospacedDigit().lineLimit(1)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        case .systemSmall:
            if entry.noFavorites { EmptyState() }
            else if let fav = entry.favorites.first { FavoriteBlock(fav: fav, now: now, lines: 3, times: 2) }
        case .systemMedium:
            if entry.noFavorites { EmptyState() }
            else if entry.favorites.count == 1 {
                FavoriteBlock(fav: entry.favorites[0], now: now, lines: 3, times: 4, showHeadsign: true, showSubtitle: true)
            } else {
                HStack(alignment: .top, spacing: 14) {
                    ForEach(entry.favorites, id: \.id) { fav in
                        Link(destination: fav.url) { FavoriteBlock(fav: fav, now: now, lines: 3, times: 2) }
                    }
                }
            }
        default: // large
            if entry.noFavorites { EmptyState() }
            else if entry.favorites.count == 1 {
                FavoriteBlock(fav: entry.favorites[0], now: now, lines: 8, times: 4, showHeadsign: true, showSubtitle: true)
            } else {
                let lines = entry.favorites.count <= 2 ? 4 : 2
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(entry.favorites.enumerated()), id: \.element.id) { i, fav in
                        if i > 0 { Divider() }
                        Link(destination: fav.url) { FavoriteBlock(fav: fav, now: now, lines: lines, times: 4, showHeadsign: true) }
                    }
                    Spacer(minLength: 0)
                }
            }
        }
    }
}
