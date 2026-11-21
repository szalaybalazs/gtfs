//
//  TripView.swift
//  timetable
//
//  One vehicle's run: where it is, when it reaches each stop (web/src/pages/TripPage.tsx).
//

import SwiftUI
import CoreLocation

// TODO(match web): the vehicle marker and the line's fade cut must come from the vehicle's reported position, like web/src/pages/TripPage.tsx:
//  - with a position fix: snap it onto the stop-to-stop path (stop units, 2.4 = 40 % from stop 2 to 3); it stays put until the next fix
//    (no extrapolation) and a step back of a stop or less is ignored
//  - without one (metro): spread it along the timetable as now
//  - greying of stops, the line's fade cut and the marker all come from that one position
struct TripView: View {
    let target: TripTarget
    @State private var model = TripViewModel()
    @State private var retry = 0
    /// Stops 1...foldEnd are folded away. Decided once, when the trip first loads (the vehicle moving on doesn't fold more); a tap opens them for good.
    @State private var foldEnd: Int?
    @State private var foldChecked = false

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
        .onChange(of: model.trip?.tripId, initial: true) { _, id in
            guard id != nil, !foldChecked, let trip = model.trip else { return }
            foldChecked = true
            foldEnd = Self.foldEnd(trip.stops, now: Date())
        }
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
        // More than 10 greyed-out stops: keep the first and the last two before the vehicle (and the stop you came from), fold the rest
        // (Before it is decided, the current position stands in for it so the first frame is already folded.)
        let end = foldChecked ? foldEnd : Self.foldEnd(stops, now: now)
        let fromIndex = stops.firstIndex { $0.stopId == target.from }
        func isFolded(_ i: Int) -> Bool { if let end { return i >= 1 && i <= end && i != fromIndex } else { return false } }
        // How far along the vehicle is between the stop it left and the next one, 0...1; the line is faded up to that point
        let p: Double = {
            guard started && !finished, nextIndex > 0 else { return 0 }
            let span = stops[nextIndex].arrival.timeIntervalSince(stops[nextIndex - 1].departure)
            return span > 0 ? min(1, max(0, now.timeIntervalSince(stops[nextIndex - 1].departure) / span)) : 0.5
        }()
        func greyTo(_ i: Int) -> CGFloat {
            if finished { return 48 }
            if !started { return 0 }
            if i < nextIndex - 1 { return 48 }
            if i == nextIndex - 1 { return min(48, 24 + 48 * p) }
            if i == nextIndex { return max(0, 48 * p - 24) }
            return 0
        }
        func run(_ i: Int) -> Int { var n = 0; while isFolded(i + n) { n += 1 }; return n }
        return VStack(spacing: 24) {
            header(trip, stops: stops, started: started, finished: finished,
                   delay: started && !finished ? Self.delay(stops, upTo: nextIndex) : nil, now: now)
            if let r = trip.route { AlertsSection(routeIds: [r.routeId]) }
            VStack(spacing: 0) {
                SectionTitle("Stops")
                Card {
                    VStack(spacing: 0) {
                        ForEach(Array(stops.enumerated()), id: \.element.id) { i, stop in
                            if isFolded(i) {
                                if !isFolded(i - 1) {
                                    FoldRow(count: run(i), color: color, indented: reference != nil) { withAnimation { foldEnd = nil; foldChecked = true } }
                                }
                            } else {
                                TripStopRow(
                                    stop: stop, trip: trip, first: i == 0, last: i == stops.count - 1,
                                    passed: nextIndex == -1 || i < nextIndex,
                                    highlighted: stop.stopId == target.from,
                                    color: color, referenceTime: reference?.departure, showSeconds: hasSeconds, greyTo: greyTo(i),
                                    vehicle: started && !finished && i == nextIndex ? VehicleMark(line: trip.route, color: color, progress: p) : nil
                                )
                                .zIndex(started && !finished && i == nextIndex ? 1 : 0)
                            }
                        }
                    }
                    .padding(.vertical, 8)
                }
            }
            if let v = model.vehicle, v.model != nil || v.plate != nil {
                TripVehicleCard(vehicle: v)
            }
            if !model.path.isEmpty || stops.contains(where: { $0.lat != nil }) {
                VStack(spacing: 0) {
                    SectionTitle("Map")
                    TripMiniMap(trip: trip, vehicle: model.vehicle, path: model.path, color: color)
                }
            }
        }
    }

    /// Stops 1...n are folded when more than 10 are behind the vehicle: the first stop and the last two before it stay.
    static func foldEnd(_ stops: [TripStop], now: Date) -> Int? {
        guard let next = stops.firstIndex(where: { $0.departure > now }), next > 10 else { return nil }
        return next - 3
    }

    private func header(_ trip: Trip, stops: [TripStop], started: Bool, finished: Bool, delay: Int?, now: Date) -> some View {
        let live = stops.contains { $0.realtime }
        let via = Self.viaStops(stops)
        return Card {
            VStack(alignment: .leading, spacing: 0) {
                // Line, destination, and top right: on time / late / early (or Scheduled; or a note for a past or upcoming trip)
                HStack(alignment: .center, spacing: 8) {
                    if let route = trip.route ?? target.route { LineBadge(line: route) }
                    Text(trip.headsign ?? stops.last?.name ?? "")
                        .font(.system(size: 20, weight: .bold)).lineLimit(2).frame(maxWidth: .infinity, alignment: .leading)
                    if let last = stops.last, finished {
                        Text("Past trip").font(.system(size: 13)).foregroundStyle(Theme.secondary)
                            .accessibilityLabel(tr("Past trip, ended \(TimeFormat.clock(last.arrival))"))
                    } else if let first = stops.first, !started {
                        // Scheduled, not running yet: when it leaves, on two lines so it never wraps oddly
                        TimelineView(.periodic(from: .now, by: 15)) { ctx in
                            let secs = first.departure.timeIntervalSince(ctx.date)
                            VStack(alignment: .trailing, spacing: 0) {
                                Text("Scheduled").font(.system(size: 13, weight: .medium))
                                Text(secs < 3600 ? tr("departing in \(max(1, Int((secs / 60).rounded(.up)))) min") : tr("departing at \(TimeFormat.clock(first.departure))"))
                                    .font(.system(size: 13))
                            }
                            .foregroundStyle(Theme.secondary).lineLimit(1).fixedSize()
                        }
                    } else if let delay {
                        TripDelayText(minutes: delay).font(.system(size: 15))
                    } else if started && !live {
                        Text("Scheduled").font(.system(size: 13, weight: .medium)).foregroundStyle(Theme.secondary)
                            .padding(.horizontal, 10).padding(.vertical, 2).background(Theme.fill, in: Capsule())
                    }
                }
                if !via.isEmpty {
                    Text(via.joined(separator: " ▸ ")).font(.system(size: 15)).foregroundStyle(Theme.secondary).padding(.top, 4)
                }
                if let stats = Self.stats(stops, path: model.path) {
                    Text(stats).font(.system(size: 15, weight: .medium)).monospacedDigit().padding(.top, 8)
                }
                // Last update: small and quiet
                if started && !finished, let updated = model.vehicle?.updated {
                    let age = max(0, Int(now.timeIntervalSince(updated)))
                    Text(age < 60 ? tr("Updated \(age)s ago") : tr("Updated \(age / 60) min ago"))
                        .font(.system(size: 12)).foregroundStyle(Theme.secondary).monospacedDigit().padding(.top, 4)
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

    /// "34 min · 12.4 km · 23 stops": the distance follows the route shape when there is one, else straight lines between stops (marked ~).
    static func stats(_ stops: [TripStop], path: [CLLocationCoordinate2D]) -> String? {
        guard stops.count >= 2, let a = stops.first, let b = stops.last else { return nil }
        let minutes = Int((b.arrival.timeIntervalSince(a.departure) / 60).rounded())
        func length(_ pts: [CLLocationCoordinate2D]) -> Double {
            zip(pts, pts.dropFirst()).reduce(0) { $0 + CLLocation(latitude: $1.0.latitude, longitude: $1.0.longitude).distance(from: CLLocation(latitude: $1.1.latitude, longitude: $1.1.longitude)) }
        }
        let stopPoints = stops.compactMap { s in s.lat.flatMap { la in s.lon.map { CLLocationCoordinate2D(latitude: la, longitude: $0) } } }
        let metres = path.count > 1 ? length(path) : length(stopPoints)
        guard metres > 0 else { return tr("\(minutes) min · \(stops.count) stops") }
        let km = (path.count > 1 ? "" : "~") + String(format: "%.1f km", metres / 1000)
        return tr("\(minutes) min · \(km) · \(stops.count) stops")
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
    /// The line is faded from the top of the row down to here (0...48); the rest is in colour.
    var greyTo: CGFloat = 0
    var vehicle: VehicleMark? = nil

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
                        .opacity(passed ? 0.45 : 1)
                }
                ZStack {
                    let top: CGFloat = first ? 24 : 0, bottom: CGFloat = last ? 24 : 48
                    let cut = min(max(greyTo, top), bottom)
                    VStack(spacing: 0) {
                        Color.clear.frame(height: top)
                        color.opacity(0.45).frame(height: cut - top)
                        color.frame(height: bottom - cut)
                        Color.clear.frame(height: 48 - bottom)
                    }
                    .frame(width: 8)
                    Circle().fill(Theme.surface)
                        .overlay(Circle().strokeBorder(highlighted ? Color.primary : color, lineWidth: 2))
                        .frame(width: highlighted ? 16 : 10, height: highlighted ? 16 : 10)
                        .opacity(passed ? 0.45 : 1)
                }
                .frame(width: 28, height: 48)
                .overlay(alignment: .top) {
                    // Above this stop, by how far the vehicle is from the previous one
                    if let vehicle { vehicle.offset(y: 48 * vehicle.progress - 38) }
                }
                .padding(.trailing, 6)
                Text(s.name).font(.system(size: 17, weight: highlighted ? .bold : .regular)).lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading).padding(.trailing, 8)
                    .opacity(passed ? 0.45 : 1)
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
                .opacity(passed ? 0.45 : 1)
                Chevron().opacity(passed ? 0.45 : 1)
            }
            .padding(.trailing, 12)
            .background(highlighted ? Theme.accent.opacity(0.08) : Color.clear)
        }
        .buttonStyle(RowButtonStyle())
    }
}

