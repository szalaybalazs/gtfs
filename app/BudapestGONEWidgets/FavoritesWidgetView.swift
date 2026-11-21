//
//  FavoritesWidgetView.swift
//  BudapestGONEWidgets
//
//  Layouts per widget size. Rows are one line each: badge, (direction,) next times; same look as the favourite cards.
//

import SwiftUI
import WidgetKit

/// One row: a line (and direction) with its next departures.
private struct LineRow: Identifiable {
    let line: LineRef
    let headsign: String?
    let times: [Departure]
    var id: String { "\(line.routeId)|\(headsign ?? "")|\(times.first?.id ?? "")" }
}

/// Rows in order of their next departure, each with its next `times` departures still to come at `now`.
/// By line: one row per line. By time: one departure per row.
private func rows(_ departures: [Departure], now: Date, lines: Int, times: Int, grouping: FavGrouping = .line) -> [LineRow] {
    let upcoming = departures.filter { $0.departure >= now && $0.route != nil }.sorted { $0.departure < $1.departure }
    if grouping == .time {
        return upcoming.prefix(lines).map { LineRow(line: $0.route!, headsign: $0.headsign, times: [$0]) }
    }
    var order: [String] = []
    var groups: [String: [Departure]] = [:]
    for d in upcoming {
        let key = d.route!.routeId
        if groups[key] == nil { order.append(key) }
        groups[key, default: []].append(d)
    }
    return order.prefix(lines).map { key in
        let list = Array(groups[key]!.prefix(times))
        return LineRow(line: list[0].route!, headsign: list[0].headsign, times: list)
    }
}

/// "Now", "5'", "17:23" or "5' 17:23", by the chosen style (a countdown past an hour is the clock time).
private func timeText(_ d: Departure, now: Date, style: DepartureTimeStyle = .countdown) -> String {
    let s = d.departure.timeIntervalSince(now)
    let countdown = s < 60 ? tr("Now") : s >= 3600 ? TimeFormat.clock(d.departure) : "\(Int(s / 60))'"
    switch style {
    case .countdown: return countdown
    case .clock: return TimeFormat.clock(d.departure)
    case .both: return s >= 3600 ? TimeFormat.clock(d.departure) : "\(countdown) \(TimeFormat.clock(d.departure))"
    }
}

private func isLive(_ d: Departure) -> Bool {
    RealtimeStatus(realtime: d.realtime, delay: d.delay) != .scheduled
}

private struct TimeText: View {
    let departure: Departure
    let now: Date
    var size: CGFloat = 16
    var style: DepartureTimeStyle = .countdown

    var body: some View {
        HStack(alignment: .top, spacing: 1) {
            Text(timeText(departure, now: now, style: style)).font(.system(size: size, weight: .semibold)).monospacedDigit().lineLimit(1).fixedSize()
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
    var style: DepartureTimeStyle = .countdown

    var body: some View {
        // The favourite's own grouping and size (a widget fills its space when it has none). By time says where each is headed
        // and one time per row makes a plain list, so it gets more rows
        let grouping = fav.grouping ?? .line
        let showHeadsign = showHeadsign || grouping == .time
        let capacity = fav.size.map { min($0.rows, lines) } ?? lines
        let list = rows(fav.departures, now: now, lines: grouping == .time ? capacity + 2 : capacity, times: times, grouping: grouping)
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
                            ForEach(row.times) { TimeText(departure: $0, now: now, style: style) }
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
            if let fav = entry.favorites.first, let row = rows(fav.departures, now: now, lines: 1, times: 2, grouping: fav.grouping ?? .line).first {
                Text("\(row.line.shortName ?? row.line.routeId) \(row.times.map { timeText($0, now: now, style: entry.timeStyle) }.joined(separator: " · "))")
            } else {
                Text(entry.noFavorites ? tr("No favourites yet") : tr("No departures"))
            }
        case .accessoryRectangular:
            if entry.noFavorites {
                EmptyState(compact: true)
            } else if let fav = entry.favorites.first {
                VStack(alignment: .leading, spacing: 1) {
                    Text(fav.title).font(.system(size: 13, weight: .semibold)).lineLimit(1)
                    let list = rows(fav.departures, now: now, lines: 2, times: fav.grouping == .time ? 1 : 3, grouping: fav.grouping ?? .line)
                    if list.isEmpty { Text(tr("No departures")).font(.system(size: 12)) }
                    ForEach(list) { row in
                        HStack(spacing: 5) {
                            Text(row.line.shortName ?? row.line.routeId).font(.system(size: 12, weight: .bold)).monospacedDigit()
                                .padding(.horizontal, 4).background(.white.opacity(0.25), in: RoundedRectangle(cornerRadius: 3))
                            Text(row.times.map { timeText($0, now: now, style: entry.timeStyle) }.joined(separator: "  ")).font(.system(size: 13, weight: .semibold)).monospacedDigit().lineLimit(1)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        case .systemSmall:
            if entry.noFavorites { EmptyState() }
            else if let fav = entry.favorites.first { FavoriteBlock(fav: fav, now: now, lines: 3, times: 2, style: entry.timeStyle) }
        case .systemMedium:
            if entry.noFavorites { EmptyState() }
            else if entry.favorites.count == 1 {
                FavoriteBlock(fav: entry.favorites[0], now: now, lines: 3, times: 4, showHeadsign: true, showSubtitle: true, style: entry.timeStyle)
            } else {
                HStack(alignment: .top, spacing: 14) {
                    ForEach(entry.favorites, id: \.id) { fav in
                        Link(destination: fav.url) { FavoriteBlock(fav: fav, now: now, lines: 3, times: 2, style: entry.timeStyle) }
                    }
                }
            }
        default: // large
            if entry.noFavorites { EmptyState() }
            else if entry.favorites.count == 1 {
                FavoriteBlock(fav: entry.favorites[0], now: now, lines: 8, times: 4, showHeadsign: true, showSubtitle: true, style: entry.timeStyle)
            } else {
                let lines = entry.favorites.count <= 2 ? 4 : 2
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(entry.favorites.enumerated()), id: \.element.id) { i, fav in
                        if i > 0 { Divider() }
                        Link(destination: fav.url) { FavoriteBlock(fav: fav, now: now, lines: lines, times: 4, showHeadsign: true, style: entry.timeStyle) }
                    }
                    Spacer(minLength: 0)
                }
            }
        }
    }
}
