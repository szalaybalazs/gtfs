//
//  ContentView.swift
//  timetable
//
//  Created by Balázs Szalay on 2025. 02. 08..
//

import SwiftUI
import TimetableAPI

struct ContentView: View {
    @State private var paths = Array(repeating: NavigationPath(), count: 4)
    @State private var tab = 0
    @State private var reselect = TabReselect()
    @State private var settings = AppSettings.shared

    /// Tapping the current tab again pops to its first screen; already there, it scrolls to the top.
    private var selection: Binding<Int> {
        Binding(get: { tab }, set: { new in
            if new == tab {
                if !paths[new].isEmpty { withAnimation { paths[new] = NavigationPath() } }
                else { reselect = TabReselect(tab: new, count: reselect.count + 1) }
            }
            tab = new
        })
    }

    var body: some View {
        TabView(selection: selection) {
            NavigationStack(path: $paths[0]) { HomeView() }
                .tabItem { Label { Text("Home") } icon: { Image(tab == 0 ? "tab_home_solid" : "tab_home") } }.tag(0)
            NavigationStack(path: $paths[1]) { StationsView() }
                .tabItem { Label { Text("Stops") } icon: { Image(tab == 1 ? "tab_pin_solid" : "tab_pin") } }.tag(1)
            NavigationStack(path: $paths[2]) {
                RoutesView()
                    .navigationDestination(for: TimetableQuery.Data.Timetable.self) { event in
                        Text("EVENT")
                    }
            }
            .tabItem { Label { Text("Routes") } icon: { Image(tab == 2 ? "tab_routes_solid" : "tab_routes") } }.tag(2)
            NavigationStack(path: $paths[3]) { MapView() }
                .tabItem { Label { Text("Map") } icon: { Image(tab == 3 ? "tab_map_solid" : "tab_map") } }.tag(3)
        }
        .environment(\.tabReselect, reselect)
        .environment(settings)
        .preferredColorScheme(settings.appearance.scheme)
        .environment(\.locale, settings.language == .auto ? Locale.current : L10n.locale)
        .id(settings.language)
        .onOpenURL { url in
            // A widget tapped: open that stop's page on the Home tab
            guard let target = StationTarget(url: url) else { return }
            tab = 0
            paths[0] = NavigationPath()
            paths[0].append(target)
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
