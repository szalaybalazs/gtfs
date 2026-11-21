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

/// The cone: where you stand, which way you face, how wide and how far.
struct AimCone: Equatable {
    var heading: Double = 0      // degrees clockwise from north
    var angle: Double = 70       // full width in degrees
    var range: Double = 200      // metres

    static let minAngle = 20.0, maxAngle = 160.0
    static let minRange = 50.0, maxRange = 600.0

    func contains(_ point: CLLocationCoordinate2D, from here: CLLocationCoordinate2D) -> Bool {
        let d = Geo.distance(here, point)
        if d > range { return false }
        if d < 20 { return true } // right next to you counts whichever way you face
        return abs(Geo.angleDiff(Geo.bearing(here, point), heading)) <= angle / 2
    }

    /// Where the grab handle sits: the cone's right-hand edge, at full range.
    func handle(from here: CLLocationCoordinate2D) -> CLLocationCoordinate2D {
        Geo.destination(here, bearing: heading + angle / 2, metres: range)
    }

    /// Dragging the handle to `point` sets the width (its bearing against the heading) and the range (its distance).
    func dragging(to point: CLLocationCoordinate2D, from here: CLLocationCoordinate2D) -> AimCone {
        var c = self
        let half = abs(Geo.angleDiff(Geo.bearing(here, point), heading))
        c.angle = min(max(half * 2, Self.minAngle), Self.maxAngle)
        c.range = min(max(Geo.distance(here, point), Self.minRange), Self.maxRange)
        return c
    }

    /// The outline: the pointer, then an arc.
    func polygon(from here: CLLocationCoordinate2D) -> [CLLocationCoordinate2D] {
        var pts = [here]
        let steps = 24
        for i in 0...steps {
            let b = heading - angle / 2 + angle * Double(i) / Double(steps)
            pts.append(Geo.destination(here, bearing: b, metres: range))
        }
        return pts
    }
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

/// One reading of the phone's compass (true north when the phone knows it); nil when there's no compass (the Simulator) or no reading.
@MainActor
final class HeadingReader: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<Double?, Never>?

    func read() async -> Double? {
        guard CLLocationManager.headingAvailable() else { return nil }
        return await withCheckedContinuation { c in
            continuation = c
            manager.delegate = self
            manager.headingFilter = 1
            manager.startUpdatingHeading()
            Task { try? await Task.sleep(nanoseconds: 2_500_000_000); finish(nil) }
        }
    }

    private func finish(_ value: Double?) {
        guard let c = continuation else { return }
        continuation = nil
        manager.stopUpdatingHeading()
        c.resume(returning: value)
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateHeading h: CLHeading) {
        let v = h.trueHeading >= 0 ? h.trueHeading : h.magneticHeading
        Task { @MainActor in self.finish(v) }
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

/// Small map above the departures: you, the platforms, the cone, and a dot on the cone's side to reshape it.
struct AimMap: View {
    let here: CLLocationCoordinate2D
    let spots: [AimSpot]
    @Binding var cone: AimCone
    @State private var camera: MapCameraPosition = .automatic
    @State private var grabbed = false
    /// The range the camera was fitted to: refitted when a drag ends, not during it (the map would chase the handle).
    @State private var fittedRange: Double = 0

    private func fit() {
        fittedRange = cone.range
        let span = max(cone.range * 2.6, 300) / 111_000
        camera = .region(MKCoordinateRegion(center: here, span: MKCoordinateSpan(latitudeDelta: span, longitudeDelta: span)))
    }

    var body: some View {
        MapReader { proxy in
            Map(position: $camera, interactionModes: []) {
                MapPolygon(coordinates: cone.polygon(from: here))
                    .foregroundStyle(Theme.accent.opacity(0.22))
                    .stroke(Theme.accent, lineWidth: 1.5)
                ForEach(spots) { s in
                    let inside = cone.contains(s.coordinate, from: here)
                    Annotation("", coordinate: s.coordinate, anchor: .center) {
                        Circle().fill(inside ? Theme.accent : Theme.secondary.opacity(0.7)).frame(width: inside ? 11 : 8, height: inside ? 11 : 8)
                            .overlay(Circle().stroke(Color.white, lineWidth: 1.5))
                    }
                }
                Annotation("", coordinate: here, anchor: .center) {
                    Circle().fill(Color.blue).frame(width: 16, height: 16).overlay(Circle().stroke(Color.white, lineWidth: 3))
                }
                Annotation("", coordinate: cone.handle(from: here), anchor: .center) {
                    Circle().fill(Color.white).frame(width: 22, height: 22)
                        .overlay(Circle().stroke(Theme.accent, lineWidth: 3))
                        .shadow(radius: 2)
                        .allowsHitTesting(false)
                }
            }
            .mapStyle(.standard(elevation: .flat, emphasis: .muted, pointsOfInterest: .excludingAll, showsTraffic: false))
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { v in
                        if !grabbed {
                            // Only a touch that starts on the handle reshapes the cone
                            guard let p = proxy.convert(cone.handle(from: here), to: .local),
                                  hypot(p.x - v.startLocation.x, p.y - v.startLocation.y) < 40 else { return }
                            grabbed = true
                        }
                        if let c = proxy.convert(v.location, from: .local) { cone = cone.dragging(to: c, from: here) }
                    }
                    .onEnded { _ in
                        if grabbed { grabbed = false; fit() }
                    }
            )
        }
        .frame(height: 250)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .onAppear { fit() }
    }
}
