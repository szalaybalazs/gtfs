//
//  DepartureRows.swift
//  timetable
//
//  Timeline rows and the Lines board (web/src/components/Departures.tsx, LineBoard.tsx).
//

import SwiftUI
import Flow

/// "ARRIVES" tag on a trip that ends here.
private struct ArrivesTag: View {
    var body: some View {
        Text("ARRIVES")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(Theme.secondary)
            .padding(.horizontal, 6)
            .frame(height: 18)
            .background(Theme.fill, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
    }
}

private func isLive(_ d: Departure) -> Bool {
    RealtimeStatus(realtime: d.realtime, delay: d.delay) != .scheduled
}

/// One departure in time order: badge, destination, marks and exact time, big countdown, chevron.
struct DepartureRow: View {
    let departure: Departure
    let now: Date
    var fixed = false
    /// The trip you arrived on: marked "Your trip" and tinted.
    var mine = false

    var body: some View {
        let d = departure
        let status = RealtimeStatus(realtime: d.realtime, delay: d.delay)
        let seconds = d.time.timeIntervalSince(now)
        // Just departed: -1, -2... in plain text, faded
        let justLeft = seconds < 0 && seconds >= -60
        let left = seconds < -60
        let count: CountdownText = fixed && seconds < 0
            ? CountdownText(value: String(Int((-seconds / 60).rounded(.up))), unit: tr("min before"))
            : left ? CountdownText(value: String(Int((-seconds / 60).rounded())), unit: tr("min ago"))
            : justLeft ? CountdownText(value: "-\(Int((-seconds).rounded(.up)))", unit: tr("sec"))
            : Countdown.upcoming(seconds)
        HStack(spacing: 12) {
            if let route = d.route { LineBadge(line: route) }
            VStack(alignment: .leading, spacing: 0) {
                if mine {
                    Text("YOUR TRIP").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.accent)
                }
                Text(d.headsign ?? "—")
                    .font(.system(size: 17, weight: .medium))
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                HFlow(itemSpacing: 6, rowSpacing: 0) {
                    if d.terminates { ArrivesTag() }
                    if d.frontDoor { MarkerIcon(marker: .frontDoor) }
                    if d.onRequest { MarkerIcon(marker: .demand) }
                    if d.wheelchairAccessible { MarkerIcon(marker: .lowFloor) }
                    if d.bikesAllowed { MarkerIcon(marker: .bikes) }
                    if status == .late || status == .early, let delay = d.delay {
                        Text(TimeFormat.clock(d.time.addingTimeInterval(-Double(delay))))
                            .strikethrough().foregroundStyle(Theme.secondary)
                    }
                    HStack(spacing: 2) {
                        Text(TimeFormat.clock(d.time))
                        if status != .scheduled { LiveIcon(size: 14) }
                    }
                    .foregroundStyle(Theme.color(status))
                }
                .font(.system(size: 15).monospacedDigit())
                .padding(.top, 2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            // Countdown stays plain (black, grey once gone); colour lives on the time line. Live mark in its own corner.
            VStack(alignment: .trailing, spacing: 0) {
                Text(count.value).font(.system(size: 24, weight: .bold)).monospacedDigit().lineLimit(1)
                Text(count.unit ?? " ").font(.system(size: 11, weight: .medium)).foregroundStyle(Theme.secondary).lineLimit(1)
            }
            .foregroundStyle(left ? Theme.secondary : Color.primary)
            .padding(.trailing, 14)
            .frame(minWidth: 56, alignment: .trailing)
            .overlay(alignment: .topTrailing) {
                if status != .scheduled && !justLeft && !left {
                    LiveIcon(size: 12).foregroundStyle(Theme.secondary)
                }
            }
            Chevron()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .opacity(left || justLeft ? 0.45 : 1)
        .background(mine ? Theme.accent.opacity(0.1) : Color.clear)
    }
}

/// One countdown column of the Lines board. Fixed width, so every row lines up; nothing may overflow it:
/// minutes / half minutes / seconds under an hour, the clock time (smaller) from an hour either way,
/// and the live mark on the unit line, never over the digits.
struct BoardCountdown: View {
    let departure: Departure
    let now: Date
    var small = false
    var fixed = false

    var body: some View {
        let d = departure
        let seconds = d.time.timeIntervalSince(now)
        let left = seconds < 0
        let clock = abs(seconds) >= 3600
        let text: CountdownText = clock
            ? CountdownText(value: TimeFormat.clock(d.time), unit: nil)
            : left && fixed ? CountdownText(value: "-\(Int((-seconds / 60).rounded(.up)))", unit: tr("min"))
            : left ? CountdownText(value: "-\(Int((-seconds).rounded(.up)))", unit: tr("sec"))
            : Countdown.upcoming(seconds)
        let size: CGFloat = clock ? (small ? 12 : 15) : (small ? 16 : 24)
        VStack(alignment: .trailing, spacing: 0) {
            // Same height for clock times and countdowns, so the unit lines stay level
            Text(text.value)
                .font(.system(size: size, weight: .bold)).monospacedDigit()
                .lineLimit(1)
                .frame(height: small ? 16 : 24, alignment: .bottomTrailing)
                .overlay(alignment: .topTrailing) {
                    // Live mark right after the number, hanging into the gap between columns so it never shifts the digits
                    if isLive(d) && !left {
                        LiveIcon(size: small ? 8 : 10).foregroundStyle(Theme.secondary)
                            .offset(x: small ? 8 : 10)
                    }
                }
            Text(text.unit ?? " ")
            .font(.system(size: small ? 10 : 11, weight: .medium))
            .foregroundStyle(Theme.secondary)
            .lineLimit(1)
        }
        .foregroundStyle(small ? Theme.secondary : Color.primary)
        .opacity(left ? 0.45 : 1)
        .frame(width: small ? 36 : 44, alignment: .trailing)
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
                Text(d.headsign ?? "—")
                    .font(.system(size: 17, weight: .medium))
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                if d.terminates { ArrivesTag() }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 12) {
                ForEach(Array(shown.enumerated()), id: \.element.tripId) { i, dep in
                    BoardCountdown(departure: dep, now: now, small: i > 0, fixed: fixed)
                }
                // Empty columns when a line has fewer coming, so the big times stay lined up
                ForEach(0..<(columns - shown.count), id: \.self) { _ in
                    Color.clear.frame(width: 36, height: 1)
                }
            }
            .animation(.easeOut(duration: 0.4), value: shown.map(\.tripId))
            Chevron()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
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
