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

class TimetableViewModel: ObservableObject {
    var routeId: TimetableAPI.ID
    var stopId: TimetableAPI.ID
    
    @Published var isLoading: Bool = false
    @Published var entries = [TimetableQuery.Data.Timetable]()
    @Published var activeRequest: Apollo.Cancellable?
    @Published var lastConnection: RoutesQuery.Data.Routes?
    
    init(routeId: TimetableAPI.ID, stopId: TimetableAPI.ID) {
        self.routeId = routeId
        self.stopId = stopId
    }


    private var cancellables = Set<AnyCancellable>()



    func fetchTimetable() {
        self.activeRequest = Network.shared.apollo.fetch(query: TimetableQuery(stopId: stopId, routeId: routeId, range: .null)) { [weak self] result in
            
            switch result {
                case .success(let graphQLResult):
                    if let timetableConnection = graphQLResult.data?.timetable {
//                        self?.lastConnection = routesConnection
                        self?.entries = timetableConnection
                    }

                    if let errors = graphQLResult.errors {
                    }
                case .failure(let error):
                    print("Failure! Error: \(error)")
            }
        }
    }
}
