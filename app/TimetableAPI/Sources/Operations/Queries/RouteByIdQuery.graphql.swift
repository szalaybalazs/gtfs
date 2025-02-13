// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI

public class RouteByIdQuery: GraphQLQuery {
  public static let operationName: String = "RouteById"
  public static let operationDocument: ApolloAPI.OperationDocument = .init(
    definition: .init(
      #"query RouteById($routeId: ID!, $lat: Float, $lon: Float) { route(id: $routeId) { __typename routeId closestStop(lat: $lat, lon: $lon) { __typename code name stopId } directions { __typename headsign directionId stops { __typename stopId name } } } }"#
    ))

  public var routeId: ID
  public var lat: GraphQLNullable<Double>
  public var lon: GraphQLNullable<Double>

  public init(
    routeId: ID,
    lat: GraphQLNullable<Double>,
    lon: GraphQLNullable<Double>
  ) {
    self.routeId = routeId
    self.lat = lat
    self.lon = lon
  }

  public var __variables: Variables? { [
    "routeId": routeId,
    "lat": lat,
    "lon": lon
  ] }

  public struct Data: TimetableAPI.SelectionSet {
    public let __data: DataDict
    public init(_dataDict: DataDict) { __data = _dataDict }

    public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Query }
    public static var __selections: [ApolloAPI.Selection] { [
      .field("route", Route?.self, arguments: ["id": .variable("routeId")]),
    ] }

    public var route: Route? { __data["route"] }

    /// Route
    ///
    /// Parent Type: `Route`
    public struct Route: TimetableAPI.SelectionSet {
      public let __data: DataDict
      public init(_dataDict: DataDict) { __data = _dataDict }

      public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Route }
      public static var __selections: [ApolloAPI.Selection] { [
        .field("__typename", String.self),
        .field("routeId", TimetableAPI.ID.self),
        .field("closestStop", ClosestStop?.self, arguments: [
          "lat": .variable("lat"),
          "lon": .variable("lon")
        ]),
        .field("directions", [Direction]?.self),
      ] }

      public var routeId: TimetableAPI.ID { __data["routeId"] }
      public var closestStop: ClosestStop? { __data["closestStop"] }
      public var directions: [Direction]? { __data["directions"] }

      /// Route.ClosestStop
      ///
      /// Parent Type: `Stop`
      public struct ClosestStop: TimetableAPI.SelectionSet {
        public let __data: DataDict
        public init(_dataDict: DataDict) { __data = _dataDict }

        public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Stop }
        public static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .field("code", String?.self),
          .field("name", String?.self),
          .field("stopId", TimetableAPI.ID.self),
        ] }

        public var code: String? { __data["code"] }
        public var name: String? { __data["name"] }
        public var stopId: TimetableAPI.ID { __data["stopId"] }
      }

      /// Route.Direction
      ///
      /// Parent Type: `Direction`
      public struct Direction: TimetableAPI.SelectionSet {
        public let __data: DataDict
        public init(_dataDict: DataDict) { __data = _dataDict }

        public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Direction }
        public static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .field("headsign", String.self),
          .field("directionId", Int.self),
          .field("stops", [Stop].self),
        ] }

        public var headsign: String { __data["headsign"] }
        public var directionId: Int { __data["directionId"] }
        public var stops: [Stop] { __data["stops"] }

        /// Route.Direction.Stop
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
          ] }

          public var stopId: TimetableAPI.ID { __data["stopId"] }
          public var name: String? { __data["name"] }
        }
      }
    }
  }
}
