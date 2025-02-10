//
//  ContentView.swift
//  timetable
//
//  Created by Balázs Szalay on 2025. 02. 08..
//

import SwiftUI
import TimetableAPI

struct ContentView: View {
    @State private var path = NavigationPath()  
    
    var body: some View {
        NavigationStack(path: $path) {
            RoutesView()
                .navigationDestination(for: TimetableQuery.Data.Timetable.self) { event in
                    TripView(tripId: event.tripId)
                }
        }
    }
}

#Preview {
    ContentView()
}

struct NavigationPathKey: EnvironmentKey {
    static var defaultValue: Binding<NavigationPath> = .constant(NavigationPath())
}

extension EnvironmentValues {
    var navigationPath: Binding<NavigationPath> {
        get { self[NavigationPathKey.self] }
        set { self[NavigationPathKey.self] = newValue }
    }
}