/// The vehicle on the stop list: its pictogram on a white disc in the line's colour.
struct VehicleMark: View {
    let line: LineRef?
    let color: Color
    /// 0 = just left the previous stop, 1 = at this one.
    let progress: Double

    var body: some View {
        ZStack {
            Circle().fill(Theme.surface).shadow(color: .black.opacity(0.25), radius: 3, y: 1)
            if let line { ModeIcon(category: LineCategory.of(line), size: 22, flat: color) }
        }
        .frame(width: 28, height: 28)
        .accessibilityLabel(tr("Vehicle"))
    }
}

/// "12 earlier stops": the line runs dashed through it. Tapping opens the stops.
private struct FoldRow: View {
    let count: Int
    let color: Color
    let indented: Bool
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            HStack(spacing: 0) {
                if indented { Color.clear.frame(width: 34).padding(.leading, 8) }
                // Dashes with the same gap at both ends as between them: 4 + 4 x 6 + 3 x 4 + 4
                VStack(spacing: 4) {
                    ForEach(0..<4, id: \.self) { _ in Rectangle().fill(color.opacity(0.45)).frame(width: 8, height: 6) }
                }
                .padding(.vertical, 4)
                .frame(width: 28, height: 44)
                .padding(.trailing, 6)
                Text(tr("\(count) earlier stops")).font(.system(size: 15, weight: .medium)).foregroundStyle(Theme.accent)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.trailing, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(RowButtonStyle())
    }
}
