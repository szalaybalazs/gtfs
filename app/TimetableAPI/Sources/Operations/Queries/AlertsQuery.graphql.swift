// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI

public class AlertsQuery: GraphQLQuery {
  public static let operationName: String = "Alerts"
  public static let operationDocument: ApolloAPI.OperationDocument = .init(
    definition: .init(
      #"query Alerts($routeIds: [ID!], $stopIds: [ID!], $lang: String) { alerts(routeIds: $routeIds, stopIds: $stopIds, lang: $lang) { __typename id header description url start end effect stopIds routes { __typename routeId shortName color textColor type } } }"#
    ))

  public var routeIds: GraphQLNullable<[ID]>
  public var stopIds: GraphQLNullable<[ID]>
  public var lang: GraphQLNullable<String>

  public init(
    routeIds: GraphQLNullable<[ID]>,
    stopIds: GraphQLNullable<[ID]>,
    lang: GraphQLNullable<String>
  ) {
    self.routeIds = routeIds
    self.stopIds = stopIds
    self.lang = lang
  }

  public var __variables: Variables? { [
    "routeIds": routeIds,
    "stopIds": stopIds,
    "lang": lang
  ] }

  public struct Data: TimetableAPI.SelectionSet {
    public let __data: DataDict
    public init(_dataDict: DataDict) { __data = _dataDict }

    public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Query }
    public static var __selections: [ApolloAPI.Selection] { [
      .field("alerts", [Alert].self, arguments: [
        "routeIds": .variable("routeIds"),
        "stopIds": .variable("stopIds"),
        "lang": .variable("lang")
      ]),
    ] }

    public var alerts: [Alert] { __data["alerts"] }

    /// Alert
    ///
    /// Parent Type: `Alert`
    public struct Alert: TimetableAPI.SelectionSet {
      public let __data: DataDict
      public init(_dataDict: DataDict) { __data = _dataDict }

      public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Alert }
      public static var __selections: [ApolloAPI.Selection] { [
        .field("__typename", String.self),
        .field("id", TimetableAPI.ID.self),
        .field("header", String.self),
        .field("description", String?.self),
        .field("url", String?.self),
        .field("start", TimetableAPI.DateTime?.self),
        .field("end", TimetableAPI.DateTime?.self),
        .field("effect", String?.self),
        .field("stopIds", [TimetableAPI.ID].self),
        .field("routes", [Route].self),
      ] }

      public var id: TimetableAPI.ID { __data["id"] }
      public var header: String { __data["header"] }
      public var description: String? { __data["description"] }
      public var url: String? { __data["url"] }
      public var start: TimetableAPI.DateTime? { __data["start"] }
      public var end: TimetableAPI.DateTime? { __data["end"] }
      public var effect: String? { __data["effect"] }
      public var stopIds: [TimetableAPI.ID] { __data["stopIds"] }
      public var routes: [Route] { __data["routes"] }

      /// Alert.Route
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
