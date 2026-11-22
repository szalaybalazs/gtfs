//
//  RefreshedAge.swift
//  timetable
//
//  How old a live position is: a stopwatch and the age ("40s", "3 min"), right aligned, nothing else.
//  The same as the web's RefreshedAge component.
//

import SwiftUI

struct RefreshedAge: View {
    let updated: Date
    @Environment(AppSettings.self) private var settings

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            let age = max(0, Int(ctx.date.timeIntervalSince(updated)))
            HStack(spacing: 5) {
                Image(systemName: "stopwatch")
                Text(age < 60 ? "\(age)s" : "\(age / 60) \(tr("min"))")
            }
            .font(.system(size: 13)).foregroundStyle(Theme.secondary).monospacedDigit()
            // Always counts from the top: the new value drops in from above, the old one leaves downward
            // (numericText would follow the direction of the change, so it's not used here)
            .id(age)
            .transition(settings.animateNumbers ? .asymmetric(insertion: .move(edge: .top).combined(with: .opacity),
                                                              removal: .move(edge: .bottom).combined(with: .opacity)) : .identity)
            .animation(settings.animateNumbers ? .easeOut(duration: 0.25) : nil, value: age)
        }
    }
}
