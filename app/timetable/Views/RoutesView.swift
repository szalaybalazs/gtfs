//
//  RoutesView.swift
//  timetable
//
//  All lines: category chips on top, lines as BKK-coloured tiles grouped by mode, search
//  (web/src/pages/RoutesPage.tsx, CategoryChips.tsx, RouteTile.tsx).
//

import SwiftUI
import Flow

/// Replacement buses count as part of the tram / metro they replace.
func replacesCategory(_ line: LineRef) -> LineCategory? {
    if line.routeId.uppercased().hasPrefix("VP") { return .tram }
    if line.routeId.uppercased().hasPrefix("MP") { return .metro }
    return nil
}

private func groupOf(_ r: RouteInfo) -> LineCategory { replacesCategory(r.line) ?? LineCategory.of(r.line) }

private func fold(_ s: String?) -> String { (s ?? "").folding(options: [.diacriticInsensitive, .caseInsensitive], locale: nil) }

/// Black or white, whichever reads better on this background.
private func onColor(_ hex: String) -> Color {
    let h = hex.replacingOccurrences(of: "#", with: "")
    guard h.count == 6, let v = Int(h, radix: 16) else { return .white }
    let (r, g, b) = (Double((v >> 16) & 255) / 255, Double((v >> 8) & 255) / 255, Double(v & 255) / 255)
    return 0.299 * r + 0.587 * g + 0.114 * b > 0.6 ? .black : .white
}

/// A line as a big coloured tile with the badge's 2:1 proportions.
struct RouteTile: View {
    let line: LineRef
    var compact = false

    var body: some View {
        // The shape decides the size (full cell width, 2:1, or 80x40 compact); the label only sits on it
        RoundedRectangle(cornerRadius: 10, style: .continuous)
            .fill(Color(hex: line.color ?? "#000000"))
            .aspectRatio(2, contentMode: .fit)
            .frame(width: compact ? 80 : nil)
            .frame(maxWidth: compact ? nil : .infinity, maxHeight: compact ? nil : .infinity)
            .overlay {
                Text(line.shortName ?? line.routeId)
                    .font(.system(size: 18, weight: .bold)).lineLimit(1).minimumScaleFactor(0.6)
                    .foregroundStyle(Color(hex: line.textColor ?? "#ffffff"))
                    .padding(.horizontal, 4)
            }
    }
}

struct RoutesView: View {
    @State private var model = RoutesViewModel()
    @State private var store = FavoritesStore.shared
    @State private var searchText = ""
    @State private var category: LineCategory?


    private var searching: Bool { !searchText.trimmingCharacters(in: .whitespaces).isEmpty }

    /// In the picked type, then by search (accent-insensitive; line-number matches first).
    private var routes: [RouteInfo] {
        let inCategory = model.routes.filter { category == nil || groupOf($0) == category }
        guard searching else { return inCategory }
        let q = fold(searchText.trimmingCharacters(in: .whitespaces))
        func score(_ r: RouteInfo) -> Int? {
            let name = fold(r.line.shortName)
            if name == q { return 0 }
            if name.hasPrefix(q) { return 1 }
            if fold(r.desc).contains(q) || fold(r.longName).contains(q) || name.contains(q) { return 2 }
            return nil
        }
        return inCategory.compactMap { r in score(r).map { (r, $0) } }.sorted { $0.1 < $1.1 }.map(\.0)
    }

