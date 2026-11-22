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
            let text = age < 60 ? "\(age)s" : "\(age / 60) \(tr("min"))"
            HStack(spacing: 5) {
                Image(systemName: "stopwatch")
                // Same roll as the favourite and departure times (the number rolls, the same setting turns it off)
                Text(text)
                    .contentTransition(settings.animateNumbers ? .numericText(countsDown: true) : .identity)
                    .animation(settings.animateNumbers ? .default : nil, value: text)
            }
            .font(.system(size: 13)).foregroundStyle(Theme.secondary).monospacedDigit()
        }
    }
}
