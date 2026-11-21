// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI

public class RouteByIdQuery: GraphQLQuery {
  public static let operationName: String = "RouteById"
  public static let operationDocument: ApolloAPI.OperationDocument = .init(
    definition: .init(
      #"query RouteById($routeId: ID!) { route(id: $routeId) { __typename routeId shortName longName desc color textColor type flags { __typename lowFloor circular demandResponsive frontDoor replacement } directions { __typename headsign directionId stops { __typename stopId name lat lon } } } }"#
    ))

  public var routeId: ID

  public init(
    routeId: ID
  ) {
    self.routeId = routeId
  }

  public var __variables: Variables? { [
    "routeId": routeId
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
        .field("shortName", String?.self),
        .field("longName", String?.self),
        .field("desc", String?.self),
        .field("color", String?.self),
        .field("textColor", String?.self),
        .field("type", GraphQLEnum<TimetableAPI.RouteType>?.self),
        .field("flags", Flags.self),
        .field("directions", [Direction]?.self),
      ] }

      public var routeId: TimetableAPI.ID { __data["routeId"] }
      public var shortName: String? { __data["shortName"] }
      public var longName: String? { __data["longName"] }
      public var desc: String? { __data["desc"] }
      public var color: String? { __data["color"] }
      public var textColor: String? { __data["textColor"] }
      public var type: GraphQLEnum<TimetableAPI.RouteType>? { __data["type"] }
      public var flags: Flags { __data["flags"] }
      public var directions: [Direction]? { __data["directions"] }

      /// Route.Flags
      ///
      /// Parent Type: `RouteFlags`
      public struct Flags: TimetableAPI.SelectionSet {
        public let __data: DataDict
        public init(_dataDict: DataDict) { __data = _dataDict }

        public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.RouteFlags }
        public static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .field("lowFloor", Bool.self),
          .field("circular", Bool.self),
          .field("demandResponsive", Bool.self),
          .field("frontDoor", Bool.self),
          .field("replacement", Bool.self),
        ] }

        public var lowFloor: Bool { __data["lowFloor"] }
        public var circular: Bool { __data["circular"] }
        public var demandResponsive: Bool { __data["demandResponsive"] }
        public var frontDoor: Bool { __data["frontDoor"] }
        public var replacement: Bool { __data["replacement"] }
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
            .field("lat", Double?.self),
            .field("lon", Double?.self),
          ] }

          public var stopId: TimetableAPI.ID { __data["stopId"] }
          public var name: String? { __data["name"] }
          public var lat: Double? { __data["lat"] }
          public var lon: Double? { __data["lon"] }
        }
      }
    }
  }
}
