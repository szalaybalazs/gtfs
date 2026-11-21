//
//  SettingsView.swift
//  timetable
//

import SwiftUI

struct SettingsView: View {
    @Environment(AppSettings.self) private var settings

    var body: some View {
        @Bindable var settings = settings
        Form {
            Section {
                ForEach(Marker.allCases) { marker in
                    Toggle(isOn: Binding(get: { settings.shows(marker) }, set: { settings.setShown(marker, $0) })) {
                        Label(marker.title, systemImage: marker.symbol)
                    }
                }
            } header: {
                Text("Markers")
            } footer: {
                Text("Choose which markers show on departures and lines.")
            }
            Section("Nearby stops") {
                Picker("Radius", selection: $settings.nearbyRadius) {
                    ForEach(AppSettings.radii, id: \.self) { Text("\($0) m").tag($0) }
                }
            }
            Section("Departures") {
                Picker("Stop group view", selection: $settings.departuresView) {
                    ForEach(DeparturesView.allCases) { Text($0.title).tag($0) }
                }
            }
        }
        .navigationTitle("Settings")
    }
}
