
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

class TripViewModel: ObservableObject {
    let tripId: TimetableAPI.ID
    @Published var isLoading: Bool = false
    @Published var trip: TripByIdQuery.Data.Trip?
    @Published var activeRequest: Apollo.Cancellable?
    @Published var lastConnection: RoutesQuery.Data.Routes?
    
    private var cancellables = Set<AnyCancellable>()
    
    init(tripId: TimetableAPI.ID) {
        self.tripId = tripId
    }
    
    public var stopTimes: [TripByIdQuery.Data.Trip.StopTime] {
        self.trip?.stopTimes ?? []
    }

    func loadRoute() {
        print("Loading trip: \(self.tripId)")
        self.activeRequest = Network.shared.apollo.fetch(query: TripByIdQuery(tripId: self.tripId)) { [weak self] result in
            switch result {
            case .success(let graphQLResult):
                if let trip = graphQLResult.data?.trip {
                    print("Loaded trip: \(trip)")
                    if let trip = graphQLResult.data?.trip {
                        self?.trip = trip
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
