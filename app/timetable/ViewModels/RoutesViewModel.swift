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

class RoutesViewModel: ObservableObject {
    @Published var searchText: String = ""
    @Published var isLoading: Bool = false
    @Published var routes = [RoutesQuery.Data.Routes.Datum]()
    @Published var activeRequest: Apollo.Cancellable?
    @Published var lastConnection: RoutesQuery.Data.Routes?


    private var cancellables = Set<AnyCancellable>()



    func fetchRoutes(limit: Int = 50, page: Int = 0) {
        self.activeRequest = Network.shared.apollo.fetch(query: RoutesQuery(limit: limit ?? .null, page: page ?? .null)) { [weak self] result in
            
            print("Loading routes: \(page)")
            
            switch result {
                case .success(let graphQLResult):
                    if let routesConnection = graphQLResult.data?.routes {
                        self?.lastConnection = routesConnection
                        self?.routes.append(contentsOf: routesConnection.data)
                    }

                    if let errors = graphQLResult.errors {
                    }
                case .failure(let error):
                    print("Failure! Error: \(error)")
            }
        }
    }
    
    func loadRoutes() {
        guard let connection = self.lastConnection else {
            self.fetchRoutes()
            return
        }

        guard (connection.pages ?? 0) > (connection.page ?? 0) else {
            return
        }

        self.fetchRoutes(page: (connection.page ?? 0) + 1)
    }
}
