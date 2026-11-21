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
    @State private var settings = AppSettings.shared

    var body: some View {
        TabView {
            NavigationStack { HomeView() }
                .tabItem { Label("Home", systemImage: "house.fill") }
            NavigationStack { StationsView() }
                .tabItem { Label("Stops", systemImage: "mappin.and.ellipse") }
            NavigationStack(path: $path) {
                RoutesView()
                    .navigationDestination(for: TimetableQuery.Data.Timetable.self) { event in
                        Text("EVENT")
                    }
            }
            .tabItem { Label("Routes", systemImage: "tram.fill") }
            NavigationStack { SettingsView() }
                .tabItem { Label("Settings", systemImage: "gear") }
        }
        .environment(settings)
        .environment(\.locale, settings.language == .auto ? Locale.current : L10n.locale)
        .id(settings.language)
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
