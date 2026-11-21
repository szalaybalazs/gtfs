//
//  RouteDetails.swift
//  timetable
//
//  Created by Balázs Szalay on 2025. 02. 08..
//

import SwiftUI
import TimetableAPI

struct RouteDetailsView: View {
    public let id: String
    public let shortName: String?
    let line: LineRef?
    @State private var routeModel: RouteDetailsViewModel

    init(id: String, shortName: String? = nil, line: LineRef? = nil) {
        self.id = id
        self.line = line
        self.shortName = shortName
        _routeModel = State(initialValue: RouteDetailsViewModel(routeId: id))
    }

    var body: some View {
        List {
            if let message = routeModel.state.errorMessage {
                ErrorView(message: message) { await routeModel.load() }
            } else if routeModel.route == nil {
                ProgressView().frame(maxWidth: .infinity)
            } else {
                Section {
                    Picker("Direction", selection: $routeModel.directionId) {
                        ForEach(routeModel.directions, id: \.directionId) { direction in
                            Text(direction.headsign).tag(direction.directionId)
                        }
                    }
                    Picker("Stop", selection: $routeModel.stopId) {
                        ForEach(routeModel.stops, id: \.stopId) { stop in
                            Text(stop.name ?? stop.stopId).tag(Optional(stop.stopId))
                        }
                    }
                }
                if let stopId = routeModel.stopId {
                    TimetableView(routeId: routeModel.routeId, stopId: stopId)
                }
            }
        }
        .navigationTitle(shortName ?? id)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { FavoriteButton(options: line.map { [Favorite.line($0)] } ?? []) } }
        .task { if routeModel.route == nil { await routeModel.load() } }
        .onChange(of: routeModel.directionId) { routeModel.directionChanged() }
    }
}

#Preview {
    NavigationStack { RouteDetailsView(id: "3560", shortName: "56") }
}
