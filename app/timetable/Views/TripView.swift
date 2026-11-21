//
//  TripView.swift
//  timetable
//
//  One vehicle's run: where it is, when it reaches each stop (web/src/pages/TripPage.tsx).
//

import SwiftUI

// TODO(match web): web/src/pages/TripPage.tsx was reworked first and iOS has to follow:
//  - no "towards" label; on time / late / early at the top right of the header card (not a LIVE badge)
//  - "updated Ns ago" always shown, small, on the bottom line of the header card
//  - header keeps length, minutes and stop count
//  - compact stop rows (drop the minutes-until column if it forces names to truncate)
//  - the vehicle marker on the stop list, placed between the two stops it is between (not always the midpoint)
struct TripView: View {
    let target: TripTarget
    @State private var model = TripViewModel()
    @State private var retry = 0

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                if let message = model.state.errorMessage, model.trip == nil {
                    ErrorView(message: message) { retry += 1 }
                } else if let trip = model.trip {
                    TimelineView(.periodic(from: .now, by: 1)) { context in
                        content(trip, now: context.date)
                    }
                } else if model.loaded {
                    Text("This trip is no longer available.").foregroundStyle(Theme.secondary).padding(24)
                } else {
                    skeleton
                }
            }
            .padding(16)
        }
        .background(Theme.canvas)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: retry) { await model.run(tripId: target.tripId, serviceDate: target.serviceDate) }
        .refreshable { await model.load(tripId: target.tripId, serviceDate: target.serviceDate) }
    }

    // MARK: Content

    private func content(_ trip: Trip, now: Date) -> some View {
        let stops = trip.stops
        // The vehicle sits between the last stop it has left and the next one
        let nextIndex = stops.firstIndex { $0.departure > now } ?? -1
        let started = nextIndex != 0 && !stops.isEmpty
        let finished = nextIndex == -1 && !stops.isEmpty
        let reference = stops.first { $0.stopId == target.from }
        let color = Color(hex: trip.route?.color ?? "#6b7280")
        // Seconds only when the data has them (like the web)
        let hasSeconds = stops.contains { TimeFormat.hasSeconds($0.arrival) || TimeFormat.hasSeconds($0.departure) }
        return VStack(spacing: 24) {
            header(trip, stops: stops, started: started, finished: finished,
                   delay: started && !finished ? Self.delay(stops, upTo: nextIndex) : nil)
            if let r = trip.route { AlertsSection(routeIds: [r.routeId]) }
            VStack(spacing: 0) {
                SectionTitle("Stops")
                Card {
                    VStack(spacing: 0) {
                        ForEach(Array(stops.enumerated()), id: \.element.id) { i, stop in
                            TripStopRow(
                                stop: stop, trip: trip, first: i == 0, last: i == stops.count - 1,
                                passed: nextIndex == -1 || i < nextIndex,
                                highlighted: stop.stopId == target.from,
                                color: color, referenceTime: reference?.departure, showSeconds: hasSeconds
                            )
                        }
                    }
                    .padding(.vertical, 8)
                }
            }
            if let v = model.vehicle, v.model != nil || v.plate != nil {
                TripVehicleCard(vehicle: v,
                                live: stops.contains { $0.realtime }, now: now)
            }
            if !model.path.isEmpty || stops.contains(where: { $0.lat != nil }) {
                VStack(spacing: 0) {
                    SectionTitle("Map")
                    TripMiniMap(trip: trip, vehicle: model.vehicle, path: model.path, color: color)
                }
            }
        }
    }

    private func header(_ trip: Trip, stops: [TripStop], started: Bool, finished: Bool, delay: Int?) -> some View {
        let live = stops.contains { $0.realtime }
        let via = Self.viaStops(stops)
        return Card {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 8) {
                    if let route = trip.route ?? target.route { LineBadge(line: route) }
                    Spacer()
                    if let delay { TripDelayText(minutes: delay) }
                    if started && !finished {
                        if live {
                            Text("LIVE").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.live)
                                .padding(.horizontal, 10).padding(.vertical, 2)
                                .background(Theme.live.opacity(0.15), in: Capsule())
                        } else {
                            Text("Scheduled").font(.system(size: 13, weight: .medium)).foregroundStyle(Theme.secondary)
                                .padding(.horizontal, 10).padding(.vertical, 2)
                                .background(Theme.fill, in: Capsule())
                        }
                    }
                }
                Text((trip.headsign ?? stops.last?.name ?? "") )
                    .font(.system(size: 24, weight: .bold)).padding(.top, 4)
                if !via.isEmpty {
                    Text(via.joined(separator: " ▸ ")).font(.system(size: 15)).padding(.top, 4)
                }
                if let stats = Self.stats(stops) {
                    Text(stats).font(.system(size: 15, weight: .medium)).monospacedDigit().padding(.top, 8)
                }
                if let last = stops.last, finished {
                    Text("Past trip").font(.system(size: 13)).foregroundStyle(Theme.secondary).padding(.top, 4)
                        .accessibilityLabel(tr("Past trip, ended \(TimeFormat.clock(last.arrival))"))
                } else if let first = stops.first, !started {
                    Text(tr("Upcoming · starts \(TimeFormat.clock(first.departure))")).font(.system(size: 13)).foregroundStyle(Theme.secondary).padding(.top, 4)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
        }
    }

    /// Delay in minutes at the last stop with realtime data at or before the vehicle.
    static func delay(_ stops: [TripStop], upTo next: Int) -> Int? {
        let reached = stops.prefix(max(next, 0) + 1)
        guard let s = reached.last(where: { $0.realtime }), let d = s.departureDelay ?? s.arrivalDelay else { return nil }
        return Int((Double(d) / 60).rounded())
    }

    /// Up to three evenly spaced intermediate stops, so the route reads "via A ▸ B ▸ C".
    static func viaStops(_ stops: [TripStop]) -> [String] {
        let middle = Array(stops.dropFirst().dropLast())
        guard !middle.isEmpty else { return [] }
        let n = min(3, middle.count)
        return (0..<n).map { middle[(($0 + 1) * middle.count) / (n + 1)].name }
    }

    static func stats(_ stops: [TripStop]) -> String? {
        guard stops.count >= 2, let a = stops.first, let b = stops.last else { return nil }
        let minutes = Int((b.arrival.timeIntervalSince(a.departure) / 60).rounded())
        return tr("\(minutes) min · \(stops.count) stops")
    }

    private var skeleton: some View {
        VStack(spacing: 24) {
            Card {
                VStack(alignment: .leading, spacing: 8) {
                    if let route = target.route { LineBadge(line: route) } else { RoundedRectangle(cornerRadius: 6).fill(Theme.fill).frame(width: 48, height: 24) }
                    if let h = target.headsign { Text(h).font(.system(size: 24, weight: .bold)) }
                    SkeletonBar(width: 200).padding(.top, 2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
            }
            SkeletonStopList(count: 8)
        }
    }
}

private struct TripStopRow: View {
    let stop: TripStop
    let trip: Trip
    let first: Bool
    let last: Bool
    let passed: Bool
    let highlighted: Bool
    let color: Color
    let referenceTime: Date?
    var showSeconds = false

    var body: some View {
        let s = stop
        // At the last stop only the arrival matters; elsewhere the departure is the main time
        let main = last ? s.arrival : s.departure
        let delay = last ? (s.arrivalDelay ?? s.departureDelay) : (s.departureDelay ?? s.arrivalDelay)
        let status = RealtimeStatus(realtime: s.realtime, delay: delay)
        let waits = !last && !first && s.departure.timeIntervalSince(s.arrival) >= 60
        // Minutes to or from the selected stop, always positive; blank on the stop itself
        let relative = referenceTime == nil || highlighted ? nil : Int((abs(main.timeIntervalSince(referenceTime!)) / 60).rounded())
        NavigationLink(value: StationTarget(
            stationId: s.stationId ?? s.stopId, from: s.stopId, reference: s.arrival, trip: trip.tripId
        )) {
            HStack(spacing: 0) {
                if referenceTime != nil {
                    Text(relative.map { "\($0)'" } ?? "")
                        .font(.system(size: 13, design: .monospaced)).foregroundStyle(Theme.secondary)
                        .frame(width: 34, alignment: .trailing)
                        .padding(.leading, 8)
                }
                ZStack {
                    Rectangle().fill(color).frame(width: 8)
                        .padding(.top, first ? 24 : 0).padding(.bottom, last ? 24 : 0)
                    Circle().fill(Theme.surface)
                        .overlay(Circle().strokeBorder(highlighted ? Color.primary : color, lineWidth: 2))
                        .frame(width: highlighted ? 16 : 10, height: highlighted ? 16 : 10)
                }
                .frame(width: 28, height: 48)
                .padding(.trailing, 6)
                Text(s.name).font(.system(size: 17, weight: highlighted ? .bold : .regular)).lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading).padding(.trailing, 8)
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    if (status == .late || status == .early), let delay {
                        Text(TimeFormat.clock(main.addingTimeInterval(-Double(delay))))
                            .font(.system(size: 12)).strikethrough().foregroundStyle(Theme.secondary)
                    }
                    if waits { Text(TimeFormat.clock(s.arrival)).font(.system(size: 12)).opacity(0.75) }
                    Text(TimeFormat.clock(main)).font(.system(size: 16, weight: status == .scheduled ? .regular : .semibold))
                    if showSeconds { Text(":" + TimeFormat.seconds(main)).font(.system(size: 11)).opacity(0.7).padding(.leading, -4) }
                    if status != .scheduled { LiveIcon(size: 14).alignmentGuide(.firstTextBaseline) { $0[.bottom] - 2 } }
                }
                .monospacedDigit()
                .foregroundStyle(Theme.color(status))
                .padding(.trailing, 12)
                Chevron()
            }
            .padding(.trailing, 12)
            .opacity(passed ? 0.45 : 1)
            .background(highlighted ? Theme.accent.opacity(0.08) : Color.clear)
        }
        .buttonStyle(RowButtonStyle())
    }
}
