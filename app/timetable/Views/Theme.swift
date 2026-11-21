//
//  Theme.swift
//  timetable
//
//  Colours, cards and small glyphs from the web app (web/src/index.css, Icons.tsx, realtimeStatus.ts).
//

import SwiftUI
import UIKit

enum Theme {
    private static func dynamic(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
    }

    static let accent = dynamic(0xb5179e, 0xec5fd6)
    static let live = dynamic(0x16a34a, 0x4ade80)
    static let late = dynamic(0xdc2626, 0xf87171)
    static let early = dynamic(0x9333ea, 0xc084fc)
    static let canvas = Color(.systemGroupedBackground)
    static let surface = Color(.secondarySystemGroupedBackground)
    static let fill = Color(.tertiarySystemFill)
    static let separator = Color(.separator)
    static let secondary = Color(.secondaryLabel)

    /// Text colour for a time by how it relates to the schedule (web/src/lib/realtimeStatus.ts).
    static func color(_ status: RealtimeStatus) -> Color {
        switch status {
        case .scheduled: return .primary
        case .onTime: return live
        case .early: return early
        case .late: return late
        }
    }
}

private extension UIColor {
    convenience init(hex: UInt32) {
        self.init(red: CGFloat((hex >> 16) & 0xff) / 255, green: CGFloat((hex >> 8) & 0xff) / 255, blue: CGFloat(hex & 0xff) / 255, alpha: 1)
    }
}

/// White rounded card on the grey background; rows inside get separators.
struct Card<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        VStack(spacing: 0) { content }
            .frame(maxWidth: .infinity)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

/// A list of rows with hairline separators between them.
struct RowList<Data: RandomAccessCollection, ID: Hashable, Row: View>: View {
    let data: Data
    let id: KeyPath<Data.Element, ID>
    @ViewBuilder var row: (Data.Element) -> Row

    var body: some View {
        let items = Array(data)
        VStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.offset) { i, item in
                if i > 0 { Rectangle().fill(Theme.separator).frame(height: 1 / UIScreen.main.scale) }
                row(item)
            }
        }
    }
}

/// Section heading: 20 pt bold, small side inset.
struct SectionTitle<Trailing: View>: View {
    let title: LocalizedStringKey
    @ViewBuilder var trailing: Trailing
    var body: some View {
        HStack {
            Text(title).font(.system(size: 20, weight: .bold))
            Spacer(minLength: 8)
            trailing
        }
        .padding(.horizontal, 4)
        .padding(.bottom, 8)
    }
}

extension SectionTitle where Trailing == EmptyView {
    init(_ title: LocalizedStringKey) { self.init(title: title) { EmptyView() } }
}

/// Fill flash on press, like the web rows' `active:bg-fill`.
struct RowButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .contentShape(Rectangle())
            .background(configuration.isPressed ? Theme.fill : Color.clear)
    }
}

struct Chevron: View {
    var double = false
    var body: some View {
        Image(systemName: double ? "chevron.forward.2" : "chevron.right")
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Theme.secondary.opacity(0.6))
            .frame(width: 16)
    }
}

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

/// Kinds of transport as small glyphs (the web uses BKK pictograms).
extension LineCategory {
    /// The official BKK pictogram (asset catalog, vector, template: tinted with `tint`).
    var asset: String {
        switch self {
        case .metro: return "mode_metro"
        case .tram: return "mode_tram"
        case .trolleybus: return "mode_trolleybus"
        case .bus: return "mode_bus"
        case .night: return "mode_night"
        case .boat: return "mode_boat"
        case .other: return "mode_other"
        }
    }

    var tint: Color {
        switch self {
        case .metro, .night: return .primary
        case .tram: return Color(hex: "#e8b800")
        case .trolleybus: return Color(hex: "#e41f18")
        case .bus: return Color(hex: "#009EE3")
        case .boat: return Color(hex: "#2b5ba8")
        case .other: return Color(hex: "#7a6a58")
        }
    }
}

/// A mode pictogram at the web's size (20 pt in rows).
struct ModeIcon: View {
    let category: LineCategory
    var size: CGFloat = 20
    var body: some View {
        Image(category.asset).renderingMode(.template).resizable().scaledToFit()
            .frame(width: size, height: size).foregroundStyle(category.tint)
    }
}
