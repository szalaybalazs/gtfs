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

/// Opens a destination (a trip or a stop) outside the sheet, in the tab's own stack. Nil: push inside the sheet.
typealias CardOpen = ((any Hashable) -> Void)?

/// The card's contents inside the map sheet: no background of its own (the sheet is the background).
struct CardChrome<Content: View>: View {
    let close: () -> Void
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 8) { content }
            .padding(.horizontal, 16).padding(.top, 20).padding(.bottom, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay(alignment: .topTrailing) {
                Button(action: close) { Text(tr("Close")).font(.system(size: 15, weight: .medium)).foregroundStyle(Theme.accent) }
                    .padding(.horizontal, 12).padding(.top, 16)
            }
    }
}

/// A destination value as its concrete type. `CardLayout` hands the button's value over as AnyHashable; a NavigationPath
/// appended with an AnyHashable has no destination registered for it, which shows as a blank page with a yellow triangle.
private func concrete(_ v: any Hashable) -> any Hashable { (AnyHashable(v).base as? any Hashable) ?? v }

/// A link inside a card: with `open`, it closes the sheet and opens the page in the tab; without, it pushes inside the sheet.
struct CardLink<Value: Hashable, Label: View>: View {
    let value: Value
    let open: CardOpen
    @ViewBuilder let label: Label
    var body: some View {
        if let open {
            Button { open(concrete(value)) } label: { label }.buttonStyle(.plain)
        } else {
            NavigationLink(value: concrete(value)) { label }
        }
    }
}

extension View {
    /// Shows the tapped vehicle or stop in a bottom sheet over the map: the map stays usable behind it at the small size,
    /// and a swipe down closes it. With `open`, the card's links close the sheet and open the page full-screen in the tab;
    /// without it (a trip's map), they push inside the sheet, which then grows.
    func mapCardSheet<Card: View>(selection: Binding<MapSelection?>, open: CardOpen = nil,
                                  @ViewBuilder card: @escaping (MapSelection, CardOpen) -> Card) -> some View {
        modifier(MapCardSheet(selection: selection, open: open, card: card))
    }
}

private struct CardHeightKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
}

private struct MapCardSheet<Card: View>: ViewModifier {
    @Binding var selection: MapSelection?
    let open: CardOpen
    let card: (MapSelection, CardOpen) -> Card
    @State private var path = NavigationPath()
    /// The card's own height: the small size fits the card exactly (a fixed number was always too tall or too short).
    @State private var cardHeight: CGFloat = 178
    @State private var detent: PresentationDetent = .height(178)
    /// Space the system grab bar takes above the card (the card does not scroll at the small size, so a drag anywhere moves the sheet).
    private static var chrome: CGFloat { 0 }
    private var small: PresentationDetent { .height(cardHeight + Self.chrome) }
    /// A link was tapped: the page opens once the sheet has finished dismissing (a push during the dismissal is dropped).
    @State private var pendingOpen: (() -> Void)?

    /// Closes the sheet; the page opens from `onDismiss`.
    private var openFromSheet: CardOpen {
        guard let open else { return nil }
        return { value in
            pendingOpen = { open(value) }
            selection = nil
        }
    }

    func body(content: Content) -> some View {
        content.sheet(isPresented: Binding(get: { selection != nil }, set: { if !$0 { selection = nil } }), onDismiss: {
            // Reset for the next card, then open the page that was tapped
            path = NavigationPath()
            detent = small
            let open = pendingOpen
            pendingOpen = nil
            open?()
        }) {
            NavigationStack(path: $path) {
                VStack(spacing: 0) {
                    ScrollView {
                        if let selection {
                            card(selection, openFromSheet)
                                .background(GeometryReader { Color.clear.preference(key: CardHeightKey.self, value: $0.size.height) })
                        }
                    }
                    .scrollBounceBehavior(.basedOnSize)
                }
                .toolbar(.hidden, for: .navigationBar)
                .transitDestinations()
            }
            .onPreferenceChange(CardHeightKey.self) { h in
                guard h > 0 else { return }
                cardHeight = h
                // Only the card's own size counts: a page pushed inside the sheet is measured too, and must not shrink the sheet
                if path.isEmpty { detent = .height(h + Self.chrome) }
            }
            .presentationDetents([small, .large], selection: $detent)
            .presentationDragIndicator(.visible)
            .presentationBackgroundInteraction(.enabled(upThrough: small))
            .onChange(of: path.count) { _, n in detent = n > 0 ? .large : small }
        }
    }
}

/// The one layout both cards share: title row, info line, status line (height reserved), full-width button.
struct CardLayout<Badge: View, Info: View, Status: View>: View {
    let title: String
    let loading: Bool
    let buttonTitle: String
    let buttonValue: AnyHashable?
    let open: CardOpen
    let close: () -> Void
    /// Without an info line, no space is reserved for it (a stop with no "towards" line).
    var showsInfo: Bool = true
    @ViewBuilder var badge: Badge
    @ViewBuilder var info: Info
    @ViewBuilder var status: Status

