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
    @State private var tab = 0
    @State private var settings = AppSettings.shared

    var body: some View {
        TabView(selection: $tab) {
            NavigationStack { HomeView() }
                .tabItem { Label { Text("Home") } icon: { Image(tab == 0 ? "tab_home_solid" : "tab_home") } }.tag(0)
            NavigationStack { StationsView() }
                .tabItem { Label { Text("Stops") } icon: { Image(tab == 1 ? "tab_pin_solid" : "tab_pin") } }.tag(1)
            NavigationStack(path: $path) {
                RoutesView()
                    .navigationDestination(for: TimetableQuery.Data.Timetable.self) { event in
                        Text("EVENT")
                    }
            }
            .tabItem { Label { Text("Routes") } icon: { Image(tab == 2 ? "tab_routes_solid" : "tab_routes") } }.tag(2)
            NavigationStack { MapView() }
                .tabItem { Label { Text("Map") } icon: { Image(tab == 3 ? "tab_map_solid" : "tab_map") } }.tag(3)
            NavigationStack { SettingsView() }
                .tabItem { Label { Text("Settings") } icon: { Image(tab == 4 ? "tab_settings_solid" : "tab_settings") } }.tag(4)
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
