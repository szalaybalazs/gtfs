//
//  TripKitMap.swift
//  timetable
//
//  A trip on the shared map (AppMapView): its path, stops (with time callouts when big) and vehicle.
//  Pure data mapping; all rendering and tap handling is AppMapView's, same as the main map's.
//

import SwiftUI
import MapKit

struct TripKitMap: View {
    let trip: Trip
    var vehicle: TripVehicle?
    let path: [CLLocationCoordinate2D]
    let color: Color
    let big: Bool
    let region: MKCoordinateRegion
    /// Interaction off for the minimap (the whole map opens the big one).
    var interactive: Bool
    /// What is selected (the big map's sheet), so its pin grows like on the main map.
    var selection: MapSelection? = nil
    /// A stop or the vehicle was tapped.
    var onSelect: (MapSelection) -> Void
    /// Tapped anywhere that isn't a stop or the vehicle (the minimap uses it to open the big map).
    var onMapTap: (() -> Void)? = nil

    var body: some View {
        AppMapView(
            initialRegion: region,
            // Fit again when the path arrives after the stops, so the line is never off screen
            regionID: "\(trip.tripId)|\(path.count > 1)|\(big)",
            lines: path.count > 1 ? [MapLine(id: "path", coordinates: path, color: color, width: big ? 5 : 4)] : [],
            stops: stops,
            vehicles: vehicles,
            selectedVehicleId: selection == .vehicle(trip.tripId) ? trip.tripId : nil,
            interactive: interactive,
            showsCompass: big,
            onTapStop: { onSelect($0.selection) },
            onTapVehicle: { onSelect($0.selection) },
            onTapMap: onMapTap)
    }

    private var stops: [MapStop] {
        let tint = stopPinTint(routes: trip.route.map { [$0] } ?? [], fallback: color)
        let last = trip.stops.last?.stopSequence
        return trip.stops.compactMap { s in
            guard let la = s.lat, let lo = s.lon else { return nil }
            let sel = MapSelection.station(s.stationId ?? s.stopId, stopId: s.stopId)
            return MapStop(id: "\(s.stopSequence)-\(s.stopId)", coordinate: CLLocationCoordinate2D(latitude: la, longitude: lo), selection: sel,
                           tint: tint, dot: big ? 13 : 8,
                           time: big ? TimeFormat.clock(s.stopSequence == last ? s.arrival : s.departure) : nil,
                           realtime: s.realtime, selected: selection == sel)
        }
    }

    private var vehicles: [MapVehicle] {
        guard let v = vehicle, let la = v.latitude, let lo = v.longitude else { return [] }
        return [MapVehicle(id: trip.tripId, coordinate: CLLocationCoordinate2D(latitude: la, longitude: lo), bearing: v.bearing,
                           line: trip.route)]
    }
}
