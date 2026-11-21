//
//  Alerts.swift
//  timetable
//
//  Service changes (works, diversions, replacement buses) from BKK: banners on pages, a full list, a detail sheet.
//  Mirrors web/src/components/Alerts.tsx and AlertsPage.tsx.
//

import SwiftUI
import TimetableAPI

struct ServiceAlert: Identifiable, Hashable {
    let id: String
    let header: String
    let description: String?
    let url: String?
    let start: Foundation.Date?
    let end: Foundation.Date?
    let routes: [LineRef]

    init(_ a: AlertsQuery.Data.Alert) {
        id = a.id; header = a.header; description = a.description; url = a.url
        start = a.start.flatMap(APIDate.parse); end = a.end.flatMap(APIDate.parse)
        routes = a.routes.map(\.line)
    }

    var planned: Bool { start.map { $0 > Foundation.Date() } ?? false }

    /// BKK's alert links point at the heavy bkk.hu page; the same notice lives on the light BKK Info mobile site.
    var pageURL: URL? {
        guard let url else { return nil }
        if let m = url.firstMatch(of: /bkkinfo(\d+)/) ?? url.firstMatch(of: /[?&#!]i=(\d+)/) {
            return URL(string: "https://m.bkkinfo.hu/zavarok/\(m.1)")
        }
        return url.hasPrefix("https://") ? URL(string: url) : nil
    }

    /// "Nov 18 05:00 – Nov 23 00:35", "since …", "ongoing"
    var period: String {
        let now = Foundation.Date()
        func w(_ d: Foundation.Date) -> String { Self.when(d) }
        // Long-running notices (months/years) just read "ongoing"
        if let end, end.timeIntervalSince(now) > 120 * 86_400 {
            if let start, start > now { return tr("from \(w(start))") }
            return tr("ongoing")
        }
        if let start {
            if let end { return "\(w(start)) – \(w(end))" }
            return start > now ? tr("from \(w(start))") : tr("since \(w(start))")
        }
        if let end { return tr("until \(w(end))") }
        return tr("ongoing")
    }

    private static func when(_ d: Foundation.Date) -> String {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeFormat.budapest
        let day: String
        if cal.isDateInToday(d) { day = tr("today") }
        else if cal.isDateInTomorrow(d) { day = tr("tomorrow") }
        else {
            let f = DateFormatter(); f.locale = L10n.locale; f.timeZone = TimeFormat.budapest; f.dateFormat = "MMM d"
            day = f.string(from: d)
        }
        return "\(day) \(TimeFormat.clock(d))"
    }

    /// Ongoing first (most recently started on top), then planned (soonest first).
    static func split(_ alerts: [ServiceAlert]) -> (ongoing: [ServiceAlert], planned: [ServiceAlert]) {
        let t: (ServiceAlert) -> Foundation.Date = { $0.start ?? .distantPast }
        return (alerts.filter { !$0.planned }.sorted { t($0) > t($1) }, alerts.filter(\.planned).sorted { t($0) < t($1) })
    }

    static func fetch(routeIds: [String], stopIds: [String]) async -> [ServiceAlert] {
        guard !routeIds.isEmpty || !stopIds.isEmpty else { return [] }
        let lang: GraphQLNullable<String> = .some(L10n.locale.language.languageCode?.identifier == "hu" ? "hu" : "en")
        guard let data = try? await Network.shared.fetch(AlertsQuery(
            routeIds: routeIds.isEmpty ? .null : .some(routeIds), stopIds: stopIds.isEmpty ? .null : .some(stopIds), lang: lang)) else { return [] }
        return data.alerts.map(ServiceAlert.init)
    }
}

/// The one flat yellow used for alerts (no hatching).
enum AlertStyle {
    static let background = Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.247, green: 0.196, blue: 0.063, alpha: 1) : UIColor(red: 1, green: 0.945, blue: 0.651, alpha: 1) })
    static let text = Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.965, green: 0.906, blue: 0.765, alpha: 1) : UIColor(red: 0.239, green: 0.18, blue: 0, alpha: 1) })
}

/// One alert as a yellow banner; tap opens it.
struct AlertCard: View {
    let alert: ServiceAlert
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "exclamationmark.triangle").font(.system(size: 17, weight: .semibold)).padding(.top, 1)
            VStack(alignment: .leading, spacing: 4) {
                if !alert.routes.isEmpty {
                    HFlowBadges(lines: Array(alert.routes.prefix(6)))
                }
                Text(alert.header).font(.system(size: 15, weight: .semibold)).lineLimit(2).multilineTextAlignment(.leading)
                Text((alert.planned ? tr("Planned (one)") + " · " : "") + alert.period).font(.system(size: 13)).opacity(0.7)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).opacity(0.5).padding(.top, 4)
        }
        .foregroundStyle(AlertStyle.text)
        .padding(.horizontal, 16).padding(.vertical, 12)
        .background(AlertStyle.background, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .contentShape(Rectangle())
    }
}

