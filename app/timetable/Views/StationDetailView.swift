//
//  StationDetailView.swift
//  timetable
//
//  A stop group (or one of its platforms): departures as a Lines board or a Timeline,
//  then the platforms (web/src/pages/StationPage.tsx).
//

import SwiftUI
import Flow
import TimetableAPI

struct StationDetailView: View {
    let target: StationTarget

    @Environment(AppSettings.self) private var settings
    @State private var stationModel = StationViewModel()
    @State private var departuresModel = DeparturesViewModel()
    @State private var tracker = DepartureTracker()
    @State private var retry = 0
    @State private var chooseTime: Bool
    @State private var picked: Foundation.Date
    @State private var showArrivals = false
    @State private var more = 0
    /// "⋯ Earlier": the list starts at this (earlier) departure.
    @State private var earlier: Foundation.Date?
    @State private var earlierBusy = false
    @State private var earlierNone = false
    @State private var timeSheet = false

    init(target: StationTarget) {
        self.target = target
        _chooseTime = State(initialValue: target.reference != nil)
        _picked = State(initialValue: target.reference ?? Foundation.Date())
    }

    private var station: Station? { stationModel.station }
    private var multi: Bool { !target.lines.isEmpty }

    private func serves(_ p: Platform) -> Bool {
        !multi || p.routes.contains { target.lines.contains($0.routeId) }
    }

    private var platforms: [Platform] { (station?.sortedPlatforms ?? []).filter(serves) }
    private var fromPlatform: Platform? { station?.platforms.first { $0.stopId == target.from } }

    /// A terminus platform: nothing departs, so arrivals always show.
    private var terminus: Bool { fromPlatform?.isTerminus ?? false }
    private var arrivals: Bool { terminus || showArrivals }

    /// The reference time ("count from here"); nil = now.
    private var reference: Foundation.Date? { chooseTime ? Self.minute(picked) : nil }

    /// A whole stop group can be a board; one platform or chosen lines is a plain list.
    private var board: Bool { target.from == nil && !multi && settings.departuresView == .lines }
    private var shown: Int { (target.from != nil ? 10 : 20) + more * 20 }

    private var request: DeparturesRequest {
        let ids = target.from.map { [$0] } ?? platforms.map(\.stopId)
        return DeparturesRequest(
            stopIds: ids,
            routeIds: multi ? target.lines : nil,
            limit: board ? 300 : shown + 5,
            after: earlier ?? reference,
            // A single platform always asks for arrivals (we may not know it's a terminus yet); rows that end here are dropped unless wanted
            arrivals: arrivals || target.from != nil,
            perLine: board ? 4 : nil
        )
    }

