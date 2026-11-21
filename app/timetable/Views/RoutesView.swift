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
        Text(line.shortName ?? line.routeId)
            .font(.system(size: 18, weight: .bold)).lineLimit(1).minimumScaleFactor(0.6)
            .foregroundStyle(Color(hex: line.textColor ?? "#ffffff"))
            .padding(.horizontal, 4)
            .frame(maxWidth: compact ? nil : .infinity)
            .frame(width: compact ? 80 : nil, height: compact ? 40 : nil)
            .aspectRatio(2, contentMode: .fit)
            .background(Color(hex: line.color ?? "#000000"), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

struct RoutesView: View {
    @State private var model = RoutesViewModel()
    @State private var store = FavoritesStore.shared
    @State private var searchText = ""
    @State private var category: LineCategory?

    private let columns = [GridItem(.adaptive(minimum: 72), spacing: 8)]

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
            LazyVStack(alignment: .leading, spacing: 24) {
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
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 24)
                } else if model.loaded && routes.isEmpty {
                    Text("No such line").foregroundStyle(Theme.secondary).frame(maxWidth: .infinity).padding(24)
                }
            }
            .padding(.horizontal, 16).padding(.bottom, 16).padding(.top, 8)
        }
        .background(Theme.canvas)
        .navigationTitle("Routes")
        .searchable(text: $searchText, prompt: "Search lines")
        .safeAreaInset(edge: .top, spacing: 0) { chips }
        .task { if !model.loaded { await model.load() } }
        .refreshable { await model.load() }
        .transitDestinations()
    }

    private func link<L: View>(_ line: LineRef, @ViewBuilder _ label: () -> L) -> some View {
        NavigationLink { RouteDetailsView(id: line.routeId, shortName: line.shortName, line: line) } label: { label() }
            .buttonStyle(.plain)
    }

    private func grid(_ items: [RouteInfo]) -> some View {
        LazyVGrid(columns: columns, spacing: 8) {
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
                Button { category = c } label: {
                    HStack(spacing: 6) {
                        Image(c.asset).renderingMode(.template).resizable().scaledToFit().frame(width: 20, height: 20)
                        Text(c.title).font(.system(size: 14, weight: .medium))
                    }
                    .foregroundStyle(on ? onColor(bg) : Color.primary)
                    .padding(.leading, 6).padding(.trailing, 12).padding(.vertical, 4)
                    .background(on ? Color(hex: bg) : Theme.fill, in: Capsule())
                }
            }
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 10)
        .background(.bar)
    }
}
