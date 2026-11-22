//
//  AppMapView.swift
//  timetable
//
//  The one map both the main map and a trip's maps (mini and full) are built on: an MKMapView with
//  plain-data layers (polylines, stops, vehicles). MapKit's SwiftUI Map orders annotations itself, so
//  vehicles could sit under stops; MKAnnotationView.zPriority is the one place that decides it:
//  vehicles .max, a selected stop above other stops, stops .min.
//  The map never selects or recentres anything itself: taps go to the callbacks, the caller owns the selection.
//

import SwiftUI
import MapKit

// MARK: Data

/// A polyline. Same `id` with changed geometry/style is updated in place.
struct MapLine: Identifiable {
    let id: String
    let coordinates: [CLLocationCoordinate2D]
    let color: Color
    let width: CGFloat
    /// Worked out once here, not on every map update.
    fileprivate let signature: String

    init(id: String, coordinates: [CLLocationCoordinate2D], color: Color, width: CGFloat) {
        self.id = id; self.coordinates = coordinates; self.color = color; self.width = width
        if let f = coordinates.first, let l = coordinates.last {
            let m = coordinates[coordinates.count / 2]
            signature = "\(coordinates.count)|\(f.latitude)|\(f.longitude)|\(m.latitude)|\(m.longitude)|\(l.latitude)|\(l.longitude)|\(width)|\(color.description)"
        } else { signature = "\(id)|0" }
    }
}

/// The one rule for a stop pin's colour, on every map: the colour of the stop's own line (the first one), else the fallback.
func stopPinTint(routes: [LineRef], fallback: Color) -> Color {
    if let hex = routes.lazy.compactMap(\.color).first { return Color(hex: hex) }
    return fallback
}

/// A stop dot, optionally with its time or its line badges under it.
struct MapStop: Identifiable {
    let id: String
    var coordinate: CLLocationCoordinate2D
    /// What a tap on it means (and what the caller compares its selection with).
    var selection: MapSelection
    var tint: Color
    /// Filled with the tint and a white rim.
    var filled = true
    var dot: CGFloat = 10
    var time: String?
    var realtime = false
    var routes: [LineRef] = []
    var selected = false
    var opacity = 1.0
    var tappable = true

    fileprivate func sameLook(_ o: MapStop) -> Bool {
        selection == o.selection && tint == o.tint && filled == o.filled && dot == o.dot && time == o.time && realtime == o.realtime
            && routes.map(\.routeId) == o.routes.map(\.routeId) && selected == o.selected && opacity == o.opacity && tappable == o.tappable
    }
}

/// A vehicle disc.
struct MapVehicle: Identifiable {
    let id: String
    var coordinate: CLLocationCoordinate2D
    var bearing: Double?
    var line: LineRef?
    /// Zoomed out: a small dot instead of the line badge.
    var compact = false
    var selection: MapSelection { .vehicle(id) }

    fileprivate func sameLook(_ o: MapVehicle) -> Bool {
        bearing == o.bearing && line?.routeId == o.line?.routeId && compact == o.compact
    }
}

/// Lets SwiftUI controls (location and compass buttons) attach to the map.
@Observable final class MapHandle {
    var map: MKMapView?
}

// MARK: The map

