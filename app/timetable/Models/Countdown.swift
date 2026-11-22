//
//  Countdown.swift
//  timetable
//
//  Countdown rules, mirroring web/src/lib/countdown.ts and the departure rows.
//

import Foundation

struct CountdownText: Equatable {
    var value: String
    /// nil for a clock time (nothing under it).
    var unit: String?
}

enum Countdown {
    /// A departed row counts on (-1... -10 s), then goes.
    static let lingerSeconds: Double = 10

    /// Seconds under a minute, half minutes under 3 minutes, whole minutes under an hour.
    static func upcoming(_ seconds: Double) -> CountdownText {
        let s = Int(max(0, seconds).rounded())
        if s < 60 { return CountdownText(value: String(s), unit: tr("sec")) }
        if s < 180 {
            let halves = s / 30
            let whole = halves / 2
            return CountdownText(value: halves % 2 == 1 ? "\(whole)½" : String(whole), unit: tr("min"))
        }
        return CountdownText(value: String(s / 60), unit: tr("min"))
    }

    /// Just left (up to a minute): "0" for the first second (no jump from 0 to a minus), then "-1", "-2"...
    static func justLeft(_ seconds: Double) -> CountdownText {
        let n = Int((-seconds).rounded(.down))
        return CountdownText(value: n == 0 ? "0" : "-\(n)", unit: tr("sec"))
    }

    /// What a row shows for a time `seconds` from the reference.
    /// - Parameters:
    ///   - fixed: the reference is a chosen time, not the clock: earlier rows read "N min before".
    ///   - board: the lines board's style ("-3 min") rather than the list's ("3 min before").
    static func text(seconds: Double, at time: Date, fixed: Bool, board: Bool = false) -> CountdownText {
        // An hour or more either way: the clock time
        if abs(seconds) >= 3600 { return CountdownText(value: TimeFormat.clock(time), unit: nil) }
        if seconds < 0 {
            if fixed {
                let minutes = Int((-seconds / 60).rounded(.up))
                return board ? CountdownText(value: "-\(minutes)", unit: tr("min"))
                             : CountdownText(value: String(minutes), unit: tr("min before"))
            }
            if seconds >= -60 { return justLeft(seconds) }
            return CountdownText(value: String(Int((-seconds / 60).rounded())), unit: tr("min ago"))
        }
        return upcoming(seconds)
    }
}

/// Remembers which departures were on screen while still to come: only those may
/// linger after leaving; one already gone when the list loaded never shows.
final class DepartureTracker {
    private var shownUpcoming = Set<String>()

    /// Filters to what should be on screen at `now`. With a chosen time (`reference`) everything shows.
    func visible(_ list: [Departure], now: Date, reference: Date?) -> [Departure] {
        list.filter { d in
            if reference != nil { return true }
            let t = d.time.timeIntervalSince(now)
            if t >= 0 { shownUpcoming.insert(d.id); return true }
            return shownUpcoming.contains(d.id) && t >= -Countdown.lingerSeconds
        }
    }
}
