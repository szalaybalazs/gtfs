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

struct TripVehicleCard: View {
    let vehicle: TripVehicle
    /// Delay in minutes at the last stop with realtime data; nil when unknown.
    let delayMinutes: Int?
    let live: Bool
    let now: Foundation.Date

    var body: some View {
        VStack(spacing: 0) {
            SectionTitle("Vehicle")
            Card {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        if live { LiveIcon() }
                        if let delayMinutes { status(delayMinutes) }
                        if let age = age, age >= 30 {
                            if delayMinutes != nil { Text("·").foregroundStyle(Theme.secondary) }
                            Text(age < 60 ? tr("updated \(Int(age)) s ago") : tr("updated \(Int(age / 60)) min ago"))
                                .foregroundStyle(Theme.secondary)
                        }
                    }
                    .font(.system(size: 13, weight: .medium))
                    Text(vehicleName(vehicle.model) ?? vehicle.plate ?? "").font(.system(size: 20, weight: .semibold))
                    let sub = [vehicle.model != nil ? vehicle.plate : nil, vehicle.wheelchair ? tr("Wheelchair accessible") : nil].compactMap { $0 }
                    if !sub.isEmpty {
                        Text(sub.joined(separator: " · ")).font(.system(size: 15)).foregroundStyle(Theme.secondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
            }
        }
    }

    private var age: TimeInterval? { vehicle.updated.map { now.timeIntervalSince($0) } }

    @ViewBuilder private func status(_ m: Int) -> some View {
        if m == 0 { Text("On time").foregroundStyle(Theme.live) }
        else if m > 0 { Text(tr("\(m) min late")).foregroundStyle(Theme.late) }
        else { Text(tr("\(-m) min early")).foregroundStyle(Theme.early) }
    }
}

/// The trip drawn on a map: path in the route colour, stops as dots, the vehicle as the line badge.
struct TripMapContent: MapContent {
    let trip: Trip
    var vehicle: TripVehicle?
    let path: [CLLocationCoordinate2D]
    let color: Color
    let big: Bool

    var body: some MapContent {
        if path.count > 1 {
            MapPolyline(coordinates: path).stroke(color, lineWidth: big ? 5 : 4)
        }
        ForEach(trip.stops.filter { $0.lat != nil && $0.lon != nil }) { s in
            Annotation("", coordinate: CLLocationCoordinate2D(latitude: s.lat!, longitude: s.lon!), anchor: .center) {
                VStack(spacing: 2) {
                    Circle().fill(Color.white).frame(width: big ? 10 : 7, height: big ? 10 : 7)
                        .overlay(Circle().stroke(color, lineWidth: 2))
                    if big {
                        Text("\(s.name) \(TimeFormat.clock(s.departure))").font(.system(size: 10, weight: .medium))
                            .padding(.horizontal, 4).padding(.vertical, 1)
                            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 4))
                            .fixedSize()
                    }
                }
            }
        }
        if let v = vehicle, let lat = v.latitude, let lon = v.longitude {
            Annotation("", coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lon)) {
                VehicleDisc(line: trip.route, bearing: v.bearing)
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

    var body: some View {
        if let region = tripRegion(trip, vehicle: vehicle, path: path) {
            Map(initialPosition: .region(region), interactionModes: []) {
                TripMapContent(trip: trip, vehicle: vehicle, path: path, color: color, big: false)
            }
            .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll, showsTraffic: false))
            .frame(height: 180)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(Color.clear.contentShape(Rectangle()).onTapGesture { full = true })
            .accessibilityLabel(tr("Trip map"))
            .accessibilityAddTraits(.isButton)
            .fullScreenCover(isPresented: $full) {
                TripFullMap(trip: trip, vehicle: vehicle, path: path, color: color, region: region)
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
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Map(initialPosition: .region(region)) {
            TripMapContent(trip: trip, vehicle: vehicle, path: path, color: color, big: true)
        }
        .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll, showsTraffic: false))
        .overlay(alignment: .topTrailing) {
            Button { dismiss() } label: {
                Image(systemName: "xmark").font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.accent)
                    .frame(width: 44, height: 44).background(.regularMaterial, in: Circle())
            }
            .accessibilityLabel(tr("Close"))
            .padding(12)
        }
    }
}
