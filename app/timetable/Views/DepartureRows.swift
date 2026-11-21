//
//  DepartureRows.swift
//  timetable
//
//  Timeline rows and the Lines board (web/src/components/Departures.tsx, LineBoard.tsx).
//

import SwiftUI

/// Width of the countdown columns, so every row lines up.
private enum Column {
    static let big: CGFloat = 46
    static let small: CGFloat = 38
}

/// The number (and unit under it) for one departure.
struct CountdownView: View {
    let departure: Departure
    let now: Date
    var small = false
    var fixed = false
    var board = false

    var body: some View {
        let seconds = departure.time.timeIntervalSince(now)
        let text = Countdown.text(seconds: seconds, at: departure.time, fixed: fixed, board: board)
        let gone = seconds < 0
        let live = RealtimeStatus(realtime: departure.realtime, delay: departure.delay) != .scheduled
        VStack(alignment: .trailing, spacing: 0) {
            Text(text.value)
                .font(.system(size: text.unit == nil ? (small ? 12 : 15) : (small ? 16 : 24), weight: .bold))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            HStack(spacing: 2) {
                if live && !gone { Image(systemName: "dot.radiowaves.up.forward").font(.system(size: small ? 8 : 9)) }
                Text(text.unit ?? " ")
            }
            .font(.system(size: small ? 10 : 11, weight: .medium))
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }
        .foregroundStyle(small || gone ? Color.secondary : Color.primary)
        .opacity(gone ? 0.45 : 1)
        .frame(width: small ? Column.small : Column.big, alignment: .trailing)
    }
}

private struct ArrivesTag: View {
    var body: some View {
        Text("ARRIVES")
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 5)
            .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 5))
    }
}

/// One departure in time order: badge, destination, marks and exact time, countdown.
struct DepartureRow: View {
    let departure: Departure
    let now: Date
    var fixed = false

    var body: some View {
        let d = departure
        let status = RealtimeStatus(realtime: d.realtime, delay: d.delay)
        let seconds = d.time.timeIntervalSince(now)
        HStack(spacing: 10) {
            if let route = d.route { LineBadge(line: route) }
            VStack(alignment: .leading, spacing: 2) {
                Text(d.headsign ?? "—").font(.body.weight(.medium)).lineLimit(2)
                HStack(spacing: 6) {
                    if d.terminates { ArrivesTag() }
                    if d.frontDoor { MarkerIcon(marker: .frontDoor) }
                    if d.onRequest { MarkerIcon(marker: .demand) }
                    if d.wheelchairAccessible { MarkerIcon(marker: .lowFloor) }
                    if d.bikesAllowed { MarkerIcon(marker: .bikes) }
                    if (status == .late || status == .early), let delay = d.delay {
                        Text(TimeFormat.clock(d.time.addingTimeInterval(-Double(delay))))
                            .strikethrough().foregroundStyle(.secondary)
                    }
                    HStack(spacing: 2) {
                        Text(TimeFormat.clock(d.time))
                        if status != .scheduled { Image(systemName: "dot.radiowaves.up.forward").font(.caption2) }
                    }
                    .foregroundStyle(statusColor(status))
                }
                .font(.subheadline.monospacedDigit())
            }
            Spacer(minLength: 4)
            CountdownView(departure: d, now: now, fixed: fixed)
        }
        .opacity(seconds < 0 && !fixed ? 0.45 : 1)
        .padding(.vertical, 2)
    }

    private func statusColor(_ s: RealtimeStatus) -> Color {
        switch s {
        case .scheduled: return .primary
        case .onTime: return .green
        case .early: return .purple
        case .late: return .red
        }
    }
}

/// One line + direction: the next departure big, the following ones smaller beside it.
struct LineBoardRow: View {
    let list: [Departure]
    let now: Date
    var fixed = false
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        let d = list[0]
        let columns = sizeClass == .regular ? 4 : 3
        let shown = Array(list.prefix(columns))
        HStack(spacing: 10) {
            if let route = d.route { LineBadge(line: route) }
            VStack(alignment: .leading, spacing: 2) {
                Text(d.headsign ?? "—").font(.body.weight(.medium)).lineLimit(2)
                if d.terminates { ArrivesTag() }
            }
            Spacer(minLength: 4)
            HStack(spacing: 6) {
                ForEach(Array(shown.enumerated()), id: \.element.tripId) { i, dep in
                    CountdownView(departure: dep, now: now, small: i > 0, fixed: fixed, board: true)
                }
                // Empty columns when a line has fewer coming, so the big times stay lined up
                ForEach(0..<(columns - shown.count), id: \.self) { _ in
                    Color.clear.frame(width: Column.small, height: 1)
                }
            }
            .animation(.easeOut(duration: 0.4), value: shown.map(\.tripId))
        }
        .padding(.vertical, 2)
    }
}

enum LineBoardGrouping {
    /// One row per line + direction; arrivals get their own row. Metro first, then tram, ...; by line number, then destination.
    static func rows(_ departures: [Departure]) -> [(key: String, list: [Departure])] {
        var order: [String] = []
        var groups: [String: [Departure]] = [:]
        for d in departures {
            let key = "\(d.route?.routeId ?? "")|\(d.headsign ?? "")|\(d.terminates ? "arr" : "dep")"
            // A trip calling at two platforms of the group counts once (its first stop here)
            if groups[key]?.contains(where: { $0.tripId == d.tripId }) == true { continue }
            if groups[key] == nil { order.append(key) }
            groups[key, default: []].append(d)
        }
        return order.map { (key: $0, list: groups[$0]!) }.sorted { a, b in
            let x = a.list[0], y = b.list[0]
            if let lx = x.route, let ly = y.route {
                if lineOrder(lx, ly) { return true }
                if lineOrder(ly, lx) { return false }
            }
            return compareText(x.headsign, y.headsign) == .orderedAscending
        }
    }
}