struct AppMapView: UIViewRepresentable {
    /// Applied once the map has a size, and again whenever `regionID` changes.
    var initialRegion: MKCoordinateRegion
    var regionID = ""
    var lines: [MapLine] = []
    var stops: [MapStop] = []
    var vehicles: [MapVehicle] = []
    /// Which vehicle is selected: kept apart from the vehicle data, so selecting doesn't mean rebuilding the list.
    var selectedVehicleId: String?
    /// Vehicles move to a new position over this long.
    var glide: TimeInterval = 0.8
    var interactive = true
    var showsUserLocation = false
    var showsCompass = false
    var showsScale = false
    var handle: MapHandle?
    /// The camera came to rest.
    var onRegionChange: ((MKCoordinateRegion) -> Void)?
    /// Latitude span below which platforms are shown; reported the moment the zoom crosses it (during the gesture, not after).
    var platformSpan: Double = 0
    var onPlatformZoom: ((Bool) -> Void)?
    var onTapStop: ((MapStop) -> Void)?
    var onTapVehicle: ((MapVehicle) -> Void)?
    /// Tapped anywhere that isn't a stop or a vehicle.
    var onTapMap: (() -> Void)?

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> SizedMapView {
        let map = SizedMapView()
        map.delegate = context.coordinator
        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.mapTapped))
        tap.delegate = context.coordinator
        map.addGestureRecognizer(tap)
        map.preferredConfiguration = MKStandardMapConfiguration(elevationStyle: .flat, emphasisStyle: .muted)
        map.pointOfInterestFilter = .excludingAll
        map.isPitchEnabled = false
        map.register(StopView.self, forAnnotationViewWithReuseIdentifier: "stop")
        map.register(VehicleView.self, forAnnotationViewWithReuseIdentifier: "vehicle")
        if let handle { DispatchQueue.main.async { handle.map = map } }
        return map
    }

    func updateUIView(_ map: SizedMapView, context: Context) {
        let c = context.coordinator
        // Set before anything is added: annotation and overlay views read these when MapKit creates them
        c.parent = self
        map.isZoomEnabled = interactive
        map.isScrollEnabled = interactive
        map.isRotateEnabled = interactive
        map.showsCompass = showsCompass
        map.showsScale = showsScale
        if map.showsUserLocation != showsUserLocation { map.showsUserLocation = showsUserLocation }
        if c.regionID != regionID {
            c.regionID = regionID
            map.apply(initialRegion)
        }
        c.syncLines(map, lines)
        c.syncStops(map, stops)
        c.syncVehicles(map, vehicles, selected: selectedVehicleId, glide: glide)
    }

    final class Coordinator: NSObject, MKMapViewDelegate, UIGestureRecognizerDelegate {
        var parent: AppMapView?
        var regionID: String?
        private var polylines: [String: (StyledPolyline, String)] = [:]
        private var stopAnns: [String: StopAnnotation] = [:]
        private var vehicleAnns: [String: VehicleAnnotation] = [:]

        // MARK: Sync (diff by id, so late data is picked up and nothing is rebuilt needlessly)

        func syncLines(_ map: MKMapView, _ lines: [MapLine]) {
            var remove: [MKOverlay] = [], add: [StyledPolyline] = []
            let ids = Set(lines.map(\.id))
            for (id, entry) in polylines where !ids.contains(id) { remove.append(entry.0); polylines[id] = nil }
            for l in lines where l.coordinates.count > 1 {
                let sig = l.signature
                if let old = polylines[l.id], old.1 == sig { continue }
                if let old = polylines[l.id] { remove.append(old.0) }
                let p = StyledPolyline(coordinates: l.coordinates, count: l.coordinates.count)
                p.color = UIColor(l.color); p.width = l.width
                polylines[l.id] = (p, sig); add.append(p)
            }
            if !remove.isEmpty { map.removeOverlays(remove) }
            if !add.isEmpty { map.addOverlays(add) }
        }

        func syncStops(_ map: MKMapView, _ stops: [MapStop]) {
            var add: [StopAnnotation] = []
            let ids = Set(stops.map(\.id))
            let gone = stopAnns.filter { !ids.contains($0.key) }
            if !gone.isEmpty { map.removeAnnotations(Array(gone.values)); for k in gone.keys { stopAnns[k] = nil } }
            for s in stops {
                if let a = stopAnns[s.id] {
                    if a.item.coordinate.latitude != s.coordinate.latitude || a.item.coordinate.longitude != s.coordinate.longitude { a.coordinate = s.coordinate }
                    let changed = !a.item.sameLook(s)
                    a.item = s
                    if changed { (map.view(for: a) as? StopView)?.configure(s) }
                } else {
                    let a = StopAnnotation(item: s)
                    stopAnns[s.id] = a; add.append(a)
                }
            }
            if !add.isEmpty { map.addAnnotations(add) }
        }

        func syncVehicles(_ map: MKMapView, _ vehicles: [MapVehicle], selected: String?, glide: TimeInterval) {
            var add: [VehicleAnnotation] = []
            let ids = Set(vehicles.map(\.id))
            let gone = vehicleAnns.filter { !ids.contains($0.key) }
            if !gone.isEmpty { map.removeAnnotations(Array(gone.values)); for k in gone.keys { vehicleAnns[k] = nil } }
            for v in vehicles {
                if let a = vehicleAnns[v.id] {
                    if a.item.coordinate.latitude != v.coordinate.latitude || a.item.coordinate.longitude != v.coordinate.longitude {
                        if glide > 0 {
                            UIView.animate(withDuration: glide, delay: 0, options: [.beginFromCurrentState, .allowUserInteraction, .curveLinear]) { a.coordinate = v.coordinate }
                        } else { a.coordinate = v.coordinate }
                    }
                    let isSel = v.id == selected
                    let changed = !a.item.sameLook(v) || a.selected != isSel
                    a.item = v; a.selected = isSel
                    if changed { (map.view(for: a) as? VehicleView)?.configure(v, selected: isSel) }
                } else {
                    let a = VehicleAnnotation(item: v)
                    a.selected = v.id == selected
                    vehicleAnns[v.id] = a; add.append(a)
                }
            }
            if !add.isEmpty { map.addAnnotations(add) }
            // Dropped by MapKit (e.g. the sheet was reopened) but still wanted: put them back
            guard map.annotations.count < stopAnns.count + vehicleAnns.count else { return }
            let missing = vehicleAnns.values.filter { a in !map.annotations.contains { $0 === a } && !add.contains { $0 === a } }
            if !missing.isEmpty { map.addAnnotations(Array(missing)) }
        }

        // MARK: Taps

        /// Taps are hit-tested here, not through MapKit's annotation selection (which animates, raises and re-sorts views, and lagged).
        @objc func mapTapped(_ g: UITapGestureRecognizer) {
            guard let map = g.view as? MKMapView else { return }
            var v = map.hitTest(g.location(in: map), with: nil)
            while let cur = v {
                if let s = (cur as? StopView)?.annotation as? StopAnnotation { parent?.onTapStop?(s.item); return }
                if let a = (cur as? VehicleView)?.annotation as? VehicleAnnotation { parent?.onTapVehicle?(a.item); return }
                if cur is MKAnnotationView { return } // the user's location
                v = cur.superview
            }
            parent?.onTapMap?()
        }

        /// Doesn't hold back MapKit's own gestures.
        func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }

        func mapView(_ map: MKMapView, regionDidChangeAnimated animated: Bool) {
            parent?.onRegionChange?(map.region)
        }

        /// Fires continuously while zooming; only reports when the platform/group switch flips.
        var lastPlatformZoom: Bool?
        func mapViewDidChangeVisibleRegion(_ map: MKMapView) {
            guard let parent, parent.platformSpan > 0 else { return }
            let p = map.region.span.latitudeDelta < parent.platformSpan
            guard p != lastPlatformZoom else { return }
            lastPlatformZoom = p
            parent.onPlatformZoom?(p)
        }

        // MARK: Views

        func mapView(_ map: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            guard let p = overlay as? StyledPolyline else { return MKOverlayRenderer(overlay: overlay) }
            let r = MKPolylineRenderer(polyline: p)
            r.strokeColor = p.color
            r.lineWidth = p.width
            r.lineJoin = .round; r.lineCap = .round
            return r
        }

        func mapView(_ map: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            if let v = annotation as? VehicleAnnotation {
                let view = map.dequeueReusableAnnotationView(withIdentifier: "vehicle", for: v) as! VehicleView
                view.configure(v.item, selected: v.selected)
                return view
            }
            if let s = annotation as? StopAnnotation {
                let view = map.dequeueReusableAnnotationView(withIdentifier: "stop", for: s) as! StopView
                view.configure(s.item)
                return view
            }
            return nil // the user's location: the system dot
        }
    }
}