    private static func minute(_ d: Foundation.Date) -> Foundation.Date {
        Foundation.Date(timeIntervalSince1970: (d.timeIntervalSince1970 / 60).rounded(.down) * 60)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                if let message = stationModel.state.errorMessage, station == nil {
                    ErrorView(message: message) { retry += 1 }
                } else if let station {
                    header(station)
                    departuresSection
                    platformsSection
                } else {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                }
            }
            .padding(16)
        }
        .background(Theme.canvas)
        .navigationTitle(fromPlatform?.name ?? station?.name ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { FavoriteButton(options: favoriteOptions) } }
        .task(id: "\(target.stationId)|\(retry)") { await stationModel.load(id: target.stationId) }
        // Re-runs (and cancels the old refresh loop) whenever what is asked for changes
        .task(id: request) {
            guard station != nil || target.from != nil else { return }
            await departuresModel.run(request)
        }
        .refreshable { await departuresModel.load(request) }
    }

    /// What the star can save here (web: StationPage favoriteOptions).
    private var favoriteOptions: [Favorite] {
        guard let station else { return [] }
        if multi {
            let selected = station.routes.filter { target.lines.contains($0.routeId) }
            guard !selected.isEmpty else { return [] }
            return [Favorite.lines(selected, stationId: station.stationId,
                                   stopIds: fromPlatform.map { [$0.stopId] } ?? platforms.map(\.stopId),
                                   from: fromPlatform?.stopId, name: fromPlatform?.name ?? station.name,
                                   headsigns: fromPlatform?.headsigns ?? [])]
        }
        guard let stop = fromPlatform ?? (platforms.count == 1 ? platforms[0] : nil) else { return [] }
        return [Favorite.stop(stop, stationId: station.stationId)] + stop.routes.map {
            Favorite.lineStop(route: $0, stopId: stop.stopId, stationId: station.stationId, stopName: stop.name ?? stop.stopId, headsign: nil)
        }
    }

    // MARK: Sections

    @ViewBuilder
    private func header(_ station: Station) -> some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                if let platform = fromPlatform {
                    Text(platform.name ?? station.name).font(.system(size: 22, weight: .bold))
                    if !platform.headsigns.isEmpty {
                        Text("towards " + platform.headsigns.joined(separator: " / ")).font(.system(size: 15)).foregroundStyle(Theme.secondary)
                    }
                    LineBadges(lines: platform.routes.filter { !multi || target.lines.contains($0.routeId) })
                } else {
                    Text(station.name).font(.system(size: 22, weight: .bold))
                    Text(multi ? "Selected lines" : "\(platforms.count) \(platforms.count == 1 ? "stop" : "stops") here")
                        .font(.system(size: 15)).foregroundStyle(Theme.secondary)
                    LineBadges(lines: multi ? station.routes.filter { target.lines.contains($0.routeId) } : station.routes)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
        }
    }

    private var departuresSection: some View {
        VStack(spacing: 0) {
            SectionTitle(title: "Departures") {
                if target.from == nil && !multi { viewSwitch }
            }
            Card {
                timeControls
                Rectangle().fill(Theme.separator).frame(height: 1 / UIScreen.main.scale)
                if !departuresModel.loaded, departuresModel.state.errorMessage == nil {
                    ProgressView().frame(maxWidth: .infinity).padding(24)
                } else if let message = departuresModel.state.errorMessage, departuresModel.departures.isEmpty {
                    ErrorView(message: message) { await departuresModel.load(request) }
                } else {
                    // A second-resolution clock drives the countdowns; a chosen time stays fixed
                    TimelineView(.periodic(from: .now, by: 1)) { context in
                        departureRows(now: reference ?? context.date)
                    }
                }
            }
        }
    }

    /// Two plain icons by the heading; the chosen view is accent-coloured with a dot under it that slides across.
    private var viewSwitch: some View {
        let isBoard = settings.departuresView == .lines
        return HStack(spacing: 4) {
            ForEach(DeparturesView.allCases) { v in
                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) { settings.departuresView = v }
                } label: {
                    Image(systemName: v.symbol)
                        .font(.system(size: 17))
                        .foregroundStyle((v == .lines) == isBoard ? Theme.accent : Theme.secondary.opacity(0.7))
                        .frame(width: 32, height: 32)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(v.title)
            }
        }
        .overlay(alignment: .bottomLeading) {
            Circle().fill(Theme.accent).frame(width: 4, height: 4)
                .offset(x: 14 + (isBoard ? 0 : 36), y: 2)
        }
    }

    /// One compact row: time picker on the left, chips on the right (web: AfterFilter).
    private var timeControls: some View {
        HStack(spacing: 12) {
            Button { timeSheet = true } label: {
                HStack(spacing: 6) {
                    Image(systemName: "clock").font(.system(size: 16))
                    Text(timeLabel).font(.system(size: 15, weight: .semibold)).monospacedDigit()
                }
                .foregroundStyle(chooseTime ? Theme.accent : Color.primary)
            }
            .buttonStyle(.plain)
            Spacer(minLength: 0)
            if !terminus {
                Button { showArrivals.toggle() } label: {
                    Text("Arrivals")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(showArrivals ? Color.white : Color.primary)
                        .padding(.horizontal, 10).padding(.vertical, 2)
                        .background(showArrivals ? Theme.accent : Theme.fill, in: Capsule())
                }
                .buttonStyle(.plain)
            }
            if !board && !earlierNone {
                Button { Task { await loadEarlier() } } label: {
                    Text("⋯ Earlier").font(.system(size: 15, weight: .medium)).foregroundStyle(Theme.accent)
                }
                .buttonStyle(.plain)
                .disabled(earlierBusy)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .sheet(isPresented: $timeSheet) {
            TimePickerSheet(initial: chooseTime ? picked : Foundation.Date()) { choice in
                earlier = nil; earlierNone = false
                if let choice { picked = choice; chooseTime = true } else { chooseTime = false }
            }
        }
    }

    private var timeLabel: String {
        guard chooseTime else { return "Now" }
        let at = Self.minute(picked)
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeFormat.budapest
        let time = "From " + TimeFormat.clock(at)
        if cal.isDateInToday(at) { return time }
        let f = DateFormatter(); f.timeZone = TimeFormat.budapest; f.dateFormat = "EEE d MMM"
        return f.string(from: at) + ", " + time
    }

    /// Finds the last departure before what is on screen and starts the list there: one more row per tap.
    private func loadEarlier() async {
        let ids = request.stopIds
        guard !earlierBusy, !ids.isEmpty else { return }
        earlierBusy = true
        defer { earlierBusy = false }
        let start = earlier ?? reference ?? Self.minute(Foundation.Date())
        let edge = start.addingTimeInterval(-60)
        for minutes in [15, 60, 180] {
            let from = edge.addingTimeInterval(-Double(minutes) * 60)
            guard let data = try? await Network.shared.fetch(DeparturesQuery(
                stopIds: ids, routeIds: request.routeIds.map { .some($0) } ?? .null, limit: .some(200),
                hours: .some((minutes + 59) / 60), after: .some(APIDate.format(from)),
                arrivals: .some(true), perLine: .null)) else { return }
            let before = data.departures.compactMap { APIDate.parse($0.departure) }.filter { $0 < edge }
            if let last = before.max() { earlier = last; return }
        }
        earlierNone = true
    }

    @ViewBuilder
    private func departureRows(now: Foundation.Date) -> some View {
        let fixed = reference != nil
        let all = distinctDepartures()
        let visible = tracker.visible(all, now: now, reference: earlier ?? reference)
        if visible.isEmpty {
            Text("No departures").foregroundStyle(Theme.secondary).frame(maxWidth: .infinity).padding(24)
        } else if board {
            let rows = LineBoardGrouping.rows(visible)
            RowList(data: rows, id: \.key) { row in
                NavigationLink(value: StationTarget(
                    stationId: target.stationId, from: row.list[0].stopId,
                    lines: row.list[0].route.map { [$0.routeId] } ?? [], reference: reference
                )) {
                    LineBoardRow(list: row.list, now: now, fixed: fixed)
                }
                .buttonStyle(RowButtonStyle())
            }
        } else {
            // Rows still counting down after leaving don't use up a slot
            let leaving = fixed ? 0 : visible.filter { $0.time < now }.count
            RowList(data: Array(visible.prefix(shown + leaving)), id: \.id) { d in
                NavigationLink(value: TripTarget(tripId: d.tripId, serviceDate: d.serviceDate, from: d.stopId, route: d.route, headsign: d.headsign)) {
                    DepartureRow(departure: d, now: now, fixed: fixed, mine: d.tripId == target.trip)
                }
                .buttonStyle(RowButtonStyle())
            }
            if all.count >= shown {
                Rectangle().fill(Theme.separator).frame(height: 1 / UIScreen.main.scale)
                Button { more += 1 } label: {
                    Text("Show more").font(.system(size: 15, weight: .medium)).foregroundStyle(Theme.accent)
                        .frame(maxWidth: .infinity).padding(.vertical, 12)
                }
                .buttonStyle(RowButtonStyle())
            }
        }
    }

    /// Arrivals only when wanted; a trip calling at two platforms of the group shows once (its first stop here).
    private func distinctDepartures() -> [Departure] {
        var seen = Set<String>()
        return departuresModel.departures.filter { d in
            guard arrivals || !d.terminates else { return false }
            return seen.insert("\(d.tripId)|\(d.serviceDate)").inserted
        }
    }

    @ViewBuilder
    private var platformsSection: some View {
        // Arrival-only platforms only when you came from a trip (or are looking at one)
        let listed = platforms.filter { !$0.isTerminus || target.trip != nil || $0.stopId == target.from }
        if !listed.isEmpty {
            VStack(spacing: 0) {
                SectionTitle("Stops here")
                Card {
                    RowList(data: listed, id: \.stopId) { platform in
                        NavigationLink(value: StationTarget(stationId: target.stationId, from: platform.stopId, lines: target.lines, reference: reference)) {
                            PlatformRow(platform: platform, highlighted: platform.stopId == target.from)
                        }
                        .buttonStyle(RowButtonStyle())
                    }
                }
            }
        }
    }
}

struct PlatformRow: View {
    let platform: Platform
    var highlighted = false

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(platform.headsigns.isEmpty ? "Terminus · arrivals only" : "towards " + platform.headsigns.joined(separator: " / "))
                    .font(.system(size: 15, weight: highlighted ? .bold : .medium)).lineLimit(2)
                LineBadges(lines: platform.routes)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Chevron()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}

/// Hour and minute wheels; the day is a second, collapsed step. "Now" clears the chosen time.
struct TimePickerSheet: View {
    let initial: Foundation.Date
    let done: (Foundation.Date?) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var time: Foundation.Date
    @State private var pickDay = false

    init(initial: Foundation.Date, done: @escaping (Foundation.Date?) -> Void) {
        self.initial = initial
        self.done = done
        _time = State(initialValue: initial)
    }

    private var calendar: Calendar { var c = Calendar(identifier: .gregorian); c.timeZone = TimeFormat.budapest; return c }

    private func dayLabel(_ d: Foundation.Date) -> String {
        if calendar.isDateInToday(d) { return "Today" }
        if calendar.isDateInTomorrow(d) { return "Tomorrow" }
        let f = DateFormatter(); f.timeZone = TimeFormat.budapest; f.dateFormat = "EEEE d MMM"
        return f.string(from: d)
    }

    var body: some View {
        VStack(spacing: 8) {
            Text("Show departures from").font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.secondary).padding(.top, 20)
            DatePicker("", selection: $time, displayedComponents: .hourAndMinute)
                .datePickerStyle(.wheel).labelsHidden()
                .environment(\.timeZone, TimeFormat.budapest)
            Button { withAnimation { pickDay.toggle() } } label: {
                HStack {
                    Text("Day").foregroundStyle(Theme.secondary)
                    Spacer()
                    Text(dayLabel(time) + (pickDay ? " ▴" : " ▾")).fontWeight(.medium)
                }
                .font(.system(size: 15)).padding(.horizontal, 12).padding(.vertical, 6)
            }
            .buttonStyle(.plain)
            if pickDay {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(0..<7, id: \.self) { i in
                            let day = Foundation.Date().addingTimeInterval(Double(i) * 86_400)
                            let on = calendar.isDate(day, inSameDayAs: time)
                            Button { time = move(time, toDayOf: day) } label: {
                                Text(dayLabel(day)).font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(on ? Color.white : Color.primary)
                                    .padding(.horizontal, 12).padding(.vertical, 4)
                                    .background(on ? Theme.accent : Theme.fill, in: Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 12)
                }
            }
            HStack(spacing: 8) {
                Button { done(nil); dismiss() } label: {
                    Text("Now").fontWeight(.medium).frame(maxWidth: .infinity).padding(.vertical, 10)
                        .background(Theme.fill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                Button { done(time); dismiss() } label: {
                    Text("Show").fontWeight(.semibold).foregroundStyle(.white).frame(maxWidth: .infinity).padding(.vertical, 10)
                        .background(Theme.accent, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 12).padding(.bottom, 12)
        }
        .presentationDetents([.height(pickDay ? 420 : 380)])
    }

    private func move(_ t: Foundation.Date, toDayOf day: Foundation.Date) -> Foundation.Date {
        let hm = calendar.dateComponents([.hour, .minute], from: t)
        var d = calendar.dateComponents([.year, .month, .day], from: day)
        d.hour = hm.hour; d.minute = hm.minute
        return calendar.date(from: d) ?? t
    }
}
