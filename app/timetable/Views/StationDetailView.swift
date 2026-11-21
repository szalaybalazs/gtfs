//
//  StationDetailView.swift
//  timetable
//
//  A stop group (or one of its platforms): departures as a Lines board or a Timeline,
//  then the platforms (web/src/pages/StationPage.tsx).
//

import SwiftUI
import Flow

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
            after: reference,
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
        .task(id: "\(target.stationId)|\(retry)") { await stationModel.load(id: target.stationId) }
        // Re-runs (and cancels the old refresh loop) whenever what is asked for changes
        .task(id: request) {
            guard station != nil || target.from != nil else { return }
            await departuresModel.run(request)
        }
        .refreshable { await departuresModel.load(request) }
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

    @ViewBuilder
    private var timeControls: some View {
        VStack(spacing: 0) {
            Toggle("Choose a time", isOn: $chooseTime.animation())
                .font(.system(size: 15))
                .padding(.horizontal, 16).padding(.vertical, 8)
            if chooseTime {
                DatePicker("Time", selection: $picked, displayedComponents: [.date, .hourAndMinute])
                    .font(.system(size: 15))
                    .environment(\.timeZone, TimeFormat.budapest)
                    .padding(.horizontal, 16).padding(.vertical, 4)
            }
            if !terminus {
                Toggle("Show arrivals", isOn: $showArrivals)
                    .font(.system(size: 15))
                    .padding(.horizontal, 16).padding(.vertical, 8)
            }
        }
    }

    @ViewBuilder
    private func departureRows(now: Foundation.Date) -> some View {
        let fixed = reference != nil
        let all = distinctDepartures()
        let visible = tracker.visible(all, now: now, reference: reference)
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
        if !platforms.isEmpty {
            VStack(spacing: 0) {
                SectionTitle("Stops here")
                Card {
                    RowList(data: platforms, id: \.stopId) { platform in
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
