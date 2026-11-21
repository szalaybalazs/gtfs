//
//  RouteDetailsView.swift
//  timetable
//
//  One line: title and marks, direction switch, and its stops along a coloured line;
//  tapping a stop opens that stop's departures for the line (web/src/pages/RouteDetailsPage.tsx).
//

import SwiftUI

struct RouteDetailsView: View {
    let id: String
    let shortName: String?
    let line: LineRef?
    @Environment(AppSettings.self) private var settings
    @State private var model: RouteDetailsViewModel
    @State private var departures = DeparturesViewModel()
    /// Each "More" reaches another 90 minutes further.
    @State private var more = 0

    init(id: String, shortName: String? = nil, line: LineRef? = nil) {
        self.id = id
        self.shortName = shortName
        self.line = line
        _model = State(initialValue: RouteCache.model(for: id))
    }

    private var request: DeparturesRequest? {
        model.stop.map { DeparturesRequest(stopIds: [$0.stopId], routeIds: [id], limit: 60 * (1 + more), hours: min(6, Int((Double(90 * (1 + more)) / 60).rounded(.up)))) }
    }

    private var favoriteOptions: [Favorite] {
        guard let l = model.route?.line ?? line else { return [] }
        var out: [Favorite] = []
        if let stop = model.stop, let d = model.direction {
            out.append(Favorite.lineStop(route: l, stopId: stop.stopId, stationId: stop.stopId, stopName: stop.name, headsign: d.headsign))
        }
        return out + [Favorite.line(l)]
    }

