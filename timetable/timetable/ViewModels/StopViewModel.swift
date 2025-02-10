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

class StopViewModel: ObservableObject {
    let stopId: TimetableAPI.ID
    @Published var isLoading: Bool = false
    @Published var stop: StopByIdQuery.Data.Stop?
    @Published var activeRequest: Apollo.Cancellable?
    @Published var lastConnection: RoutesQuery.Data.Routes?
    
    private var cancellables = Set<AnyCancellable>()
    
    init(stopId: TimetableAPI.ID) {
        self.stopId = stopId
    }
    
    public var departures: [StopByIdQuery.Data.Stop.StopTime] {
        stop?.stopTimes ?? []
    }
    
  

    func loadStop() {
        print("Loading stop: \(self.stopId)")
        self.activeRequest = Network.shared.apollo.fetch(query: StopByIdQuery(stopId: self.stopId)) { [weak self] result in
            switch result {
            case .success(let graphQLResult):
                if let stop = graphQLResult.data?.stop {
                    print("Loaded stop: \(stop.name) - \(stop.stopTimes?.count ?? 0)")
                    self?.stop = stop
                }
                
                if let errors = graphQLResult.errors {
                }
            case .failure(let error):
                print("Failure! Error: \(error)")
            }
        }
        
    }
}
