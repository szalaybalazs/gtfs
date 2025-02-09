//
//  RouteDetails.swift
//  timetable
//
//  Created by Balázs Szalay on 2025. 02. 08..
//

import SwiftUI
import TimetableAPI

struct StopOption: View {
    public let stop: RouteByIdQuery.Data.Route.Direction.Stop
    var body: some View {
        Text(stop.name ?? "").tag(stop.stopId ?? "")
    }
}

struct DirectionOption: View {
    public let direction: RouteByIdQuery.Data.Route.Direction
    var body: some View {
        Text(direction.headsign ?? "").tag(direction.directionId)
    }
}

struct RouteDetailsView: View {
    public let id: String
    public let shortName: String?
    @StateObject private var routeModel: RouteDetailsViewModel
        
    init(id: String, shortName: String? = nil) {
        self.id = id
        self.shortName = shortName
        _routeModel = StateObject(wrappedValue: RouteDetailsViewModel(routeId: id))
    }
    
    private var stops: [RouteByIdQuery.Data.Route.Direction.Stop] {
        routeModel.stops
    }
    
    var body: some View {
        VStack {
            List {
                Section {
                    Picker("Stop", selection: $routeModel.stopId) {
                        ForEach(0..<stops.count, id: \.self) { index in
                            StopOption(stop: stops[index])
                        }
                        Text("TEST").tag("__TEST__")
                    }
                    Picker("Direction", selection: $routeModel.directionId) {
                        ForEach(0..<routeModel.directions.count, id: \.self) { index in
                            DirectionOption(direction: routeModel.directions[index])
                        }
                    }
                }
            }.listSectionSpacing(.compact)
                .navigationBarItems(
                    trailing:
                        Button("Add 1") {
                            
                        }
                )
        }
        .navigationTitle(shortName ?? id)
        .onAppear{
            routeModel.loadRoute()
        }
        .onChange(of: routeModel.stops) { oldValue, newValue in
            print("Closest stop: \(routeModel.closestStop?.name ?? "-")")
            if let closestStop = newValue.first(where: { $0.name == routeModel.closestStop?.name }) {
                routeModel.stopId = closestStop.stopId
            }
//            if let stops = routeModel.directions.first(where: { $0.directionId == newValue})?.stops {
//                if let closestStop = stops.first(where: { $0.name == routeModel.closestStop?.name }) {
//                    routeModel.stopId = closestStop.stopId
//                } else {
//                    routeModel.stopId = stops.first?.stopId ?? "__TEST__"
//                }
//
//            }
        }
        
    }
}

#Preview {
    RouteDetailsView(id: "3560", shortName: "56")
}
