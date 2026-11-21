// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI

public class DeparturesQuery: GraphQLQuery {
  public static let operationName: String = "Departures"
  public static let operationDocument: ApolloAPI.OperationDocument = .init(
    definition: .init(
      #"query Departures($stopIds: [ID!]!, $routeIds: [ID!], $limit: Int, $hours: Int, $after: DateTime, $arrivals: Boolean, $perLine: Int) { departures(stopIds: $stopIds, routeIds: $routeIds, limit: $limit, hours: $hours, after: $after, arrivals: $arrivals, perLine: $perLine) { __typename tripId serviceDate stopId headsign arrival departure arrivalDelay departureDelay realtime wheelchairAccessible bikesAllowed frontDoor onRequest terminates route { __typename routeId shortName color textColor type } } }"#
    ))

  public var stopIds: [ID]
  public var routeIds: GraphQLNullable<[ID]>
  public var limit: GraphQLNullable<Int>
  public var hours: GraphQLNullable<Int>
  public var after: GraphQLNullable<DateTime>
  public var arrivals: GraphQLNullable<Bool>
  public var perLine: GraphQLNullable<Int>

  public init(
    stopIds: [ID],
    routeIds: GraphQLNullable<[ID]>,
    limit: GraphQLNullable<Int>,
    hours: GraphQLNullable<Int>,
    after: GraphQLNullable<DateTime>,
    arrivals: GraphQLNullable<Bool>,
    perLine: GraphQLNullable<Int>
  ) {
    self.stopIds = stopIds
    self.routeIds = routeIds
    self.limit = limit
    self.hours = hours
    self.after = after
    self.arrivals = arrivals
    self.perLine = perLine
  }

  public var __variables: Variables? { [
    "stopIds": stopIds,
    "routeIds": routeIds,
    "limit": limit,
    "hours": hours,
    "after": after,
    "arrivals": arrivals,
    "perLine": perLine
  ] }

  public struct Data: TimetableAPI.SelectionSet {
    public let __data: DataDict
    public init(_dataDict: DataDict) { __data = _dataDict }

    public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Query }
    public static var __selections: [ApolloAPI.Selection] { [
      .field("departures", [Departure].self, arguments: [
        "stopIds": .variable("stopIds"),
        "routeIds": .variable("routeIds"),
        "limit": .variable("limit"),
        "hours": .variable("hours"),
        "after": .variable("after"),
        "arrivals": .variable("arrivals"),
        "perLine": .variable("perLine")
      ]),
    ] }

    public var departures: [Departure] { __data["departures"] }

    /// Departure
    ///
    /// Parent Type: `Departure`
    public struct Departure: TimetableAPI.SelectionSet {
      public let __data: DataDict
      public init(_dataDict: DataDict) { __data = _dataDict }

      public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Departure }
      public static var __selections: [ApolloAPI.Selection] { [
        .field("__typename", String.self),
        .field("tripId", TimetableAPI.ID.self),
        .field("serviceDate", String.self),
        .field("stopId", TimetableAPI.ID.self),
        .field("headsign", String?.self),
        .field("arrival", TimetableAPI.DateTime.self),
        .field("departure", TimetableAPI.DateTime.self),
        .field("arrivalDelay", Int?.self),
        .field("departureDelay", Int?.self),
        .field("realtime", Bool.self),
        .field("wheelchairAccessible", GraphQLEnum<TimetableAPI.WheelchairBoarding>.self),
        .field("bikesAllowed", GraphQLEnum<TimetableAPI.BikesAllowed>.self),
        .field("frontDoor", Bool.self),
        .field("onRequest", Bool.self),
        .field("terminates", Bool.self),
        .field("route", Route?.self),
      ] }

      public var tripId: TimetableAPI.ID { __data["tripId"] }
      public var serviceDate: String { __data["serviceDate"] }
      public var stopId: TimetableAPI.ID { __data["stopId"] }
      public var headsign: String? { __data["headsign"] }
      public var arrival: TimetableAPI.DateTime { __data["arrival"] }
      public var departure: TimetableAPI.DateTime { __data["departure"] }
      public var arrivalDelay: Int? { __data["arrivalDelay"] }
      public var departureDelay: Int? { __data["departureDelay"] }
      public var realtime: Bool { __data["realtime"] }
      public var wheelchairAccessible: GraphQLEnum<TimetableAPI.WheelchairBoarding> { __data["wheelchairAccessible"] }
      public var bikesAllowed: GraphQLEnum<TimetableAPI.BikesAllowed> { __data["bikesAllowed"] }
      public var frontDoor: Bool { __data["frontDoor"] }
      public var onRequest: Bool { __data["onRequest"] }
      public var terminates: Bool { __data["terminates"] }
      public var route: Route? { __data["route"] }

      /// Departure.Route
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
