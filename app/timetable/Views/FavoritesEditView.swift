//
//  FavoritesEditView.swift
//  timetable
//
//  Reorder or remove favourites: drag the handles. The order is the one Home uses (within each group) and the widget's picker lists.
//

import SwiftUI

struct FavoritesEditView: View {
    @State private var store = FavoritesStore.shared

    private func title(_ f: Favorite) -> String {
        switch f.kind {
        case .line: return f.route?.shortName ?? ""
        case .lineStop: return [f.route?.shortName, f.stopName].compactMap { $0 }.joined(separator: " · ")
        default: return f.name ?? f.stopName ?? ""
        }
    }

    var body: some View {
        List {
            ForEach(store.favorites) { f in
                HStack(spacing: 10) {
                    if let r = f.kind == .line || f.kind == .lineStop ? f.route?.line : nil { LineBadge(line: r, fit: true) }
                    Text(title(f)).lineLimit(1)
                    Spacer()
                    if f.kind == .lines || f.kind == .stop {
                        HStack(spacing: 3) { ForEach((f.routes ?? []).prefix(3), id: \.routeId) { LineBadge(line: $0.line, fit: true) } }
                    }
                }
            }
            .onMove { store.move(from: $0, to: $1) }
            .onDelete { store.remove(at: $0) }
        }
        .environment(\.editMode, .constant(.active))
        .navigationTitle("Edit favourites")
        .navigationBarTitleDisplayMode(.inline)
        .overlay { if store.favorites.isEmpty { Text("No favourites yet").foregroundStyle(Theme.secondary) } }
    }
}