/// An MKMapView that applies its region only once it has a size (in a sheet it has none at first, and a region set then is off screen).
final class SizedMapView: MKMapView {
    private var pending: MKCoordinateRegion?
    func apply(_ region: MKCoordinateRegion) {
        pending = region
        if bounds.width > 0, bounds.height > 0 { flush() } else { setNeedsLayout() }
    }
    private func flush() {
        guard let r = pending else { return }
        pending = nil
        // An invalid region (NaN, out of range) raises an exception in MapKit: skip it
        let c = r.center, sp = r.span
        guard c.latitude.isFinite, c.longitude.isFinite, sp.latitudeDelta.isFinite, sp.longitudeDelta.isFinite,
              abs(c.latitude) <= 90, abs(c.longitude) <= 180, sp.latitudeDelta > 0, sp.longitudeDelta > 0 else { return }
        setRegion(r, animated: false)
    }
    override func layoutSubviews() {
        super.layoutSubviews()
        if pending != nil, bounds.width > 0, bounds.height > 0 { flush() }
    }
}

final class StyledPolyline: MKPolyline {
    var color: UIColor = .systemBlue
    var width: CGFloat = 3
}

final class StopAnnotation: NSObject, MKAnnotation {
    @objc dynamic var coordinate: CLLocationCoordinate2D
    var item: MapStop
    init(item: MapStop) { self.item = item; coordinate = item.coordinate }
}