    private var groups: [(category: LineCategory, routes: [RouteInfo], replacements: [RouteInfo])] {
        let rs = routes
        return LineCategory.allCases.map { c in
            (c, rs.filter { LineCategory.of($0.line) == c && replacesCategory($0.line) == nil }.sorted { lineOrder($0.line, $1.line) },
             rs.filter { replacesCategory($0.line) == c }.sorted { lineOrder($0.line, $1.line) })
        }.filter { !$0.routes.isEmpty || !$0.replacements.isEmpty }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("Routes").font(.system(size: 34, weight: .bold)).padding(.horizontal, 4).padding(.bottom, -8)
                    .accessibilityAddTraits(.isHeader)
                // Own search field: the system search bar over this scroll view broke scrolling and pull to refresh on device
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass").foregroundStyle(Theme.secondary)
                    TextField("Search lines", text: $searchText).textInputAutocapitalization(.never).autocorrectionDisabled().submitLabel(.search)
                    if !searchText.isEmpty {
                        Button { searchText = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(Theme.secondary) }.accessibilityLabel("Clear")
                    }
                }
                .padding(.horizontal, 12).padding(.vertical, 10)
                .background(Theme.fill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                chips
                if let message = model.state.errorMessage {
                    ErrorView(message: message) { await model.load() }
                }
                let favorites = store.ofKind(.line)
                if !favorites.isEmpty && !searching && category == nil {
                    VStack(spacing: 0) {
                        SectionTitle("Favourites")
                        HFlow(itemSpacing: 8, rowSpacing: 8) {
                            ForEach(favorites) { f in
                                if let r = f.route { link(r.line) { RouteTile(line: r.line, compact: true) } }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                if searching {
                    VStack(spacing: 0) {
                        SectionTitle("Best matches")
                        grid(Array(routes.prefix(40)))
                    }
                } else {
                    ForEach(groups, id: \.category) { g in
                        VStack(alignment: .leading, spacing: 0) {
                            HStack(spacing: 8) {
                                ModeIcon(category: g.category, size: 28)
                                Text(g.category.title).font(.system(size: 20, weight: .bold))
                                Text("\(g.routes.count)").font(.system(size: 15)).foregroundStyle(Theme.secondary)
                            }
                            .padding(.horizontal, 4).padding(.bottom, 8)
                            grid(g.routes)
                            if !g.replacements.isEmpty {
                                HStack(spacing: 4) {
                                    Text("Replacement buses").fontWeight(.semibold)
                                    Text("\(g.replacements.count)").foregroundStyle(Theme.secondary)
                                }
                                .font(.system(size: 15)).foregroundStyle(Theme.secondary)
                                .padding(.top, 16).padding(.bottom, 8).padding(.horizontal, 4)
                                grid(g.replacements)
                            }
                        }
                    }
                }
                if !model.loaded && model.state.errorMessage == nil {
                    TileGrid {
                        ForEach(0..<24, id: \.self) { _ in
                            RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Theme.fill)
                        }
                    }
                    .skeleton()
                } else if model.loaded && routes.isEmpty {
                    Text("No such line").foregroundStyle(Theme.secondary).frame(maxWidth: .infinity).padding(24)
                }
            }
            .padding(.horizontal, 16).padding(.bottom, 16).padding(.top, 8)
        }
        .background(Theme.canvas)
        // The big title is drawn in the content: on iOS 18 a large nav-bar title over this scroll view kept collapsing
        // and re-expanding by itself; an inline bar has a fixed height
        .navigationTitle("Routes")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .principal) { Text(" ") } } // the title is in the content; the name still labels Back buttons
        .task {
            if !model.loaded { await model.load() }
            // Favourite lines are the likeliest next tap: have their pages ready
            for f in store.ofKind(.line) { if let r = f.route { RouteCache.prefetch(r.line.routeId) } }
        }
        .refreshable { await model.load() }
        .transitDestinations()
    }

    private func link<L: View>(_ line: LineRef, @ViewBuilder _ label: () -> L) -> some View {
        NavigationLink(value: RouteTarget(line: line)) { label() }
            .buttonStyle(.plain)
            // Finger down: start loading the line's page, so it is (nearly) ready when the tap lands
            .simultaneousGesture(DragGesture(minimumDistance: 0).onChanged { _ in RouteCache.prefetch(line.routeId) })
    }

    private func grid(_ items: [RouteInfo]) -> some View {
        TileGrid {
            ForEach(items) { r in link(r.line) { RouteTile(line: r.line) } }
        }
    }

    /// The type's own badge colour when most of its lines share one (metro: every line differs, so its pictogram colour).
    private func chipColor(_ c: LineCategory) -> String {
        var counts: [String: Int] = [:]
        for r in model.routes where replacesCategory(r.line) == nil && LineCategory.of(r.line) == c {
            if let col = r.line.color { counts[col, default: 0] += 1 }
        }
        if let top = counts.max(by: { $0.value < $1.value }), Double(top.value) / Double(counts.values.reduce(0, +)) > 0.6 { return "#" + top.key.replacingOccurrences(of: "#", with: "") }
        return c.tintHex
    }

    /// Yellow, red, blue, green: the four metro lines' own colours, in line order.
    private var metroGradient: LinearGradient? {
        let colors = model.routes.filter { replacesCategory($0.line) == nil && LineCategory.of($0.line) == .metro }
            .sorted { lineOrder($0.line, $1.line) }.compactMap { $0.line.color }.map { Color(hex: $0) }
        return colors.count > 1 ? LinearGradient(colors: colors, startPoint: .leading, endPoint: .trailing) : nil
    }

    private var chips: some View {
        let types = LineCategory.allCases.filter { c in c == category || model.routes.contains { groupOf($0) == c } }
        return HFlow(itemSpacing: 8, rowSpacing: 8) {
            Button { category = nil } label: {
                Text("All").font(.system(size: 14, weight: .medium))
                    .foregroundStyle(category == nil ? Color.white : Color.primary)
                    .padding(.horizontal, 12).padding(.vertical, 4)
                    .background(category == nil ? Theme.accent : Theme.fill, in: Capsule())
            }
            ForEach(types, id: \.self) { c in
                let on = category == c
                let bg = chipColor(c)
                // Metro lines each have their own colour: when picked, the chip runs through all of them
                let gradient = c == .metro ? metroGradient : nil
                // Metro: the small icon carries the gradient too when not picked. The pictogram keeps its own colour; picked, it sits on that same colour, so it flips to black / white
                let icon: Color = !on ? c.tint : gradient != nil ? .white : onColor(bg)
                Button { category = c } label: {
                    HStack(spacing: 6) {
                        ModeIcon(category: c, size: 20, flat: on ? icon : nil)
                        Text(c.title).font(.system(size: 14, weight: .medium))
                            .foregroundStyle(!on ? Color.primary : gradient != nil ? Color.white : onColor(bg))
                    }
                    // Same inset on the left, top and bottom: the 20 pt icon is concentric with the pill's round end
                    .padding(.leading, 4).padding(.trailing, 12).padding(.vertical, 4)
                    .background {
                        if on, let gradient { Capsule().fill(gradient) }
                        else { Capsule().fill(on ? Color(hex: bg) : Theme.fill) }
                    }
                }
            }
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, 2)
    }
}

