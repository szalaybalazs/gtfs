//
//  MapCards.swift
//  timetable
//
//  The bottom cards the maps share: a tapped vehicle or stop. Used by the main map and by a trip's map.
//

import SwiftUI

enum MapSelection: Equatable {
    case vehicle(String)
    case station(String, stopId: String?)
}

/// The card's contents inside the map sheet: no background of its own (the sheet is the background).
struct CardChrome<Content: View>: View {
    let close: () -> Void
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 8) { content }
            .padding(.horizontal, 16).padding(.top, 20).padding(.bottom, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay(alignment: .topTrailing) {
                Button(action: close) { Image(systemName: "xmark.circle.fill").font(.system(size: 22)).foregroundStyle(Theme.secondary.opacity(0.7)) }
                    .padding(.horizontal, 12).padding(.top, 16)
            }
    }
}

extension View {
    /// Shows the tapped vehicle or stop in a bottom sheet over the map: the map stays usable behind it at the small size,
    /// and a swipe down closes it. Opening a trip or stop from it pushes inside the sheet, which then grows.
    func mapCardSheet<Card: View>(selection: Binding<MapSelection?>, @ViewBuilder card: @escaping (MapSelection) -> Card) -> some View {
        modifier(MapCardSheet(selection: selection, card: card))
    }
}

private struct MapCardSheet<Card: View>: ViewModifier {
    @Binding var selection: MapSelection?
    let card: (MapSelection) -> Card
    @State private var path = NavigationPath()
    @State private var detent: PresentationDetent = Self.small
    private static var small: PresentationDetent { .height(250) }

    func body(content: Content) -> some View {
        content.sheet(isPresented: Binding(get: { selection != nil }, set: { if !$0 { selection = nil } })) {
            NavigationStack(path: $path) {
                ScrollView {
                    if let selection { card(selection) }
                }
                .toolbar(.hidden, for: .navigationBar)
                .transitDestinations()
            }
            .presentationDetents([Self.small, .large], selection: $detent)
            .presentationBackgroundInteraction(.enabled(upThrough: Self.small))
            .presentationDragIndicator(.visible)
            .onChange(of: path.count) { _, n in detent = n > 0 ? .large : Self.small }
            .onDisappear { path = NavigationPath(); detent = Self.small }
        }
    }
}

/// Route badge, destination, vehicle model and plate, delay.
struct VehicleCard: View {
    let vehicle: Vehicle
    let close: () -> Void
    @State private var delay: Int?
    @State private var delayKnown = false

    var body: some View {
        CardChrome(close: close) {
            HStack(spacing: 10) {
                if let r = vehicle.route { LineBadge(line: r) }
                Text(vehicle.headsign ?? tr("Unknown destination")).font(.system(size: 17, weight: .semibold)).lineLimit(2)
                    .padding(.trailing, 28)
            }
            if let updated = vehicle.updated {
                TimelineView(.periodic(from: .now, by: 1)) { ctx in
                    let age = max(0, Int(ctx.date.timeIntervalSince(updated)))
                    Text(age < 60 ? tr("Updated \(age)s ago") : tr("Updated \(age / 60) min ago"))
                        .font(.system(size: 13)).foregroundStyle(Theme.secondary).monospacedDigit()
                }
            }
            let info = [vehicle.model, vehicle.plate].compactMap { $0 }.joined(separator: " · ")
            if !info.isEmpty { Text(info).font(.system(size: 15)).foregroundStyle(Theme.secondary) }
            if delayKnown, let delay {
                let minutes = Int((Double(abs(delay)) / 60).rounded())
                Text(minutes == 0 ? tr("On time") : delay > 0 ? tr("\(minutes) min late") : tr("\(minutes) min early"))
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(minutes == 0 ? Theme.live : delay > 0 ? Theme.late : Theme.early)
            }
            if let tripId = vehicle.tripId, let date = vehicle.serviceDate {
                NavigationLink(value: TripTarget(tripId: tripId, serviceDate: date, route: vehicle.route, headsign: vehicle.headsign)) {
                    Text("Open trip →").font(.system(size: 15, weight: .medium)).foregroundStyle(Theme.accent)
                }
            }
        }
        .task(id: vehicle.tripId) {
            delay = nil; delayKnown = false
            guard let tripId = vehicle.tripId, let date = vehicle.serviceDate else { return }
            let m = TripViewModel()
            await m.load(tripId: tripId, serviceDate: date)
            // Delay at the last stop with realtime data that the vehicle has reached
            let now = Date()
            let reached = (m.trip?.stops ?? []).filter { $0.departure <= now || $0.arrival <= now }
            delay = reached.last(where: { $0.realtime }).flatMap { $0.departureDelay ?? $0.arrivalDelay }
            delayKnown = true
        }
    }
}

/// A stop's (or group's) next departures.
struct StopCard: View {
    let stationId: String
    let stopId: String?
    /// Already known (the main map); otherwise loaded here (a trip's map only has the stop's id).
    var station: Station? = nil
    var fallbackName: String? = nil
    let close: () -> Void
    @State private var loaded: Station?
    private var shown: Station? { station ?? loaded }
    private var platform: Platform? { shown?.platforms.first { $0.stopId == stopId } }
    private var lines: [LineRef] { platform?.routes ?? shown?.routes ?? [] }

    var body: some View {
        CardChrome(close: close) {
            Text(platform?.name ?? shown?.name ?? fallbackName ?? "").font(.system(size: 17, weight: .semibold)).padding(.trailing, 28)
            if let p = platform, !p.headsigns.isEmpty {
                Text(tr("towards \(p.headsigns.joined(separator: " / "))")).font(.system(size: 13)).foregroundStyle(Theme.secondary)
            }
            // Just the lines that stop here; times are on the departures page
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) { ForEach(lines, id: \.routeId) { r in LineBadge(line: r) } }
            }
            NavigationLink(value: StationTarget(stationId: stationId, from: stopId)) {
                Text("Departures →").font(.system(size: 15, weight: .medium)).foregroundStyle(Theme.accent)
            }
        }
        .task {
            guard station == nil else { return }
            let m = StationViewModel()
            await m.load(id: stationId)
            loaded = m.station
        }
    }
}
