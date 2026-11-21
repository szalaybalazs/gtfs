//
//  FavoritesProvider.swift
//  BudapestGONEWidgets
//
//  Fetches the departures once and hands WidgetKit a timeline with an entry every minute for half an hour;
//  the times are counted from each entry's date, so they tick down without more network use.
//

import WidgetKit

/// One favourite with its fetched departures.
struct FavoriteData {
    let id: String
    let title: String
    let subtitle: String?
    /// Badges to show when there are no departures.
    let lines: [LineRef]
    let departures: [Departure]
    let url: URL
}

struct FavoritesEntry: TimelineEntry {
    let date: Date
    let favorites: [FavoriteData]
    /// The user has nothing to show (no favourites with stops).
    let noFavorites: Bool
}

struct FavoritesProvider: AppIntentTimelineProvider {
    static let entryCount = 30
    static let refreshMinutes = 15

    func placeholder(in context: Context) -> FavoritesEntry { Self.sample(Date()) }

    func snapshot(for configuration: SelectFavoriteIntent, in context: Context) async -> FavoritesEntry {
        if context.isPreview { return Self.sample(Date()) }
        let entry = await load(configuration, family: context.family, at: Date())
        return entry.noFavorites ? Self.sample(Date()) : entry
    }

    func timeline(for configuration: SelectFavoriteIntent, in context: Context) async -> Timeline<FavoritesEntry> {
        let now = Date()
        let base = await load(configuration, family: context.family, at: now)
        // Now, then every full minute
        let nextMinute = Date(timeIntervalSinceReferenceDate: (now.timeIntervalSinceReferenceDate / 60).rounded(.down) * 60 + 60)
        let entries = [base] + (0..<Self.entryCount).map { i in
            FavoritesEntry(date: nextMinute.addingTimeInterval(Double(i) * 60), favorites: base.favorites, noFavorites: base.noFavorites)
        }
        let failed = !base.noFavorites && base.favorites.allSatisfy { $0.departures.isEmpty }
        // Nothing loaded: try again sooner
        let refresh = now.addingTimeInterval(Double(failed ? 5 : Self.refreshMinutes) * 60)
        return Timeline(entries: entries, policy: .after(refresh))
    }

    private func load(_ configuration: SelectFavoriteIntent, family: WidgetFamily, at date: Date) async -> FavoritesEntry {
        let saved = FavoritesStore.widgetFavorites()
        // The picked favourite (else the first saved one); a second only where there is room for it
        let first = configuration.favorite.flatMap { c in saved.first { $0.id == c.id } } ?? saved.first
        var chosen = first.map { [$0] } ?? []
        if family == .systemMedium || family == .systemLarge,
           let second = configuration.secondFavorite.flatMap({ c in saved.first { $0.id == c.id } }), second.id != first?.id {
            chosen.append(second)
        }
        guard !chosen.isEmpty else { return FavoritesEntry(date: date, favorites: [], noFavorites: true) }
        let data = await withTaskGroup(of: (Int, FavoriteData).self) { group in
            for (i, f) in chosen.enumerated() { group.addTask { (i, await Self.fetch(f, longer: true)) } }
            var out: [(Int, FavoriteData)] = []
            for await r in group { out.append(r) }
            return out.sorted { $0.0 < $1.0 }.map(\.1)
        }
        return FavoritesEntry(date: date, favorites: data, noFavorites: false)
    }

    private static func fetch(_ f: Favorite, longer: Bool) async -> FavoriteData {
        let list = (try? await DeparturesViewModel.fetch(f.makeRequest(longer: longer), client: Network.shared)) ?? []
        let only = f.departureRouteIds.map(Set.init)
        let lines = f.kind == .lineStop ? (f.route.map { [$0.line] } ?? []) : (f.routes ?? []).map(\.line)
        return FavoriteData(
            id: f.id, title: f.widgetTitle, subtitle: f.widgetSubtitle, lines: lines,
            departures: list.filter { d in d.route != nil && (only == nil || only!.contains(d.route!.routeId)) }.sorted { $0.departure < $1.departure },
            url: f.stationTarget.url)
    }

    /// Made-up departures for the gallery, placeholder and an empty home screen.
    static func sample(_ now: Date) -> FavoritesEntry {
        let m2 = LineRef(routeId: "M2", shortName: "M2", color: "#E41F18", textColor: "#FFFFFF", type: "SUBWAY")
        let t4 = LineRef(routeId: "4", shortName: "4", color: "#FFD800", textColor: "#000000", type: "TRAM")
        let b9 = LineRef(routeId: "9", shortName: "9", color: "#009EE3", textColor: "#FFFFFF", type: "BUS")
        func dep(_ line: LineRef, _ head: String, _ minutes: Double, live: Bool) -> Departure {
            let t = now.addingTimeInterval(minutes * 60)
            return Departure(tripId: "\(line.routeId)-\(minutes)", serviceDate: "", stopId: "s", headsign: head, arrival: t, departure: t,
                             arrivalDelay: nil, departureDelay: nil, realtime: live, wheelchairAccessible: false, bikesAllowed: false,
                             frontDoor: false, onRequest: false, terminates: false, route: line)
        }
        let list = [dep(m2, "Örs vezér tere", 2, live: true), dep(t4, "Móricz Zsigmond körtér", 4, live: true), dep(b9, "Bosnyák tér", 6, live: false),
                    dep(m2, "Örs vezér tere", 8, live: true), dep(t4, "Móricz Zsigmond körtér", 11, live: true), dep(b9, "Bosnyák tér", 16, live: false),
                    dep(m2, "Örs vezér tere", 14, live: true), dep(t4, "Móricz Zsigmond körtér", 18, live: false), dep(b9, "Bosnyák tér", 26, live: false)]
        let one = FavoriteData(id: "a", title: "Deák Ferenc tér", subtitle: nil, lines: [m2, t4, b9], departures: list, url: URL(string: "\(SharedDefaults.urlScheme)://")!)
        let two = FavoriteData(id: "b", title: "Blaha Lujza tér", subtitle: nil, lines: [t4, b9], departures: list.reversed(), url: one.url)
        return FavoritesEntry(date: now, favorites: [one, two], noFavorites: false)
    }
}
