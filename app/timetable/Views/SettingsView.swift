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
            Section("Appearance") {
                Picker("Appearance", selection: $settings.appearance) {
                    ForEach(AppAppearance.allCases) { Text($0.title).tag($0) }
                }
                .pickerStyle(.menu)
            }
            Section("Language") {
                Picker("Language", selection: $settings.language) {
                    ForEach(AppLanguage.allCases) { Text($0.title).tag($0) }
                }
            }
            Section {
                Toggle("Animate changing numbers", isOn: $settings.animateNumbers)
            } footer: {
                Text("Countdowns and \"Updated\" ages roll their digits when they change. Turn off for a plain swap.")
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
                    message = tr("Copied \(favorites.favorites.count) favourites.")
                }
                Button("Paste JSON") {
                    if let text = UIPasteboard.general.string, let added = favorites.importJSON(text) {
                        message = added == 0 ? tr("Nothing new: those favourites are already here.") : tr("Added \(added) favourites.")
                    } else {
                        message = tr("The clipboard doesn't hold favourites JSON.")
                    }
                }
            } header: {
                Text("Favourites")
            } footer: {
                Text("Same format as the web app: copy there, paste here (or the other way round). Existing favourites are kept.")
            }
            Section {
                DisclosureGroup("Mynaui icons") {
                    Text("Tab bar icons: Mynaui Icons, MIT License, Copyright (c) Praveen Juge.\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the \"Software\"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.")
                        .font(.system(size: 12)).foregroundStyle(Theme.secondary)
                }
            } header: {
                Text("Acknowledgements")
            }
        }
        .alert(message ?? "", isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })) {
            Button("OK", role: .cancel) {}
        }
                .navigationTitle("Settings")
    }
}
