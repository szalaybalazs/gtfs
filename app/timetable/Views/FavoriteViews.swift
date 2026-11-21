//
//  FavoriteViews.swift
//  timetable
//
//  Favourite cards and the add/remove sheet (web/src/components/FavoriteCards.tsx, FavoriteSheet.tsx).
//

import SwiftUI
import TimetableAPI

/// How many upcoming departures a favourite row shows.
private let maxTimes = 8

/// Upcoming departures in time order, back-to-back ones of the same line merged: [1] 1', 5'  [2] 7'  [1] 10'.
private func runs(_ departures: [Departure], now: Foundation.Date, only: Set<String>?) -> [(route: LineRef, times: [Departure])] {
    var out: [(route: LineRef, times: [Departure])] = []
    let upcoming = departures
        .filter { d in d.route != nil && (only == nil || only!.contains(d.route!.routeId)) && d.departure >= now.addingTimeInterval(-30) }
        .sorted { $0.departure < $1.departure }
        .prefix(maxTimes)
    for d in upcoming {
        if let last = out.last, last.route.routeId == d.route!.routeId { out[out.count - 1].times.append(d) }
        else { out.append((d.route!, [d])) }
    }
    return out
}

/// One time on a single line: "10s", "10'", "2½'", "17:23" (an hour or more away), live mark after it when tracked live.
private struct ShortTime: View {
    let departure: Departure
    let now: Foundation.Date

    var body: some View {
        let s = departure.departure.timeIntervalSince(now)
        let live = RealtimeStatus(realtime: departure.realtime, delay: departure.delay) != .scheduled
        let text = s < 0 ? tr("-\(Int((-s).rounded(.up)))s")
            : s >= 3600 ? TimeFormat.clock(departure.departure)
            : s < 60 ? tr("\(Int(s.rounded()))s")
            : "\(Countdown.upcoming(s).value)'"
        HStack(alignment: .top, spacing: 2) {
            Text(text).font(.system(size: 17, weight: .semibold)).monospacedDigit().lineLimit(1).fixedSize()
            if live && s >= 0 { LiveIcon(size: 10).foregroundStyle(Theme.secondary).padding(.top, 2) }
        }
        .opacity(s < 0 ? 0.45 : 1)
    }
}

/// The one favourites layout, in time order. Side-scrollable when it doesn't fit; times coloured by realtime status.
private struct LineTimesRow: View {
    let departures: [Departure]
    let pending: Bool
    var only: Set<String>? = nil
    let fallback: [LineRef]

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let groups = runs(departures, now: context.date, only: only)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    if pending || groups.isEmpty {
                        ForEach(fallback, id: \.routeId) { r in
                            HStack(spacing: 6) {
                                LineBadge(line: r, fit: true)
                                Text(pending ? "…" : "–").font(.system(size: 15)).foregroundStyle(Theme.secondary)
                            }
                        }
                    } else {
                        ForEach(Array(groups.enumerated()), id: \.offset) { _, g in
                            HStack(spacing: 4) {
                                LineBadge(line: g.route, fit: true)
                                // One-line times with the live mark after them; full colour
                                HStack(alignment: .firstTextBaseline, spacing: 8) {
                                    ForEach(Array(g.times.enumerated()), id: \.element.id) { _, d in
                                        ShortTime(departure: d, now: context.date)
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
            }
            .padding(.horizontal, -16)
        }
    }
}

/// A bigger favourite: a row per line (its next times) or one departure per row in time order; as many rows as its size allows.
private struct FavoriteRowsList: View {
    let departures: [Departure]
    let pending: Bool
    var only: Set<String>? = nil
    let fallback: [LineRef]
    let grouping: FavGrouping
    let rows: Int

    private struct Row: Identifiable { let id: String; let line: LineRef; let headsign: String?; let times: [Departure] }

    private func build(now: Foundation.Date) -> [Row] {
        let upcoming = departures
            .filter { d in d.route != nil && (only == nil || only!.contains(d.route!.routeId)) && d.departure >= now.addingTimeInterval(-30) }
            .sorted { $0.departure < $1.departure }
        if grouping == .time {
            return upcoming.prefix(rows).map { Row(id: $0.id, line: $0.route!, headsign: $0.headsign, times: [$0]) }
        }
        var order: [String] = []
        var groups: [String: [Departure]] = [:]
        for d in upcoming {
            let k = d.route!.routeId
            if groups[k] == nil { order.append(k) }
            groups[k, default: []].append(d)
        }
        return order.prefix(rows).map { k in
            let list = Array(groups[k]!.prefix(4))
            return Row(id: k, line: list[0].route!, headsign: list[0].headsign, times: list)
        }
    }

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let list = build(now: context.date)
            VStack(alignment: .leading, spacing: 8) {
                if pending || list.isEmpty {
                    HStack(spacing: 10) {
                        ForEach(fallback, id: \.routeId) { r in
                            HStack(spacing: 6) {
                                LineBadge(line: r, fit: true)
                                Text(pending ? "…" : "–").font(.system(size: 15)).foregroundStyle(Theme.secondary)
                            }
                        }
                    }
                } else {
                    ForEach(list) { row in
                        HStack(spacing: 8) {
                            LineBadge(line: row.line, fit: true)
                            Text(row.headsign ?? "").font(.system(size: 13)).foregroundStyle(Theme.secondary).lineLimit(1)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            HStack(spacing: 8) { ForEach(row.times) { ShortTime(departure: $0, now: context.date) } }
                        }
                    }
                }
            }
        }
    }
}

