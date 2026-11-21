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
        List {
            if let message = stationModel.state.errorMessage, station == nil {
                ErrorView(message: message) { retry += 1 }
            } else if let station {
                header(station)
                departuresSection
                platformsSection
            } else {
                ProgressView().frame(maxWidth: .infinity)
            }
        }
        .navigationTitle(fromPlatform?.name ?? station?.name ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if target.from == nil && !multi {
                ToolbarItem(placement: .topBarTrailing) {
                    Picker("View", selection: Bindable(settings).departuresView) {
                        ForEach(DeparturesView.allCases) { Label($0.title, systemImage: $0.symbol).tag($0) }
                    }
                    .pickerStyle(.menu)
                }
            }
        }
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
        Section {
            VStack(alignment: .leading, spacing: 8) {
                if let platform = fromPlatform {
                    if !platform.headsigns.isEmpty {
                        Text("→ " + platform.headsigns.joined(separator: ", ")).font(.subheadline).foregroundStyle(.secondary)
                    }
                    LineBadges(lines: platform.routes.filter { !multi || target.lines.contains($0.routeId) })
                } else {
                    Text(multi ? "Selected lines" : "\(platforms.count) \(platforms.count == 1 ? "stop" : "stops") here").font(.subheadline).foregroundStyle(.secondary)
                    LineBadges(lines: multi ? station.routes.filter { target.lines.contains($0.routeId) } : station.routes)
                }
            }
        }
    }

    private var departuresSection: some View {
        Section {
            timeControls
            if !departuresModel.loaded, departuresModel.state.errorMessage == nil {
                ProgressView().frame(maxWidth: .infinity)
            } else if let message = departuresModel.state.errorMessage, departuresModel.departures.isEmpty {
                ErrorView(message: message) { await departuresModel.load(request) }
            } else {
                // A second-resolution clock drives the countdowns; a chosen time stays fixed
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    departureRows(now: reference ?? context.date)
                }
            }
        } header: {
            Text("Departures")
        }
    }

    @ViewBuilder
    private var timeControls: some View {
        Toggle("Choose a time", isOn: $chooseTime.animation())
        if chooseTime {
            DatePicker("Time", selection: $picked, displayedComponents: [.date, .hourAndMinute])
                .environment(\.timeZone, TimeFormat.budapest)
        }
        if !terminus {
            Toggle("Show arrivals", isOn: $showArrivals)
        }
    }

    @ViewBuilder
    private func departureRows(now: Foundation.Date) -> some View {
        let fixed = reference != nil
        let all = distinctDepartures()
        let visible = tracker.visible(all, now: now, reference: reference)
        if visible.isEmpty {
            Text("No departures").foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .center)
        } else if board {
            ForEach(LineBoardGrouping.rows(visible), id: \.key) { row in
                NavigationLink(value: StationTarget(
                    stationId: target.stationId, from: row.list[0].stopId,
                    lines: row.list[0].route.map { [$0.routeId] } ?? [], reference: reference
                )) {
                    LineBoardRow(list: row.list, now: now, fixed: fixed)
                }
            }
        } else {
            // Rows still counting down after leaving don't use up a slot
            let leaving = fixed ? 0 : visible.filter { $0.time < now }.count
            ForEach(visible.prefix(shown + leaving)) { d in
                DepartureRow(departure: d, now: now, fixed: fixed)
            }
            if all.count >= shown {
                Button("Show more") { more += 1 }
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
            Section("Stops here") {
                ForEach(platforms) { platform in
                    NavigationLink(value: StationTarget(stationId: target.stationId, from: platform.stopId, lines: target.lines, reference: reference)) {
                        PlatformRow(platform: platform, highlighted: platform.stopId == target.from)
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
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(platform.headsigns.isEmpty ? "Terminus" : "→ " + platform.headsigns.prefix(3).joined(separator: ", "))
                    .font(.subheadline.weight(.medium))
                    .lineLimit(2)
                if let code = platform.code, code != platform.stopId {
                    Text(code).font(.caption).foregroundStyle(.secondary)
                }
                if highlighted { Spacer(); Image(systemName: "checkmark").foregroundStyle(Color.accentColor) }
            }
            LineBadges(lines: platform.routes)
        }
        .padding(.vertical, 2)
    }
}
