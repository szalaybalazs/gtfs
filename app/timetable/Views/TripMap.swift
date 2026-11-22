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
            TripKitMap(trip: trip, vehicle: vehicle, path: path, color: color, big: false, region: region, interactive: false) {
                picked = $0; full = true
            } onMapTap: {
                full = true
            }
            .frame(height: 180)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .accessibilityLabel(tr("Trip map"))
            .accessibilityAddTraits(.isButton)
            .sheet(isPresented: $full) {
                NavigationStack {
                    TripFullMap(trip: trip, vehicle: vehicle, path: path, color: color, region: region, initial: picked)
                        .transitDestinations()
                        .toolbar {
                            ToolbarItem(placement: .topBarTrailing) {
                                Button(tr("Close")) { full = false }
                            }
                        }
                }
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
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
    @State private var selection: MapSelection?

    var body: some View {
        TripKitMap(trip: trip, vehicle: vehicle, path: path, color: color, big: true, region: region, interactive: true, selection: selection) { selection = $0 }
            .ignoresSafeArea(edges: .bottom)
            .onAppear { selection = initial }
            .mapCardSheet(selection: $selection) { sel, _ in card(sel) }
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
