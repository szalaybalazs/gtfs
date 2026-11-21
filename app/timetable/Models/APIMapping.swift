//
//  APIMapping.swift
//  timetable
//
//  Maps the generated GraphQL types to the app's models.
//  (TimetableAPI defines scalar typealiases named Date/DateTime, so Foundation.Date is spelled out.)
//

import Foundation
import TimetableAPI

/// The fields every generated route selection has.
protocol RouteRefLike {
    var routeId: String { get }
    var shortName: String? { get }
    var color: String? { get }
    var textColor: String? { get }
    var type: GraphQLEnum<RouteType>? { get }
}

extension RouteRefLike {
    var line: LineRef {
        LineRef(routeId: routeId, shortName: shortName, color: color, textColor: textColor, type: type?.rawValue)
    }
}

extension DeparturesQuery.Data.Departure.Route: RouteRefLike {}
extension StationQuery.Data.Station.Route: RouteRefLike {}
extension StationQuery.Data.Station.Stop.Route: RouteRefLike {}
extension NearbyStationsQuery.Data.StationsByRadius.Route: RouteRefLike {}
extension NearbyStationsQuery.Data.StationsByRadius.Stop.Route: RouteRefLike {}
extension StationsQuery.Data.Stations.Datum.Route: RouteRefLike {}
extension StationsQuery.Data.Stations.Datum.Stop.Route: RouteRefLike {}
extension TripQuery.Data.Trip.Route: RouteRefLike {}

enum APIDate {
    private static let withFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let plain = ISO8601DateFormatter()

    static func parse(_ string: String) -> Foundation.Date? {
        withFraction.date(from: string) ?? plain.date(from: string)
    }

    static func format(_ date: Foundation.Date) -> String {
        withFraction.string(from: date)
    }
}

extension Departure {
    init?(_ d: DeparturesQuery.Data.Departure) {
        guard let arrival = APIDate.parse(d.arrival), let departure = APIDate.parse(d.departure) else { return nil }
        self.init(
            tripId: d.tripId, serviceDate: d.serviceDate, stopId: d.stopId, headsign: d.headsign,
            arrival: arrival, departure: departure,
            arrivalDelay: d.arrivalDelay, departureDelay: d.departureDelay,
            realtime: d.realtime,
            wheelchairAccessible: d.wheelchairAccessible.value == .available,
            bikesAllowed: d.bikesAllowed.value == .allowed,
            frontDoor: d.frontDoor, onRequest: d.onRequest, terminates: d.terminates,
            route: d.route?.line
        )
    }
}

extension Station {
    init(_ s: StationQuery.Data.Station) {
        self.init(stationId: s.stationId, name: s.name, lat: s.lat, lon: s.lon,
                  routes: s.routes.map(\.line),
                  platforms: s.stops.map { p in
                      Platform(stopId: p.stopId, name: p.name, code: p.code, lat: p.lat, lon: p.lon,
                               headsigns: p.headsigns, routes: p.routes.map(\.line))
                  })
    }

    init(_ s: NearbyStationsQuery.Data.StationsByRadius) {
        self.init(stationId: s.stationId, name: s.name, lat: s.lat, lon: s.lon,
                  routes: s.routes.map(\.line),
                  platforms: s.stops.map { p in
                      Platform(stopId: p.stopId, name: p.name, code: p.code, lat: p.lat, lon: p.lon,
                               headsigns: p.headsigns, routes: p.routes.map(\.line))
                  })
    }

    init(_ s: StationsQuery.Data.Stations.Datum) {
        self.init(stationId: s.stationId, name: s.name, lat: s.lat, lon: s.lon,
                  routes: s.routes.map(\.line),
                  platforms: s.stops.map { p in
                      Platform(stopId: p.stopId, name: p.name, code: p.code, lat: p.lat, lon: p.lon,
                               headsigns: p.headsigns, routes: p.routes.map(\.line))
                  })
    }
}

extension Trip {
    init(_ t: TripQuery.Data.Trip) {
        self.init(
            tripId: t.tripId, serviceDate: t.serviceDate, headsign: t.headsign, route: t.route?.line,
            stops: t.stops.compactMap { s in
                guard let arrival = APIDate.parse(s.arrival), let departure = APIDate.parse(s.departure) else { return nil }
                return TripStop(
                    stopSequence: s.stopSequence, stopId: s.stop.stopId, stationId: s.stop.station?.stationId,
                    name: s.stop.name ?? s.stop.stopId, arrival: arrival, departure: departure,
                    arrivalDelay: s.arrivalDelay, departureDelay: s.departureDelay, realtime: s.realtime)
            })
    }
}