    var body: some View {
        CardChrome(close: close) {
            // Title and its info line sit close together (the card's own spacing is looser)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 10) {
                    badge
                    Text(loading ? "Placeholder headline" : title).font(.system(size: 17, weight: .semibold)).lineLimit(2)
                        .redacted(reason: loading ? .placeholder : [])
                        .padding(.trailing, 48)
                }
                .frame(minHeight: 28, alignment: .leading)
                if showsInfo { info.frame(minHeight: 20, alignment: .leading) }
            }
            status.frame(minHeight: 20, alignment: .leading)
            // No button (an unassigned vehicle, or a stop without a way in): no space is reserved for one
            if let value = buttonValue {
                CardLink(value: value, open: open) {
                    Text(buttonTitle).font(.system(size: 17, weight: .semibold)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .background(Theme.accent, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .padding(.top, 4)
            }
        }
    }
}

/// Route badge, destination, vehicle model and plate, delay.
struct VehicleCard: View {
    let vehicle: Vehicle
    var open: CardOpen = nil
    let close: () -> Void
    @State private var delay: Int?
    @State private var delayKnown = false

    var body: some View {
        CardLayout(title: vehicle.headsign ?? tr("Unknown destination"), loading: false, buttonTitle: tr("Open trip"),
                   buttonValue: tripTarget.map { AnyHashable($0) }, open: open, close: close) {
            if let r = vehicle.route { LineBadge(line: r) }
        } info: {
            let info = [vehicle.model, vehicle.plate].compactMap { $0 }.joined(separator: " · ")
            Text(info.isEmpty ? " " : info).font(.system(size: 15)).foregroundStyle(Theme.secondary)
        } status: {
            let loading = vehicle.tripId != nil && !delayKnown
            HStack(spacing: 10) {
                Group {
                    if let delay, delayKnown {
                        let minutes = Int((Double(abs(delay)) / 60).rounded())
                        Text(minutes == 0 ? tr("On time") : delay > 0 ? tr("\(minutes) min late") : tr("\(minutes) min early"))
                            .foregroundStyle(minutes == 0 ? Theme.live : delay > 0 ? Theme.late : Theme.early)
                    } else if loading {
                        Text("On time").foregroundStyle(Theme.secondary).redacted(reason: .placeholder)
                    }
                }
                .font(.system(size: 15, weight: .semibold))
                Spacer(minLength: 0)
                if let updated = vehicle.updated {
                    RefreshedAge(updated: updated)
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

    private var tripTarget: TripTarget? {
        guard let tripId = vehicle.tripId, let date = vehicle.serviceDate else { return nil }
        return TripTarget(tripId: tripId, serviceDate: date, route: vehicle.route, headsign: vehicle.headsign)
    }
}

/// A stop's (or group's) next departures.
struct StopCard: View {
    let stationId: String
    let stopId: String?
    /// Already known (the main map); otherwise loaded here (a trip's map only has the stop's id).
    var station: Station? = nil
    var fallbackName: String? = nil
    var open: CardOpen = nil
    let close: () -> Void
    @State private var loaded: Station?
    private var shown: Station? { station ?? loaded }
    private var platform: Platform? { shown?.platforms.first { $0.stopId == stopId } }
    private var lines: [LineRef] { platform?.routes ?? shown?.routes ?? [] }
    private var name: String? { platform?.name ?? shown?.name ?? fallbackName }

    var body: some View {
        CardLayout(title: name ?? "", loading: name == nil, buttonTitle: tr("Departures"),
                   buttonValue: AnyHashable(StationTarget(stationId: stationId, from: stopId)), open: open, close: close,
                   showsInfo: !(platform?.headsigns.isEmpty ?? true)) {
            EmptyView()
        } info: {
            if let p = platform, !p.headsigns.isEmpty {
                Text(tr("towards \(p.headsigns.joined(separator: " / "))")).font(.system(size: 15)).foregroundStyle(Theme.secondary).lineLimit(1)
            }
        } status: {
            // Just the lines that stop here; times are on the departures page
            if shown == nil {
                HStack(spacing: 6) {
                    ForEach(0..<3, id: \.self) { _ in RoundedRectangle(cornerRadius: 6).fill(Theme.secondary.opacity(0.2)).frame(width: 40, height: 22) }
                }
            } else {
                // Up to two rows, the same height as the name and direction above, with the same clean-up as on the map
                StopBadges(routes: lines, size: 12, alignment: .leading)
                    .frame(maxWidth: .infinity, minHeight: 40, alignment: .leading)
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
