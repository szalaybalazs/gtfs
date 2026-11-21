//
//  SettingsView.swift
//  timetable
//

import SwiftUI
import UIKit

struct SettingsView: View {
    @Environment(AppSettings.self) private var settings
    @State private var favorites = FavoritesStore.shared
    @State private var message: String?

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
            Section {
                Button("Copy as JSON") {
                    UIPasteboard.general.string = favorites.exportJSON()
                    message = "Copied \(favorites.favorites.count) favourites."
                }
                Button("Paste JSON") {
                    if let text = UIPasteboard.general.string, let added = favorites.importJSON(text) {
                        message = added == 0 ? "Nothing new: those favourites are already here." : "Added \(added) favourites."
                    } else {
                        message = "The clipboard doesn't hold favourites JSON."
                    }
                }
            } header: {
                Text("Favourites")
            } footer: {
                Text("Same format as the web app: copy there, paste here (or the other way round). Existing favourites are kept.")
            }
        }
        .alert(message ?? "", isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })) {
            Button("OK", role: .cancel) {}
        }
        .navigationTitle("Settings")
    }
}
