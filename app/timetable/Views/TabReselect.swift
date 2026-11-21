//
//  TabReselect.swift
//  timetable
//
//  Tapping the tab you are already on: pop to its first screen, and if already there, scroll to the top.
//

import SwiftUI

struct TabReselect: Equatable {
    var tab = -1
    var count = 0
}

private struct TabReselectKey: EnvironmentKey { static let defaultValue = TabReselect() }

extension EnvironmentValues {
    var tabReselect: TabReselect {
        get { self[TabReselectKey.self] }
        set { self[TabReselectKey.self] = newValue }
    }
}

private struct ScrollToTopOnReselect: ViewModifier {
    let tab: Int
    @Environment(\.tabReselect) private var reselect
    @State private var position = ScrollPosition()

    func body(content: Content) -> some View {
        content
            .scrollPosition($position)
            .onChange(of: reselect) { _, r in
                if r.tab == tab { withAnimation(.easeOut(duration: 0.3)) { position.scrollTo(edge: .top) } }
            }
    }
}

extension View {
    /// Put on a tab's root ScrollView / Form.
    func scrollsToTopOnReselect(tab: Int) -> some View { modifier(ScrollToTopOnReselect(tab: tab)) }
}
