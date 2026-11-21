//
//  TripMap.swift
//  timetable
//
//  Vehicle info card, the trip's mini map and its full-screen version (web/src/pages/TripPage.tsx).
//

import SwiftUI
import MapKit

/// "Mercedes-Benz Citaro C2G (C2-C4 szerz)" -> "Mercedes-Benz Citaro C2G"
func vehicleName(_ model: String?) -> String? {
    guard let model else { return nil }
    let clean = model.replacingOccurrences(of: #"\s*\([^)]*\)\s*"#, with: " ", options: .regularExpression)
        .trimmingCharacters(in: .whitespaces)
    return clean.isEmpty ? nil : clean
}

/// The vehicle: what it is, big; its plate and, when accessible, the circled wheelchair under it.
struct TripVehicleCard: View {
    let vehicle: TripVehicle

    var body: some View {
        VStack(spacing: 0) {
            SectionTitle("Vehicle")
            Card {
                VStack(alignment: .leading, spacing: 4) {
                    Text(vehicleName(vehicle.model) ?? vehicle.plate ?? "").font(.system(size: 20, weight: .semibold))
                    HStack(spacing: 8) {
                        if vehicle.model != nil, let plate = vehicle.plate { Text(plate) }
                        if vehicle.wheelchair {
                            Image(systemName: "figure.roll.circle").font(.system(size: 18)).accessibilityLabel(tr("Accessible"))
                        }
                    }
                    .font(.system(size: 15)).foregroundStyle(Theme.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
            }
        }
    }
}

/// "On time" / "3 min late" / "1 min early", for the trip's top card.
struct TripDelayText: View {
    let minutes: Int
    var body: some View {
        Group {
            if minutes == 0 { Text("On time").foregroundStyle(Theme.live) }
            else if minutes > 0 { Text(tr("\(minutes) min late")).foregroundStyle(Theme.late) }
            else { Text(tr("\(-minutes) min early")).foregroundStyle(Theme.early) }
        }
        .font(.system(size: 13, weight: .medium))
    }
}

/// The trip drawn on a map: path in the route colour, stops as dots, the vehicle as the line badge.
struct TripMapContent: MapContent {
    let trip: Trip
    var vehicle: TripVehicle?
    let path: [CLLocationCoordinate2D]
    let color: Color
    let big: Bool
    /// A stop or the vehicle was tapped.
    var onSelect: (MapSelection) -> Void = { _ in }

    var body: some MapContent {
        if path.count > 1 {
            MapPolyline(coordinates: path).stroke(color, lineWidth: big ? 5 : 4)
        }
        // Stop dots are annotations, so they stay the same size on screen however far you zoom
        ForEach(trip.stops.filter { $0.lat != nil && $0.lon != nil }) { s in
            Annotation("", coordinate: CLLocationCoordinate2D(latitude: s.lat!, longitude: s.lon!), anchor: .center) {
                Circle().fill(Color.white).frame(width: big ? 10 : 7, height: big ? 10 : 7)
                    .overlay(Circle().stroke(color, lineWidth: 2))
                    .padding(8).contentShape(Circle())
                    .onTapGesture { onSelect(.station(s.stationId ?? s.stopId, stopId: s.stopId)) }
            }
        }
        ForEach(trip.stops.filter { big && $0.lat != nil && $0.lon != nil }) { s in
            Annotation("", coordinate: CLLocationCoordinate2D(latitude: s.lat!, longitude: s.lon!), anchor: .top) {
                VStack(spacing: 2) {
                    Color.clear.frame(width: 1, height: 8)
                    if big {
                        let last = s.stopSequence == trip.stops.last?.stopSequence
                        HStack(spacing: 3) {
                            Text(TimeFormat.clock(last ? s.arrival : s.departure)).font(.system(size: 11, weight: .semibold)).monospacedDigit()
                            if s.realtime { LiveIcon() }
                        }
                        .fixedSize()
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 6))
                    }
                }
            }
        }
        if let v = vehicle, let lat = v.latitude, let lon = v.longitude {
            Annotation("", coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lon)) {
                VehicleDisc(line: trip.route, bearing: v.bearing)
                    .onTapGesture { onSelect(.vehicle(trip.tripId)) }
            }
        }
    }
}

