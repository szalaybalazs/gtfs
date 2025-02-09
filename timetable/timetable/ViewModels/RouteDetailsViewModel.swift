
//
//  RoutesViewModel.swift
//  timetable
//
//  Created by Balázs Szalay on 2025. 02. 09..
//

import Foundation
import Combine
import Apollo
import TimetableAPI

class RouteDetailsViewModel: ObservableObject {
    let routeId: TimetableAPI.ID
    @Published var isLoading: Bool = false
    @Published var route: RouteByIdQuery.Data.Route?
    @Published var activeRequest: Apollo.Cancellable?
    @Published var lastConnection: RoutesQuery.Data.Routes?
    @Published var closestStop: RouteByIdQuery.Data.Route.ClosestStop?
    
    @Published var stopId: String = "__TEST__"
    @Published var directionId: Int = 0
    @Published var directions: [RouteByIdQuery.Data.Route.Direction] = []
    
    private var cancellables = Set<AnyCancellable>()
    
    init(routeId: TimetableAPI.ID) {
        self.routeId = routeId
    }
    
    public var stops: [RouteByIdQuery.Data.Route.Direction.Stop] {
        return directions.first { $0.directionId == directionId }?.stops ?? []
    }
    
    private var locationManager = LocationManager()

    func loadRoute() {
        print("Loading route: \(self.routeId)")
        locationManager.requestOneTimeLocation { location in
            self.activeRequest = Network.shared.apollo.fetch(query: RouteByIdQuery(
                routeId: self.routeId,
                lat: location?.latitude ?? .null,
                lon: location?.longitude ?? .null)) { [weak self] result in
                switch result {
                    case .success(let graphQLResult):
                        if let route = graphQLResult.data?.route {
                            self?.route = route
                            
                            self?.directions = route.directions ?? []
                            
                            if let closestStop = route.closestStop {
                                self!.stopId = closestStop.stopId
                                
                                self?.closestStop = closestStop
                                
                                // Find direction including the stop
                                self!.directions.forEach { direction in
                                    if direction.stops.contains(where: { $0.stopId == closestStop.stopId }) ?? false {
                                        self!.directionId = direction.directionId
                                    }
                                }
                            } else {
                                self!.stopId = (route.directions ?? [])[0].stops[0].stopId ?? "__TEST__"
                            }
                        }

                        if let errors = graphQLResult.errors {
                        }
                    case .failure(let error):
                        print("Failure! Error: \(error)")
                }
            }
        }
        
    }
}
