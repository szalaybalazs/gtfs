//
//  Skeleton.swift
//  timetable
//
//  Placeholder screens: the real layout is built before the data arrives, with its text and shapes
//  greyed out and shimmering (replaces spinners on grey bars).
//

import SwiftUI

private struct Shimmer: ViewModifier {
    @State private var phase: CGFloat = -1
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .overlay {
                if !reduceMotion {
                    GeometryReader { geo in
                        LinearGradient(colors: [.clear, Color.white.opacity(0.35), .clear], startPoint: .leading, endPoint: .trailing)
                            .frame(width: geo.size.width * 0.6)
                            .offset(x: phase * geo.size.width * 1.6)
                    }
                    .allowsHitTesting(false)
                    .mask(content)
                }
            }
            .onAppear { withAnimation(.linear(duration: 1.3).repeatForever(autoreverses: false)) { phase = 1 } }
    }
}

extension View {
    /// While `active`, text and images become grey placeholders with a soft shimmer, and nothing can be tapped.
    @ViewBuilder func skeleton(_ active: Bool = true) -> some View {
        if active {
            self.redacted(reason: .placeholder).modifier(Shimmer()).allowsHitTesting(false).accessibilityHidden(true)
        } else {
            self
        }
    }
}

/// A grey bar standing in for a line of text.
struct SkeletonBar: View {
    var width: CGFloat? = nil
    var height: CGFloat = 14
    var body: some View {
        RoundedRectangle(cornerRadius: 5, style: .continuous).fill(Theme.fill).frame(width: width, height: height)
    }
}

/// A card of departure-like rows: line badge, destination, time.
struct SkeletonDepartureRows: View {
    var count = 6
    var body: some View {
        VStack(spacing: 0) {
            ForEach(0..<count, id: \.self) { i in
                if i > 0 { Rectangle().fill(Theme.separator).frame(height: 1 / UIScreen.main.scale) }
                HStack(spacing: 12) {
                    RoundedRectangle(cornerRadius: 5, style: .continuous).fill(Theme.fill).frame(width: 48, height: 24)
                    SkeletonBar(width: CGFloat(90 + (i * 37) % 90))
                    Spacer()
                    SkeletonBar(width: 36)
                }
                .padding(.horizontal, 16).frame(height: 52)
            }
        }
        .skeleton()
    }
}

/// A card of stops along a line: dot on the rail, name.
struct SkeletonStopList: View {
    var count = 8
    var body: some View {
        VStack(spacing: 0) {
            SectionTitle("Stops")
            Card {
                VStack(spacing: 0) {
                    ForEach(0..<count, id: \.self) { i in
                        HStack(spacing: 0) {
                            ZStack {
                                Rectangle().fill(Theme.fill).frame(width: 8)
                                    .padding(.top, i == 0 ? 24 : 0).padding(.bottom, i == count - 1 ? 24 : 0)
                                Circle().fill(Theme.surface).overlay(Circle().strokeBorder(Theme.fill, lineWidth: 2)).frame(width: 10, height: 10)
                            }
                            .frame(width: 28, height: 48).padding(.leading, 12).padding(.trailing, 6)
                            SkeletonBar(width: CGFloat(110 + (i * 53) % 110))
                            Spacer()
                        }
                    }
                }
                .padding(.vertical, 8)
            }
        }
        .skeleton()
    }
}