/// A small yellow "Disruption" pill, shown while an alert for these lines / stops is in effect.
private struct DisruptionTag: View {
    let routeIds: [String]
    let stopIds: [String]
    @State private var active = false

    var body: some View {
        Group {
            if active {
                HStack(spacing: 4) {
                    Image(systemName: "exclamationmark.triangle").font(.system(size: 11, weight: .semibold))
                    Text("Disruption").font(.system(size: 12, weight: .semibold))
                }
                .foregroundStyle(AlertStyle.text)
                .padding(.horizontal, 6).frame(height: 20)
                .background(AlertStyle.background, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
                .fixedSize()
            } else {
                Color.clear.frame(width: 0, height: 0) // something for `.task` to hang on
            }
        }
        .task(id: routeIds + stopIds) { active = await Self.isActive(routeIds: routeIds, stopIds: stopIds) }
    }

    /// Started and not yet over; a missing start or end counts as open.
    static func isActive(routeIds: [String], stopIds: [String]) async -> Bool {
        guard !routeIds.isEmpty || !stopIds.isEmpty else { return false }
        guard let data = try? await Network.shared.fetch(AlertsQuery(
            routeIds: routeIds.isEmpty ? .null : .some(routeIds), stopIds: stopIds.isEmpty ? .null : .some(stopIds), lang: .null)) else { return false }
        let now = Foundation.Date()
        return data.alerts.contains { a in
            let start = a.start.flatMap(APIDate.parse), end = a.end.flatMap(APIDate.parse)
            return (start == nil || start! <= now) && (end == nil || end! > now)
        }
    }
}

private struct FavoriteCardBody<Content: View>: View {
    let title: String
    let subtitle: String?
    let link: Bool
    var alertsFor: (routeIds: [String], stopIds: [String])? = nil
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 8) {
                        Text(title).font(.system(size: 17, weight: .semibold)).lineLimit(1)
                        if let alertsFor { DisruptionTag(routeIds: alertsFor.routeIds, stopIds: alertsFor.stopIds) }
                    }
                    if let subtitle { Text(subtitle).font(.system(size: 13)).foregroundStyle(Theme.secondary).lineLimit(1) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if link { Chevron() }
            }
            content
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}

/// A favourite as it looks on Home: its next departures. `link` false inside the add sheet.
struct FavoriteCard: View {
    let fav: Favorite
    var link = true
    @State private var model = DeparturesViewModel()

    private var stopIds: [String] { fav.departureStopIds }
    private var routeIds: [String]? { fav.departureRouteIds }
    private var request: DeparturesRequest { fav.departuresRequest }
    private var target: StationTarget { fav.stationTarget }

    /// Size and grouping of this favourite, and removing it.
    @ViewBuilder private var editMenu: some View {
        let store = FavoritesStore.shared
        let size = fav.size ?? .small
        Picker("Size", selection: Binding(get: { size }, set: { v in store.update(fav.id) { $0.size = v } })) {
            Text("Small").tag(FavSize.small); Text("Medium").tag(FavSize.medium); Text("Large").tag(FavSize.large)
        }
        .pickerStyle(.inline)
        if size != .small {
            Picker("Group by", selection: Binding(get: { fav.grouping ?? .line }, set: { v in store.update(fav.id) { $0.grouping = v } })) {
                Text("Line").tag(FavGrouping.line); Text("Time").tag(FavGrouping.time)
            }
            .pickerStyle(.inline)
        }
        Divider()
        Button(role: .destructive) { store.toggle(fav) } label: { Label("Remove from favourites", systemImage: "star.slash") }
    }