private func tripRegion(_ trip: Trip, vehicle: TripVehicle?, path: [CLLocationCoordinate2D]) -> MKCoordinateRegion? {
    var pts = path
    pts += trip.stops.compactMap { s in s.lat.flatMap { la in s.lon.map { CLLocationCoordinate2D(latitude: la, longitude: $0) } } }
    if let v = vehicle, let la = v.latitude, let lo = v.longitude { pts.append(CLLocationCoordinate2D(latitude: la, longitude: lo)) }
    guard let first = pts.first else { return nil }
    var minLat = first.latitude, maxLat = minLat, minLon = first.longitude, maxLon = minLon
    for p in pts {
        minLat = min(minLat, p.latitude); maxLat = max(maxLat, p.latitude)
        minLon = min(minLon, p.longitude); maxLon = max(maxLon, p.longitude)
    }
    return MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: (minLat + maxLat) / 2, longitude: (minLon + maxLon) / 2),
        span: MKCoordinateSpan(latitudeDelta: max((maxLat - minLat) * 1.3, 0.004), longitudeDelta: max((maxLon - minLon) * 1.3, 0.004)))
}

struct TripMiniMap: View {
    let trip: Trip
    var vehicle: TripVehicle?
    let path: [CLLocationCoordinate2D]
    let color: Color
    @State private var full = false
    /// What was tapped on the small map: the big one opens with it already selected.
    @State private var picked: MapSelection?

    var body: some View {
        if let region = tripRegion(trip, vehicle: vehicle, path: path) {
            Map(initialPosition: .region(region), interactionModes: []) {
                TripMapContent(trip: trip, vehicle: vehicle, path: path, color: color, big: false) { picked = $0; full = true }
            }
            .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll, showsTraffic: false))
            .frame(height: 180)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(Color.clear.contentShape(Rectangle()).onTapGesture { full = true })
            .accessibilityLabel(tr("Trip map"))
            .accessibilityAddTraits(.isButton)
            .fullScreenCover(isPresented: $full) {
                NavigationStack {
                    TripFullMap(trip: trip, vehicle: vehicle, path: path, color: color, region: region, initial: picked)
                        .transitDestinations().toolbar(.hidden, for: .navigationBar)
                }
            }
        }
    }
}

private struct TripFullMap: View {
    let trip: Trip
    let vehicle: TripVehicle?
    let path: [CLLocationCoordinate2D]
    let color: Color
    let region: MKCoordinateRegion
    @State var initial: MapSelection?
    @Environment(\.dismiss) private var dismiss
    @State private var selection: MapSelection?

    var body: some View {
        Map(initialPosition: .region(region)) {
            TripMapContent(trip: trip, vehicle: vehicle, path: path, color: color, big: true) { selection = $0 }
        }
        .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll, showsTraffic: false))
        .onAppear { selection = initial }
        .overlay(alignment: .bottom) {
            if let selection { card(selection).transition(.move(edge: .bottom).combined(with: .opacity)) }
        }
        .animation(.easeOut(duration: 0.2), value: selection)
        .overlay(alignment: .topTrailing) {
            Button { dismiss() } label: {
                Image(systemName: "xmark").font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.accent)
                    .frame(width: 44, height: 44).background(.regularMaterial, in: Circle())
            }
            .accessibilityLabel(tr("Close"))
            .padding(12)
        }
    }

    @ViewBuilder private func card(_ selection: MapSelection) -> some View {
        switch selection {
        case .vehicle:
            if let v = vehicle, let lat = v.latitude, let lon = v.longitude {
                VehicleCard(vehicle: Vehicle(id: trip.tripId, coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lon), bearing: v.bearing,
                                             label: v.label, plate: v.plate, model: v.model, tripId: trip.tripId, serviceDate: trip.serviceDate,
                                             headsign: trip.headsign, route: trip.route, updated: v.updated)) { self.selection = nil }
            }
        case .station(let id, let stopId):
            StopCard(stationId: id, stopId: stopId, fallbackName: trip.stops.first { $0.stopId == stopId }?.name) { self.selection = nil }
                .id(stopId ?? id)
        }
    }
}