final class VehicleAnnotation: NSObject, MKAnnotation {
    @objc dynamic var coordinate: CLLocationCoordinate2D
    var item: MapVehicle
    var selected = false
    init(item: MapVehicle) { self.item = item; coordinate = item.coordinate }
}

// MARK: Annotation views

private func hostView<C: View>(_ content: C, in view: UIView) -> UIHostingController<C> {
    let h = UIHostingController(rootView: content)
    h.view.backgroundColor = .clear
    h.view.frame = view.bounds
    if #available(iOS 16.4, *) { h.safeAreaRegions = [] }
    view.addSubview(h.view)
    return h
}

/// A stop. Its dot's centre sits on the coordinate; what hangs under it (time, badges) belongs to the same view,
/// so it can't be covered by another stop's dot. Stops are at the bottom of the stack, a selected one above them.
final class StopView: MKAnnotationView {
    private static let size = CGSize(width: 128, height: 76)
    private static let dotY: CGFloat = 16
    private var host: UIHostingController<StopDotContent>?
    override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
        frame = CGRect(origin: .zero, size: StopView.size)
        centerOffset = CGPoint(x: 0, y: StopView.size.height / 2 - StopView.dotY)
        displayPriority = .required
        canShowCallout = false
        isEnabled = false // MapKit's own selection is off; taps are handled by the map's recognizer
    }
    required init?(coder: NSCoder) { fatalError() }

    func configure(_ s: MapStop) {
        let content = StopDotContent(tint: s.tint, filled: s.filled, dot: s.dot, time: s.time, realtime: s.realtime, routes: s.routes, selected: s.selected)
        if let host { host.rootView = content } else { host = hostView(content, in: self) }
        alpha = s.opacity
        zPriority = s.selected ? MKAnnotationViewZPriority(rawValue: 500) : .min
    }

    /// Only the dot itself takes taps, so the badges and times don't block the map or other stops.
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        CGRect(x: StopView.size.width / 2 - 18, y: StopView.dotY - 18, width: 36, height: 36).contains(point)
    }
}

/// A vehicle's line disc, always above stops (zPriority .max).
final class VehicleView: MKAnnotationView {
    private var host: UIHostingController<VehicleDisc>?
    override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
        frame = CGRect(x: 0, y: 0, width: 64, height: 64)
        zPriority = .max
        displayPriority = .required
        canShowCallout = false
        isEnabled = false
    }
    required init?(coder: NSCoder) { fatalError() }

    func configure(_ v: MapVehicle, selected: Bool) {
        let disc = VehicleDisc(line: v.line, bearing: v.bearing, selected: selected, compact: v.compact)
        if let host { host.rootView = disc } else { host = hostView(disc, in: self) }
        zPriority = .max
    }

    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        CGRect(x: 10, y: 10, width: 44, height: 44).contains(point)
    }
}

