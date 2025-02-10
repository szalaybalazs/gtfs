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
    @State private var selectedEvent: TimetableQuery.Data.Timetable?
    
    var isEventSelected: Binding<Bool> {
        Binding(
            get: { selectedEvent != nil },
            set: { newValue in
                if !newValue {
                    selectedEvent = nil
                }
            }
        )
    }
    
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
            NavigationLink(isActive: isEventSelected) {
                if let selectedEvent {
                    TripView(tripId: selectedEvent.tripId)
                }
            } label: {
                EmptyView()
            }
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
                TimetableView(routeId: routeModel.routeId, stopId: routeModel.stopId, selectedEvent: $selectedEvent)
            }
            .listStyle(.grouped)
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
        }
        
    }
}

#Preview {
    RouteDetailsView(id: "3560", shortName: "56")
}