    var body: some View {
        switch fav.kind {
        case .line:
            if let route = fav.route {
                HStack { LineBadge(line: route.line); Spacer() }.padding(.horizontal, 16).padding(.vertical, 12)
            }
        default:
            let title = fav.kind == .lineStop ? (fav.stopName ?? "") : (fav.name ?? "")
            let towards: String? = {
                if fav.kind == .lineStop {
                    // Older ones have no direction saved: take it from the loaded departures of that line
                    var seen = Set<String>()
                    let derived = model.departures.compactMap(\.headsign).filter { seen.insert($0).inserted }.joined(separator: " / ")
                    let h = fav.headsign ?? derived
                    return h.isEmpty ? nil : tr("towards \(h)")
                }
                let hs = fav.headsigns ?? []
                return hs.isEmpty ? nil : tr("towards \(hs.joined(separator: " / "))")
            }()
            let subtitle = towards ?? (fav.kind == .lines ? tr("\((fav.routes ?? []).count) lines") : nil)
            let fallback = fav.kind == .lineStop ? (fav.route.map { [$0.line] } ?? []) : (fav.routes ?? []).map(\.line)
            let card = FavoriteCardBody(title: title, subtitle: subtitle, link: link, alertsFor: (routeIds ?? [], stopIds)) {
                if (fav.size ?? .small) == .small {
                    LineTimesRow(departures: model.departures, pending: !model.loaded, only: routeIds.map(Set.init), fallback: fallback)
                } else {
                    FavoriteRowsList(departures: model.departures, pending: !model.loaded, only: routeIds.map(Set.init), fallback: fallback,
                                     grouping: fav.grouping ?? .line, rows: fav.size?.rows ?? 3)
                }
            }
            Group {
                if link {
                    NavigationLink(value: target) { card }.buttonStyle(RowButtonStyle())
                        // Long press: the rest of the screen blurs, the card lifts, and its options open under it
                        .contextMenu { editMenu } preview: { FavoriteCard(fav: fav, link: false).frame(minWidth: 320).background(Theme.surface) }
                } else {
                    card
                }
            }
            .task(id: request) { await model.run(request) }
        }
    }
}

/// Bottom sheet asking what to save: each option shows how it will look on Home, and toggles on tap.
struct FavoriteSheet: View {
    let options: [Favorite]
    @Environment(\.dismiss) private var dismiss
    @State private var store = FavoritesStore.shared

    private func title(_ k: Favorite.Kind) -> String {
        switch k {
        case .line: return tr("Just the line")
        case .lineStop: return tr("This line from this stop")
        case .stop: return tr("The whole stop")
        case .lines: return tr("These lines from here")
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    ForEach(options) { option in
                        let saved = store.has(option.id)
                        Button { store.toggle(option) } label: {
                            VStack(spacing: 0) {
                                HStack {
                                    Text(title(option.kind).uppercased()).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.secondary)
                                    Spacer()
                                    Label(saved ? tr("Saved") : tr("Add"), systemImage: saved ? "star.fill" : "star")
                                        .font(.system(size: 13, weight: .semibold)).foregroundStyle(saved ? Theme.accent : Theme.secondary)
                                }
                                .padding(.horizontal, 16).padding(.top, 12)
                                FavoriteCard(fav: option, link: false)
                            }
                            .background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(saved ? Theme.accent : .clear, lineWidth: 2))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(16)
            }
            .background(Theme.canvas)
            .navigationTitle("Add to favourites")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
    }
}

/// Star button for a toolbar: opens the sheet; filled when any option is saved.
struct FavoriteButton: View {
    let options: [Favorite]
    @State private var store = FavoritesStore.shared
    @State private var sheet = false

    var body: some View {
        if !options.isEmpty {
            let saved = options.contains { store.has($0.id) }
            Button { sheet = true } label: {
                Image(systemName: saved ? "star.fill" : "star").foregroundStyle(saved ? Theme.accent : Color.primary)
            }
            .accessibilityLabel("Favourites")
            .sheet(isPresented: $sheet) { FavoriteSheet(options: options) }
        }
    }
}
