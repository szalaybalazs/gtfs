//
//  RoutesView.swift
//  timetable
//
//  Created by Balázs Szalay on 2025. 02. 09..
//

import SwiftUI
import TimetableAPI

struct RouteListItem: View {
    let route: RoutesQuery.Data.Routes.Datum
    
    var body: some View {
        NavigationLink(destination: RouteDetailsView(id: route.routeId, shortName: route.shortName, line: LineRef(routeId: route.routeId, shortName: route.shortName, color: route.color, textColor: route.textColor, type: nil))){
            HStack(alignment: .center) {
                HStack(alignment: .center) {
                    LineBadge(line: LineRef(routeId: route.routeId, shortName: route.shortName, color: route.color, textColor: route.textColor, type: nil))
                }
                
                Text(route.desc ?? route.longName ??  "")
                    .font(.subheadline)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
        }
    }

    
}


struct RoutesView: View {
    @State private var viewModel = RoutesViewModel()
    @State private var searchText: String = ""

    var body: some View {
        VStack {
            List {
                Section {
                    ForEach(viewModel.routes, id: \.routeId) { route in
                        RouteListItem(route: route)
                            .onAppear {
                                // Prefetch when one of the last 10 rows shows up.
                                if viewModel.routes.suffix(10).contains(where: { $0.routeId == route.routeId }) {
                                    Task { await viewModel.loadNextPage() }
                                }
                            }
                    }
                }
                Section {
                    if let message = viewModel.state.errorMessage {
                        ErrorView(message: message) {
                            if viewModel.routes.isEmpty { await viewModel.reload() } else { await viewModel.loadNextPage() }
                        }
                    } else if viewModel.state.isLoading {
                        ProgressView().frame(maxWidth: .infinity)
                    }
                }
                .listRowSeparator(.hidden)
            }
            .listStyle(.plain)
            .refreshable { await viewModel.reload() }
            .navigationTitle("Routes")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                     Menu(content: {
                         ControlGroup {
                             Button(action: {
                                 // Code
                             }) {
                                 Label("Buses", systemImage: "bus.fill")
                             }
                             
                             Button(action: {
                                 // Code
                             }) {
                                 Label("Trams", systemImage: "tram.fill")

                             }
                             Button(action: {
                                 // Code
                             }) {
                                 Label("Subway", systemImage: "tram.fill.tunnel")

                             }
                         }
                         Divider()
                         Menu(content: {
                             Button(action: {
                                 // Code
                             }) {
                                 Label("Copy", systemImage: "doc.on.doc")
                             }
                             Button(action: {
                                 // Code
                             }) {
                                 Label("Favorite", systemImage: "heart")
                             }
                             Button(action: {
                                 // Code
                             }) {
                                 Label("Share", systemImage: "square.and.arrow.up")
                             }
                         }, label: {
                             Text("Agency")
                         })
                         Divider()
                         Button(action: {
                             // Code
                         }) {
                             Label("Nearby", systemImage: "mappin.and.ellipse")

                         }
                         Button(action: {
                             // Code
                         }) {
                             Label("Map", systemImage: "map")

                         }
                         Button(action: {
                             // Code
                         }) {
                             Label("Settings", systemImage: "gear")

                         }
                         Button(action: {
                             // Code
                         }) {
                             Label("News", systemImage: "newspaper")

                         }
                         
                        
                     }, label: {
                         Image(systemName: "ellipsis").toolbarTitleDisplayMode(.automatic)
                     })
                }
            }
        }
        .searchable(text: $searchText)
        .task {
            if viewModel.routes.isEmpty { await viewModel.loadNextPage() }
        }
    }
}

#Preview {
    RoutesView()
}
