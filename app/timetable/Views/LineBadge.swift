//
//  LineBadge.swift
//  timetable
//

import SwiftUI
import Flow

/// Line badge with BKK's proportions (web/src/components/RouteBadge.tsx): a 2s x s rounded rectangle, s = 24 (32 large).
struct LineBadge: View {
    let line: LineRef
    var large = false
    /// Kept for callers that used the old compact style; the badge now has one shape.
    var small = false
    /// Hug the label (min 1.25 s wide) instead of the fixed 2:1 width, for dense rows.
    var fit = false

    var body: some View {
        let s: CGFloat = large ? 32 : 24
        let label = line.shortName ?? line.routeId
        // Shrink long labels so they fit the 2s width
        let base = s * 0.58
        let size = fit ? base : min(base, s * 1.75 / (CGFloat(max(label.count, 1)) * 0.62))
        Text(label)
            .font(.system(size: size, weight: .bold))
            .monospacedDigit()
            .tracking(label.count > 3 ? -size * 0.02 : 0)
            .lineLimit(1)
            .foregroundStyle(Color(hex: line.textColor ?? "#ffffff"))
            .padding(.horizontal, fit ? s * 0.25 : 0)
            .frame(width: fit ? nil : s * 2, height: s)
            .frame(minWidth: fit ? s * 1.25 : nil)
            .fixedSize()
            .background(Color(hex: line.color ?? "#000000"))
            .clipShape(RoundedRectangle(cornerRadius: 5 * s / 24, style: .continuous))
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
