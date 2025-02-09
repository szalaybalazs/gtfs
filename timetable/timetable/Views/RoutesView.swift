//
//  RoutesView.swift
//  timetable
//
//  Created by Balázs Szalay on 2025. 02. 09..
//

import SwiftUI
import TimetableAPI
import Apollo

struct RouteListItem: View {
    let route: RoutesQuery.Data.Routes.Datum
    
    var body: some View {
        NavigationLink(destination: RouteDetailsView(id: route.routeId, shortName: route.shortName)){
            HStack(alignment: .center) {
                HStack(alignment: .center) {
                    Text(route.shortName ?? "")
                        .padding(.vertical, 3)
                        .padding(.horizontal, 6)
                        .background(Color(hex: route.color ?? "#000000"))
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color(hex: route.textColor ?? "#ffffff"))
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
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
    @StateObject private var viewModel = RoutesViewModel()
    @StateObject var locationManager = LocationManager()
    @State private var searchText: String = ""
    
    var body: some View {
        VStack {
            List {
                Section {
                    ForEach(0..<viewModel.routes.count, id: \.self) { index in
                        RouteListItem(route: viewModel.routes[index])
                            .onAppear {
                                if index == viewModel.routes.count - 10 {
                                    viewModel.loadRoutes()
                                }
                            }
                    }
                }
            }
            .listStyle(.plain)
            .navigationTitle("Routes")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(action: {
                        locationManager.requestOneTimeLocation { location in
                            if let location = location {
//                                    currentLocation = location
                                print("Received location: \(location.latitude), \(location.longitude)")
                            }
                        }
                    }) {
                        Image(systemName: "location.slash.fill").toolbarTitleDisplayMode(.automatic)
                    }
                }
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
        .onAppear {
            viewModel.fetchRoutes()
        }
    }
}

#Preview {
    RoutesView()
}