/// Equal 2:1 cells, as many per row as fit at least 72 pt wide. Not lazy: every cell's size follows from the width alone,
/// so the scroll view's content height is exact and nothing shifts while scrolling.
private struct TileGridLayout: Layout {
    let minimum: CGFloat = 72
    let spacing: CGFloat = 8

    private func metrics(_ width: CGFloat) -> (columns: Int, cell: CGFloat) {
        let w = width.isFinite && width > 0 ? width : 320
        let n = max(1, Int(((w + spacing) / (minimum + spacing)).rounded(.down)))
        return (n, (w - spacing * CGFloat(n - 1)) / CGFloat(n))
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let (n, cell) = metrics(proposal.width ?? 320)
        let rows = (subviews.count + n - 1) / n
        let w = proposal.width ?? 320
        return CGSize(width: w, height: rows == 0 ? 0 : CGFloat(rows) * (cell / 2) + CGFloat(rows - 1) * spacing)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let (n, cell) = metrics(bounds.width)
        for (i, v) in subviews.enumerated() {
            let x = bounds.minX + CGFloat(i % n) * (cell + spacing), y = bounds.minY + CGFloat(i / n) * (cell / 2 + spacing)
            v.place(at: CGPoint(x: x, y: y), anchor: .topLeading, proposal: ProposedViewSize(width: cell, height: cell / 2))
        }
    }
}

struct TileGrid<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View { TileGridLayout { content } }
}
