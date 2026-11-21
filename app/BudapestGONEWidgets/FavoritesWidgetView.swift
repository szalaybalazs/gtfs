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
        // A bare clock time (an hour or more away) gets more room than minutes, which already carry the live mark
        .padding(.horizontal, departure.departure.timeIntervalSince(now) >= 3600 ? 4 : 0)
    }
}

private struct Title: View {
    let fav: FavoriteData
    var body: some View {
        // The name, then where it is headed in a lighter weight
        (Text(fav.title).font(.system(size: 14, weight: .semibold))
            + Text(fav.subtitle.map { "  " + $0 } ?? "").font(.system(size: 12)).foregroundColor(.secondary))
            .lineLimit(1)
    }
}

private struct NoDepartures: View {
    let fav: FavoriteData
    var body: some View {
        HStack(spacing: 6) {
            ForEach(fav.lines.prefix(3), id: \.routeId) { LineBadge(line: $0, fit: true) }
            Text(tr("No departures")).font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(1)
        }
    }
}

/// Back-to-back departures of one line merged: [1] 1' 5'  [2] 7'  [1] 10' (the same reading as a favourite on Home).
private struct Run: Identifiable {
    let line: LineRef
    var times: [Departure]
    var id: String { times.first?.id ?? line.routeId }
}

private func runs(_ f: FavoriteData, now: Date, count: Int) -> [Run] {
    var out: [Run] = []
    for d in upcoming(f, now: now, count) {
        if let last = out.last, last.line.routeId == d.route!.routeId { out[out.count - 1].times.append(d) }
        else { out.append(Run(line: d.route!, times: [d])) }
    }
    return out
}

/// One favourite: its title, and under it one line of departures in time order.
private struct FavoriteRow: View {
    let fav: FavoriteData
    let now: Date

    private func line(_ count: Int) -> some View {
        HStack(spacing: 8) {
            ForEach(runs(fav, now: now, count: count)) { run in
                HStack(spacing: 4) {
                    LineBadge(line: run.line, fit: true)
                    HStack(spacing: 6) { ForEach(run.times) { TimeText(departure: $0, now: now, size: 14) } }
                }
            }
            Spacer(minLength: 0)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Title(fav: fav)
            if upcoming(fav, now: now, 1).isEmpty {
                NoDepartures(fav: fav)
            } else {
                // As many departures as fit the width
                ViewThatFits(in: .horizontal) {
                    ForEach([12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], id: \.self) { line($0).fixedSize(horizontal: true, vertical: false) }
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

    var body: some View {
        Group {
            if entry.noFavorites {
                EmptyState()
            } else {
                // Two skinny rows, one above the other
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(Array(entry.favorites.prefix(2).enumerated()), id: \.element.id) { i, fav in
                        if i > 0 { Divider() }
                        Link(destination: fav.url) { FavoriteRow(fav: fav, now: entry.date) }
                    }
                    Spacer(minLength: 0)
                }
            }
        }
        .widgetURL(entry.favorites.first?.url)
        .containerBackground(for: .widget) { Color(.systemBackground) }
    }
}
