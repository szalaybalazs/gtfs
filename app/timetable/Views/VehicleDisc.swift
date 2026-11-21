//
//  VehicleDisc.swift
//  timetable
//
//  The map vehicle marker, same as web/src/lib/mapIcons.ts vehicleIcon.
//

import SwiftUI

private struct ArrowTriangle: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: r.midX, y: r.minY))
        p.addLine(to: CGPoint(x: r.maxX, y: r.maxY))
        p.addLine(to: CGPoint(x: r.minX, y: r.maxY))
        p.closeSubpath()
        return p
    }
}

struct VehicleDisc: View {
    let line: LineRef?
    let bearing: Double?
    var selected = false
    /// Zoomed out: just a small route-coloured dot.
    var compact = false
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let bg = Color(hex: line?.color ?? "#6b7280")
        let fg = Color(hex: line?.textColor ?? "#ffffff")
        let label = line?.shortName ?? ""
        let long = label.count > 3
        let size: CGFloat = long ? 34 : 28
        if compact {
            Circle().fill(bg).frame(width: 14, height: 14)
                .overlay(Circle().stroke(Color.white, lineWidth: 2))
                // Selected: a halo in the line's colour and a bigger dot, like the badge
                .background { if selected { Circle().fill(bg.opacity(0.3)).padding(-7) } }
                .scaleEffect(selected ? 1.3 : 1)
                .animation(.spring(response: 0.2, dampingFraction: 0.8), value: selected)
                .padding(8)
        } else {
            ZStack {
                if let bearing {
                    ArrowTriangle().fill(scheme == .dark ? Color.white : bg).frame(width: 10, height: 7)
                        .offset(y: -(size / 2 + 3.5))
                        .rotationEffect(.degrees(bearing))
                }
                Circle().fill(bg)
                    .overlay(Circle().stroke(Color.white, lineWidth: 2))
                    .overlay(Text(label).font(.system(size: long ? 10 : 12, weight: .bold)).foregroundStyle(fg)
                        .lineLimit(1).minimumScaleFactor(0.6).padding(.horizontal, 2))
                    .background { if selected { Circle().fill(bg.opacity(0.25)).padding(-7) } }
                    .frame(width: size, height: size)
            }
            .frame(width: size + 28, height: size + 28)
            .scaleEffect(selected ? 1.15 : 1)
            .animation(.spring(response: 0.2, dampingFraction: 0.8), value: selected)
        }
    }
}
