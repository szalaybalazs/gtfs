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

    init(id: String, shortName: String? = nil, line: LineRef? = nil) {
        self.id = id
        self.shortName = shortName
        self.line = line
        _model = State(initialValue: RouteDetailsViewModel(routeId: id))
    }

    private var color: Color { Color(hex: (model.route?.line.color ?? line?.color) ?? "#6b7280") }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                if let message = model.state.errorMessage, model.route == nil {
                    ErrorView(message: message) { await model.load() }
                } else if let route = model.route {
                    header(route)
                    if let direction = model.direction {
                        VStack(spacing: 8) {
                            directionRow(direction)
                            stops(direction)
                        }
                    }
                } else {
                    ProgressView().padding(.top, 40)
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
                FavoriteButton(options: (model.route?.line ?? line).map { [Favorite.line($0)] } ?? [])
            }
        }
        .task { if model.route == nil { await model.load() } }
    }

    private func header(_ route: RouteDetail) -> some View {
        Card {
            VStack(alignment: .leading, spacing: 6) {
                Text(route.title).font(.system(size: 24, weight: .bold))
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

    /// "Towards X" with a swap button, like the web.
    private func directionRow(_ d: RouteDirection) -> some View {
        Button {
            if let other = model.otherDirection { withAnimation { model.directionId = other.directionId } }
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

    private func stops(_ d: RouteDirection) -> some View {
        VStack(spacing: 0) {
            SectionTitle("Stops")
            Card {
                VStack(spacing: 0) {
                    ForEach(Array(d.stops.enumerated()), id: \.element.id) { i, stop in
                        NavigationLink(value: StationTarget(stationId: stop.stopId, from: stop.stopId, lines: [id])) {
                            HStack(spacing: 0) {
                                ZStack {
                                    Rectangle().fill(color).frame(width: 8)
                                        .padding(.top, i == 0 ? 24 : 0).padding(.bottom, i == d.stops.count - 1 ? 24 : 0)
                                    Circle().fill(Theme.surface).overlay(Circle().strokeBorder(color, lineWidth: 2)).frame(width: 10, height: 10)
                                }
                                .frame(width: 28, height: 48)
                                .padding(.leading, 12).padding(.trailing, 6)
                                Text(stop.name).font(.system(size: 17)).lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
                                Chevron().padding(.trailing, 16)
                            }
                        }
                        .buttonStyle(RowButtonStyle())
                    }
                }
                .padding(.vertical, 8)
            }
        }
    }
}
