//
//  LineBadge.swift
//  timetable
//

import SwiftUI
import Flow

/// Badges of several lines, in line order.
struct LineBadges: View {
    let lines: [LineRef]
    var small = true
    /// Big stations have dozens of lines: show the most important ones and "+N".
    var limit = 10

    var body: some View {
        let sorted = lines.sorted(by: lineOrder)
        HFlow(itemSpacing: 4, rowSpacing: 4) {
            ForEach(sorted.prefix(limit), id: \.routeId) { LineBadge(line: $0, small: small) }
            if sorted.count > limit {
                Text("+\(sorted.count - limit)").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            }
        }
    }
}

/// Small marker glyph (front door, low-floor, ...), hidden when switched off in Settings.
struct MarkerIcon: View {
    @Environment(AppSettings.self) private var settings
    let marker: Marker
    /// Overrides the legend wording: on one trip the icon says that trip is accessible, not that every vehicle is.
    var label: String?

    var body: some View {
        if settings.shows(marker) {
            Image(systemName: marker.symbol)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .accessibilityLabel(label ?? marker.title)
        }
    }
}
