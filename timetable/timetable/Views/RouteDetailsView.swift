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
    @AppStorage("timetable.showHistoric") private var showHistoric: Bool = false
    
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
                    TripView(tripId: selectedEvent.tripId, headsign: "", stopId: routeModel.stopId)
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
                    }
                    Picker("Direction", selection: $routeModel.directionId) {
                        ForEach(0..<routeModel.directions.count, id: \.self) { index in
                            DirectionOption(direction: routeModel.directions[index])
                        }
                    }
                    
                }
                TimetableView(routeId: routeModel.routeId,
                              stopId: routeModel.stopId,
                              selectedEvent: $selectedEvent,
                              showHistoric: $showHistoric)
            }
            .listStyle(.grouped)
        }
        .navigationTitle(shortName ?? id)
        .toolbar {
            ToolbarItem {
                Button(action: {
                    showHistoric.toggle()
                }) {
                    Image(systemName: "clock.arrow.trianglehead.counterclockwise.rotate.90")
                        .tint(showHistoric ? .accentColor : .primary)
                }
                
            }
        }
        .onAppear{
            routeModel.loadRoute()
        }
        .refreshable {
            routeModel.loadRoute()
        }
        .onChange(of: routeModel.stops) { oldValue, newValue in
            // todo: improve this logic
            if let currentStop = routeModel.allStops.first(where: { $0.stopId == routeModel.stopId }) {
                if let newStop = newValue.first(where: { $0.name == currentStop.name }) {
                    routeModel.stopId = newStop.stopId
                } else {
                    routeModel.stopId = newValue[0].stopId
                }
            }
        }
        
    }
}

#Preview {
    NavigationView {
        RouteDetailsView(id: "3560", shortName: "56")
    }
}
