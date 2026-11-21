//
//  LineBadge.swift
//  timetable
//

import SwiftUI
import Flow

struct LineBadge: View {
    let line: LineRef
    var small = false

    var body: some View {
        Text(line.shortName ?? "?")
            .font(.system(size: small ? 12 : 14, weight: .semibold))
            .foregroundStyle(Color(hex: line.textColor ?? "#ffffff"))
            .padding(.vertical, small ? 2 : 3)
            .padding(.horizontal, small ? 5 : 7)
            .frame(minWidth: small ? 0 : 38)
            .background(Color(hex: line.color ?? "#000000"))
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

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

    var body: some View {
        if settings.shows(marker) {
            Image(systemName: marker.symbol)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .accessibilityLabel(marker.title)
        }
    }
}
