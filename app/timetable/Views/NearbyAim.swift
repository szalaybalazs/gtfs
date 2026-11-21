//
//  NearbyAim.swift
//  timetable
//
//  "Point at the stop you want": a heading, an angle and a range make a cone; the Nearby tab then only lists
//  platforms inside it. Geometry, the compass, and the small map with the draggable cone.
//

import SwiftUI
import MapKit
import CoreLocation

/// The cone: where you stand, which way you face. Width and range are fixed; relevance falls off with distance.
struct AimCone: Equatable {
    var heading: Double = 0      // degrees clockwise from north
    static let angle = 70.0      // full width in degrees
    static let range = 300.0     // metres

    func contains(_ point: CLLocationCoordinate2D, from here: CLLocationCoordinate2D) -> Bool {
        let d = Geo.distance(here, point)
        if d > Self.range { return false }
        if d < 20 { return true } // right next to you counts whichever way you face
        return abs(Geo.angleDiff(Geo.bearing(here, point), heading)) <= Self.angle / 2
    }

    /// The cone drawn as bands from you outwards, each fainter than the last: a solid shape that fades with distance.
    static let bands = 18
    func band(_ i: Int, from here: CLLocationCoordinate2D) -> [CLLocationCoordinate2D] {
        let r0 = Self.range * Double(i) / Double(Self.bands), r1 = Self.range * Double(i + 1) / Double(Self.bands)
        let steps = 16
        var pts: [CLLocationCoordinate2D] = []
        for k in 0...steps {
            let b = heading - Self.angle / 2 + Self.angle * Double(k) / Double(steps)
            pts.append(Geo.destination(here, bearing: b, metres: r1))
        }
        if i == 0 { pts.append(here) }
        else {
            for k in stride(from: steps, through: 0, by: -1) {
                let b = heading - Self.angle / 2 + Self.angle * Double(k) / Double(steps)
                pts.append(Geo.destination(here, bearing: b, metres: r0))
            }
        }
        return pts
    }
    static func opacity(_ i: Int) -> Double { 0.5 * pow(1 - Double(i) / Double(bands), 1.6) + 0.03 }
}

enum Geo {
    static func distance(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        CLLocation(latitude: a.latitude, longitude: a.longitude).distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude))
    }
    /// Degrees clockwise from north, 0..<360.
    static func bearing(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        let la = a.latitude * .pi / 180, lb = b.latitude * .pi / 180, dl = (b.longitude - a.longitude) * .pi / 180
        let y = sin(dl) * cos(lb), x = cos(la) * sin(lb) - sin(la) * cos(lb) * cos(dl)
        return (atan2(y, x) * 180 / .pi + 360).truncatingRemainder(dividingBy: 360)
    }
    /// Signed difference a - b in -180...180.
    static func angleDiff(_ a: Double, _ b: Double) -> Double {
        var d = (a - b).truncatingRemainder(dividingBy: 360)
        if d > 180 { d -= 360 } else if d < -180 { d += 360 }
        return d
    }
    static func destination(_ a: CLLocationCoordinate2D, bearing: Double, metres: Double) -> CLLocationCoordinate2D {
        let r = 6_371_000.0, br = bearing * .pi / 180, dr = metres / r
        let la = a.latitude * .pi / 180, lo = a.longitude * .pi / 180
        let lb = asin(sin(la) * cos(dr) + cos(la) * sin(dr) * cos(br))
        let lm = lo + atan2(sin(br) * sin(dr) * cos(la), cos(dr) - sin(la) * sin(lb))
        return CLLocationCoordinate2D(latitude: lb * 180 / .pi, longitude: lm * 180 / .pi)
    }
}

/// The phone's compass, live while started (true north when the phone knows it). No compass in the Simulator.
@MainActor
@Observable
final class HeadingTracker: NSObject, CLLocationManagerDelegate {
    private(set) var heading: Double?
    private let manager = CLLocationManager()
    var available: Bool { CLLocationManager.headingAvailable() }

    func start() {
        guard available else { return }
        manager.delegate = self
        manager.headingFilter = 2
        manager.startUpdatingHeading()
    }
    func stop() { manager.stopUpdatingHeading() }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateHeading h: CLHeading) {
        let v = h.trueHeading >= 0 ? h.trueHeading : h.magneticHeading
        Task { @MainActor in self.heading = v }
    }
}

/// A platform to draw and to filter by.
struct AimSpot: Identifiable, Hashable {
    let stopId: String
    let name: String
    let lat: Double
    let lon: Double
    var id: String { stopId }
    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: lat, longitude: lon) }
}

/// A small map: you at the bottom, the map turned so the way you point is up, the cone fading away from you.
struct AimMap: View {
    let here: CLLocationCoordinate2D
    let spots: [AimSpot]
    let cone: AimCone

    private var camera: MapCameraPosition {
        // Centre a little ahead of you, so you sit low and the cone fills the map
        let centre = Geo.destination(here, bearing: cone.heading, metres: AimCone.range * 0.35)
        return .camera(MapCamera(centerCoordinate: centre, distance: AimCone.range * 3.2, heading: cone.heading, pitch: 0))
    }

    var body: some View {
        Map(position: .constant(camera), interactionModes: []) {
            ForEach(0..<AimCone.bands, id: \.self) { i in
                MapPolygon(coordinates: cone.band(i, from: here)).foregroundStyle(Theme.accent.opacity(AimCone.opacity(i)))
            }
            ForEach(spots) { s in
                let inside = cone.contains(s.coordinate, from: here)
                Annotation("", coordinate: s.coordinate, anchor: .center) {
                    Circle().fill(inside ? Theme.accent : Color.gray.opacity(0.5)).frame(width: inside ? 9 : 6, height: inside ? 9 : 6)
                }
            }
            Annotation("", coordinate: here, anchor: .center) {
                Circle().fill(Color.blue).frame(width: 14, height: 14).overlay(Circle().stroke(Color.white, lineWidth: 2.5))
            }
        }
        .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll, showsTraffic: false))
        .allowsHitTesting(false)
    }
}