    private var color: Color { Color(hex: (model.route?.line.color ?? line?.color) ?? "#6b7280") }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                if let message = model.state.errorMessage, model.route == nil {
                    ErrorView(message: message) { await model.load() }
                } else if let route = model.route {
                    header(route)
                    AlertsSection(routeIds: [route.line.routeId])
                    if let direction = model.direction, let stop = model.stop {
                        VStack(spacing: 8) {
                            stopPicker(direction, stop: stop)
                            directionRow(direction)
                        }
                        departuresSection(stop: stop)
                    }
                } else {
                    // Same layout as the loaded page, greyed out and shimmering until the data arrives
                    let placeholder = Self.placeholder
                    header(placeholder).skeleton()
                    VStack(spacing: 8) {
                        stopPicker(placeholder.directions[0], stop: placeholder.directions[0].stops[0]).skeleton()
                        directionRow(placeholder.directions[0]).skeleton()
                    }
                    VStack(spacing: 0) {
                        SectionTitle("Departures")
                        Card { SkeletonDepartureRows(count: 5) }
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.canvas)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                if let l = model.route?.line ?? line { LineBadge(line: l, large: true) } else { Text(shortName ?? id).font(.headline) }
            }
            ToolbarItem(placement: .topBarTrailing) {
                FavoriteButton(options: favoriteOptions)
            }
        }
        .task {
            if model.route == nil, !model.state.isLoading { await model.load() }
            await model.chooseNearest()
        }
        .task(id: request) { if let r = request { await departures.run(r) } }
    }

    /// What the page looks like before its data: same shapes, made-up text.
    private static let placeholder = RouteDetail(
        line: LineRef(routeId: "", shortName: nil, color: nil, textColor: nil, type: nil),
        title: "Line title goes here for now", flags: [],
        directions: [RouteDirection(directionId: 0, headsign: "Destination stop name",
                                    stops: (0..<12).map { RouteDirection.StopRef(stopId: "ph\($0)", name: "Stop name placeholder \($0)") })])

    private func header(_ route: RouteDetail) -> some View {
        Card {
            VStack(alignment: .leading, spacing: 6) {
                Text(route.title).font(.system(size: 24, weight: .bold))
                if !model.hint.isEmpty { Text(model.hint).font(.system(size: 15)).foregroundStyle(Theme.secondary) }
                let shown = route.flags.filter { settings.shows($0) }
                if !shown.isEmpty {
                    HStack(spacing: 8) {
                        ForEach(shown) { m in
                            Image(systemName: m.symbol).font(.system(size: 18)).foregroundStyle(Theme.secondary).accessibilityLabel(m.title)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
        }
    }

    /// Which stop to show: a menu of this direction's stops (not the last one), and a button back to the nearest.
    private func stopPicker(_ d: RouteDirection, stop: RouteDirection.StopRef) -> some View {
        HStack(spacing: 8) {
            Menu {
                ForEach(d.stops.dropLast()) { s in
                    Button { withAnimation { model.pick(s.stopId) } } label: {
                        if s.stopId == stop.stopId { Label(s.name, systemImage: "checkmark") } else { Text(s.name) }
                    }
                }
            } label: {
                HStack(spacing: 12) {
                    Text("Stop").foregroundStyle(Theme.secondary).frame(width: 72, alignment: .leading)
                    Text(stop.name).fontWeight(.medium).lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
                    Image(systemName: "chevron.up.chevron.down").font(.system(size: 13)).foregroundStyle(Theme.secondary)
                }
                .foregroundStyle(.primary)
                .padding(.horizontal, 16).padding(.vertical, 12)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            Button { Task { await model.useNearest() } } label: {
                Image(systemName: model.locating ? "location.circle" : "location").font(.system(size: 18)).foregroundStyle(Theme.accent)
                    .frame(width: 48, height: 48).background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .accessibilityLabel("Nearest stop")
        }
    }

    /// This line's departures at the chosen stop, the next 90 minutes.
    private func departuresSection(stop: RouteDirection.StopRef) -> some View {
        VStack(spacing: 0) {
            SectionTitle("Departures")
            Card {
                if !departures.loaded, departures.state.errorMessage == nil {
                    SkeletonDepartureRows(count: 5)
                } else if let message = departures.state.errorMessage, departures.departures.isEmpty {
                    ErrorView(message: message) { if let r = request { await departures.load(r) } }
                } else {
                    TimelineView(.periodic(from: .now, by: 1)) { context in
                        let end = context.date.addingTimeInterval(Double(90 * (1 + more)) * 60)
                        // Switching stop / direction: keep the previous rows up until the new ones answer (a moment later), so the card doesn't collapse and refill
                        let current = departures.loadedStopIds == [stop.stopId]
                        let list = departures.departures.filter { $0.route?.routeId == id && $0.time <= end && (!current || $0.stopId == stop.stopId) }
                        if list.isEmpty {
                            Text("No departures").foregroundStyle(Theme.secondary).frame(maxWidth: .infinity).padding(24)
                        } else {
                            RowList(data: list, id: \.id) { d in
                                NavigationLink(value: TripTarget(tripId: d.tripId, serviceDate: d.serviceDate, from: d.stopId, route: d.route, headsign: d.headsign)) {
                                    DepartureRow(departure: d, now: context.date)
                                }
                                .buttonStyle(RowButtonStyle())
                            }

                        }
                        if 90 * (1 + more) < 360 {
                        Rectangle().fill(Theme.separator).frame(height: 1 / UIScreen.main.scale)
                        Button { more += 1 } label: {
                            Text("Show more").font(.system(size: 15, weight: .medium)).foregroundStyle(Theme.accent)
                                .frame(maxWidth: .infinity).padding(.vertical, 12)
                        }
                        .buttonStyle(RowButtonStyle())
                        }
                    }
                }
            }
        }
    }

    /// "Towards X" with a swap button, like the web.
    private func directionRow(_ d: RouteDirection) -> some View {
        Button {
            withAnimation { model.swapDirection() }
        } label: {
            HStack(spacing: 12) {
                Text("Towards").foregroundStyle(Theme.secondary).frame(width: 72, alignment: .leading)
                Text(d.headsign).fontWeight(.medium).lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
                if model.otherDirection != nil { Image(systemName: "arrow.left.arrow.right").accessibilityLabel("Swap direction") }
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(model.otherDirection == nil)
    }
}