/// The stop marker's content, same on every map.
struct StopDotContent: View {
    let tint: Color
    var filled = false
    var dot: CGFloat = 10
    var time: String?
    var realtime = false
    var routes: [LineRef] = []
    var selected = false

    var body: some View {
        let d = dot
        VStack(spacing: 0) {
            Group {
                if filled {
                    Circle().fill(tint).frame(width: d, height: d).overlay(Circle().stroke(Color.white, lineWidth: 2))
                } else {
                    Circle().fill(Color.white).frame(width: d, height: d).overlay(Circle().stroke(tint, lineWidth: 2))
                }
            }
            // Same curve and scale as VehicleDisc's compact dot
            .scaleEffect(selected ? 1.3 : 1)
            .animation(.spring(response: 0.2, dampingFraction: 0.8), value: selected)
            .frame(width: 32, height: 32)
            VStack(spacing: 2) {
                if !routes.isEmpty { badges }
                if let time {
                    HStack(spacing: 3) {
                        Text(time).font(.system(size: 11, weight: .semibold)).monospacedDigit()
                        if realtime { LiveIcon() }
                    }
                    .fixedSize()
                    .padding(.horizontal, 5).padding(.vertical, 2)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 6))
                }
            }
            .padding(.top, -9)
        }
        .frame(width: 128, height: 76, alignment: .top)
    }

    /// Up to two rows of four badges, then an ellipsis. Variants (56A, 56É...) are left out when the base line (56) is there too.
    private var badges: some View {
        let names = Set(routes.compactMap(\.shortName))
        // Custom: with 4, 6 and 4-6 all here, just 4-6
        let merged46 = names.contains("4") && names.contains("6") && names.contains("4-6")
        let base = routes.filter { r in
            if merged46 && (r.shortName == "4" || r.shortName == "6") { return false }
            guard let n = r.shortName, let last = n.last, last.isLetter, n.count > 1 else { return true }
            let head = String(n.dropLast())
            return !(head.allSatisfy(\.isNumber) && names.contains(head))
        }
        let shown = Array(base.prefix(8))
        return VStack(spacing: 2) {
            let perRow = shown.count > 4 ? (shown.count + 1) / 2 : max(shown.count, 1) // two even rows, or one
            ForEach(Array(stride(from: 0, to: shown.count, by: perRow)), id: \.self) { start in
                HStack(spacing: 2) {
                    ForEach(shown[start..<min(start + perRow, shown.count)], id: \.routeId) { r in
                        Text(r.shortName ?? "").font(.system(size: 10, weight: .bold)).lineLimit(1).fixedSize()
                            .foregroundStyle(Color(hex: r.textColor ?? "#ffffff"))
                            .padding(.horizontal, 4).frame(minHeight: 14).frame(minWidth: 14)
                            .background(Color(hex: r.color ?? "#000000"), in: RoundedRectangle(cornerRadius: 3))
                    }
                    // More lines than fit: a grey badge with an ellipsis instead of a count
                    if start + perRow >= shown.count && base.count > 8 {
                        Text("…").font(.system(size: 10, weight: .bold)).fixedSize().foregroundStyle(.white)
                            .padding(.horizontal, 4).frame(minHeight: 14).frame(minWidth: 14)
                            .background(Color.gray, in: RoundedRectangle(cornerRadius: 3))
                    }
                }
            }
        }
        .fixedSize()
    }
}

// MARK: Controls

/// MapKit's own location and compass buttons, attached to the map through its handle.
struct MapLocationButton: UIViewRepresentable {
    let handle: MapHandle
    func makeUIView(context: Context) -> MKUserTrackingButton { MKUserTrackingButton(mapView: handle.map) }
    func updateUIView(_ b: MKUserTrackingButton, context: Context) { if b.mapView !== handle.map { b.mapView = handle.map } }
}

struct MapCompassButton: UIViewRepresentable {
    let handle: MapHandle
    func makeUIView(context: Context) -> MKCompassButton {
        let b = MKCompassButton(mapView: handle.map)
        b.compassVisibility = .adaptive
        return b
    }
    func updateUIView(_ b: MKCompassButton, context: Context) { if b.mapView !== handle.map { b.mapView = handle.map } }
}
