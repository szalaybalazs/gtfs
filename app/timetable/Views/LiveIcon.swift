//
//  LiveIcon.swift
//  timetable
//
//  The realtime mark, shared with the widgets.
//

import SwiftUI

/// The realtime ("live") mark: three arcs, same path as the web LiveIcon.
struct LiveIcon: View {
    var size: CGFloat = 12
    var body: some View {
        LiveShape()
            .stroke(style: StrokeStyle(lineWidth: size * 2.6 / 24, lineCap: .round))
            .frame(width: size, height: size)
    }
}

private struct LiveShape: Shape {
    func path(in rect: CGRect) -> Path {
        let k = rect.width / 24
        var p = Path()
        p.move(to: CGPoint(x: 5 * k, y: 19 * k)); p.addLine(to: CGPoint(x: 5.01 * k, y: 19 * k))
        p.move(to: CGPoint(x: 5 * k, y: 13 * k))
        p.addArc(center: CGPoint(x: 5 * k, y: 19 * k), radius: 6 * k, startAngle: .degrees(-90), endAngle: .degrees(0), clockwise: false)
        p.move(to: CGPoint(x: 5 * k, y: 7 * k))
        p.addArc(center: CGPoint(x: 5 * k, y: 19 * k), radius: 12 * k, startAngle: .degrees(-90), endAngle: .degrees(0), clockwise: false)
        return p
    }
}
