// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI

public class NearbyStationsQuery: GraphQLQuery {
  public static let operationName: String = "NearbyStations"
  public static let operationDocument: ApolloAPI.OperationDocument = .init(
    definition: .init(
      #"query NearbyStations($lat: Float!, $lon: Float!, $radius: Float!) { stationsByRadius(lat: $lat, lon: $lon, radius: $radius) { __typename stationId name lat lon routes { __typename routeId shortName color textColor type } stops { __typename stopId name code lat lon headsigns routes { __typename routeId shortName color textColor type } } } }"#
    ))

  public var lat: Double
  public var lon: Double
  public var radius: Double

  public init(
    lat: Double,
    lon: Double,
    radius: Double
  ) {
    self.lat = lat
    self.lon = lon
    self.radius = radius
  }

  public var __variables: Variables? { [
    "lat": lat,
    "lon": lon,
    "radius": radius
  ] }

  public struct Data: TimetableAPI.SelectionSet {
    public let __data: DataDict
    public init(_dataDict: DataDict) { __data = _dataDict }

    public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Query }
    public static var __selections: [ApolloAPI.Selection] { [
      .field("stationsByRadius", [StationsByRadius].self, arguments: [
        "lat": .variable("lat"),
        "lon": .variable("lon"),
        "radius": .variable("radius")
      ]),
    ] }

    public var stationsByRadius: [StationsByRadius] { __data["stationsByRadius"] }

    /// StationsByRadius
    ///
    /// Parent Type: `Station`
    public struct StationsByRadius: TimetableAPI.SelectionSet {
      public let __data: DataDict
      public init(_dataDict: DataDict) { __data = _dataDict }

      public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Station }
      public static var __selections: [ApolloAPI.Selection] { [
        .field("__typename", String.self),
        .field("stationId", TimetableAPI.ID.self),
        .field("name", String.self),
        .field("lat", Double.self),
        .field("lon", Double.self),
        .field("routes", [Route].self),
        .field("stops", [Stop].self),
      ] }

      public var stationId: TimetableAPI.ID { __data["stationId"] }
      public var name: String { __data["name"] }
      public var lat: Double { __data["lat"] }
      public var lon: Double { __data["lon"] }
      public var routes: [Route] { __data["routes"] }
      public var stops: [Stop] { __data["stops"] }

      /// StationsByRadius.Route
      ///
      /// Parent Type: `Route`
      public struct Route: TimetableAPI.SelectionSet {
        public let __data: DataDict
        public init(_dataDict: DataDict) { __data = _dataDict }

        public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Route }
        public static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .field("routeId", TimetableAPI.ID.self),
          .field("shortName", String?.self),
          .field("color", String?.self),
          .field("textColor", String?.self),
          .field("type", GraphQLEnum<TimetableAPI.RouteType>?.self),
        ] }

        public var routeId: TimetableAPI.ID { __data["routeId"] }
        public var shortName: String? { __data["shortName"] }
        public var color: String? { __data["color"] }
        public var textColor: String? { __data["textColor"] }
        public var type: GraphQLEnum<TimetableAPI.RouteType>? { __data["type"] }
      }

      /// StationsByRadius.Stop
      ///
      /// Parent Type: `Stop`
      public struct Stop: TimetableAPI.SelectionSet {
        public let __data: DataDict
        public init(_dataDict: DataDict) { __data = _dataDict }

        public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Stop }
        public static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .field("stopId", TimetableAPI.ID.self),
          .field("name", String?.self),
          .field("code", String?.self),
          .field("lat", Double?.self),
          .field("lon", Double?.self),
          .field("headsigns", [String].self),
          .field("routes", [Route].self),
        ] }

        public var stopId: TimetableAPI.ID { __data["stopId"] }
        public var name: String? { __data["name"] }
        public var code: String? { __data["code"] }
        public var lat: Double? { __data["lat"] }
        public var lon: Double? { __data["lon"] }
        public var headsigns: [String] { __data["headsigns"] }
        public var routes: [Route] { __data["routes"] }

        /// StationsByRadius.Stop.Route
        ///
        /// Parent Type: `Route`
        public struct Route: TimetableAPI.SelectionSet {
          public let __data: DataDict
          public init(_dataDict: DataDict) { __data = _dataDict }

          public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Route }
          public static var __selections: [ApolloAPI.Selection] { [
            .field("__typename", String.self),
            .field("routeId", TimetableAPI.ID.self),
            .field("shortName", String?.self),
            .field("color", String?.self),
            .field("textColor", String?.self),
            .field("type", GraphQLEnum<TimetableAPI.RouteType>?.self),
          ] }

          public var routeId: TimetableAPI.ID { __data["routeId"] }
          public var shortName: String? { __data["shortName"] }
          public var color: String? { __data["color"] }
          public var textColor: String? { __data["textColor"] }
          public var type: GraphQLEnum<TimetableAPI.RouteType>? { __data["type"] }
        }
      }
    }
  }
}