private struct HFlowBadges: View {
    let lines: [LineRef]
    var body: some View {
        HStack(spacing: 4) { ForEach(lines, id: \.routeId) { LineBadge(line: $0, fit: true) } }
    }
}

/// Alerts on a page: the two most relevant (ongoing first); more of them go to the full list.
struct AlertsSection: View {
    let routeIds: [String]
    var stopIds: [String] = []
    @State private var alerts: [ServiceAlert] = []
    @State private var open: ServiceAlert?

    var body: some View {
        // A stack, not a Group: with nothing to show a Group has no view for `.task` to hang on, so alerts would never load
        VStack(spacing: 8) {
            if !alerts.isEmpty {
                let (ongoing, planned) = ServiceAlert.split(alerts)
                let ordered = ongoing + planned
                let shown = ordered.count > 2 ? Array(ordered.prefix(2)) : ordered
                let shownIds = Set(shown.map(\.id))
                let moreOngoing = ongoing.filter { !shownIds.contains($0.id) }.count
                let morePlanned = planned.filter { !shownIds.contains($0.id) }.count
                Group {
                    ForEach(shown) { a in
                        Button { open = a } label: { AlertCard(alert: a) }.buttonStyle(.plain)
                    }
                    if moreOngoing + morePlanned > 0 {
                        NavigationLink { AlertsListView(routeIds: routeIds, stopIds: stopIds) } label: {
                            HStack(spacing: 12) {
                                Text([moreOngoing > 0 ? tr("\(moreOngoing) more ongoing") : nil, morePlanned > 0 ? tr("\(morePlanned) planned") : nil]
                                    .compactMap { $0 }.joined(separator: " · "))
                                    .font(.system(size: 15, weight: .semibold)).frame(maxWidth: .infinity, alignment: .leading)
                                Text("See all").font(.system(size: 13, weight: .medium)).opacity(0.7)
                                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).opacity(0.5)
                            }
                            .foregroundStyle(AlertStyle.text)
                            .padding(.horizontal, 16).padding(.vertical, 12)
                            .background(AlertStyle.background, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        // Empty, the stack is zero height but the parent's spacing still applies: take it back
        .padding(.vertical, alerts.isEmpty ? -12 : 0)
        .task(id: routeIds + ["|"] + stopIds) { alerts = await ServiceAlert.fetch(routeIds: routeIds, stopIds: stopIds) }
        .sheet(item: $open) { AlertSheet(alert: $0) }
    }
}

/// Every service change for lines / stops: ongoing, then planned.
struct AlertsListView: View {
    let routeIds: [String]
    var stopIds: [String] = []
    @State private var alerts: [ServiceAlert] = []
    @State private var loaded = false
    @State private var open: ServiceAlert?

    var body: some View {
        let (ongoing, planned) = ServiceAlert.split(alerts)
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if !loaded {
                    ForEach(0..<3, id: \.self) { _ in RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Theme.surface).frame(height: 80) }.skeleton()
                } else if alerts.isEmpty {
                    Text("No service changes.").foregroundStyle(Theme.secondary).frame(maxWidth: .infinity).padding(24)
                }
                group("Ongoing", ongoing)
                group("Planned", planned)
            }
            .padding(16)
        }
        .background(Theme.canvas)
        .navigationTitle("Service changes")
        .navigationBarTitleDisplayMode(.inline)
        .task { alerts = await ServiceAlert.fetch(routeIds: routeIds, stopIds: stopIds); loaded = true }
        .sheet(item: $open) { AlertSheet(alert: $0) }
    }

    @ViewBuilder
    private func group(_ title: LocalizedStringKey, _ list: [ServiceAlert]) -> some View {
        if !list.isEmpty {
            VStack(spacing: 0) {
                SectionTitle(title: title) { Text("\(list.count)").foregroundStyle(Theme.secondary) }
                VStack(spacing: 8) {
                    ForEach(list) { a in Button { open = a } label: { AlertCard(alert: a) }.buttonStyle(.plain) }
                }
            }
        }
    }
}

/// The change itself: its text, with a way out to BKK's page.
struct AlertSheet: View {
    let alert: ServiceAlert
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    if !alert.routes.isEmpty { HFlowBadges(lines: Array(alert.routes.prefix(10))) }
                    Text(alert.header).font(.system(size: 20, weight: .bold))
                    Text(alert.period).font(.system(size: 14)).foregroundStyle(Theme.secondary)
                    Text(alert.description ?? tr("No details.")).font(.system(size: 16)).padding(.top, 4)
                    if let url = alert.pageURL {
                        Link(destination: url) { Text("Open in browser").font(.system(size: 16, weight: .medium)) }.padding(.top, 8)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
            }
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Close") { dismiss() } } }
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.large])
    }
}
