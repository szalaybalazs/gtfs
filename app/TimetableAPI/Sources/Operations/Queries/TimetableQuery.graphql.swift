// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI

public class TimetableQuery: GraphQLQuery {
  public static let operationName: String = "Timetable"
  public static let operationDocument: ApolloAPI.OperationDocument = .init(
    definition: .init(
      #"query Timetable($stopId: ID!, $routeId: ID!, $range: RangeInput) { timetable(stopId: $stopId, routeId: $routeId, range: $range) { __typename arrival departure serviceId tripId wheelchairAccessible bikesAllowed arrivalDelay departureDelay scheduleRelationship isNext isPast } }"#
    ))

  public var stopId: ID
  public var routeId: ID
  public var range: GraphQLNullable<RangeInput>

  public init(
    stopId: ID,
    routeId: ID,
    range: GraphQLNullable<RangeInput>
  ) {
    self.stopId = stopId
    self.routeId = routeId
    self.range = range
  }

  public var __variables: Variables? { [
    "stopId": stopId,
    "routeId": routeId,
    "range": range
  ] }

  public struct Data: TimetableAPI.SelectionSet {
    public let __data: DataDict
    public init(_dataDict: DataDict) { __data = _dataDict }

    public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Query }
    public static var __selections: [ApolloAPI.Selection] { [
      .field("timetable", [Timetable].self, arguments: [
        "stopId": .variable("stopId"),
        "routeId": .variable("routeId"),
        "range": .variable("range")
      ]),
    ] }

    public var timetable: [Timetable] { __data["timetable"] }

    /// Timetable
    ///
    /// Parent Type: `TimetableEntry`
    public struct Timetable: TimetableAPI.SelectionSet {
      public let __data: DataDict
      public init(_dataDict: DataDict) { __data = _dataDict }

      public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.TimetableEntry }
      public static var __selections: [ApolloAPI.Selection] { [
        .field("__typename", String.self),
        .field("arrival", TimetableAPI.DateTime.self),
        .field("departure", TimetableAPI.DateTime.self),
        .field("serviceId", TimetableAPI.ID.self),
        .field("tripId", TimetableAPI.ID.self),
        .field("wheelchairAccessible", GraphQLEnum<TimetableAPI.WheelchairBoarding>.self),
        .field("bikesAllowed", GraphQLEnum<TimetableAPI.BikesAllowed>.self),
        .field("arrivalDelay", Int?.self),
        .field("departureDelay", Int?.self),
        .field("scheduleRelationship", GraphQLEnum<TimetableAPI.ScheduleRelationship>?.self),
        .field("isNext", Bool.self),
        .field("isPast", Bool.self),
      ] }

      public var arrival: TimetableAPI.DateTime { __data["arrival"] }
      public var departure: TimetableAPI.DateTime { __data["departure"] }
      public var serviceId: TimetableAPI.ID { __data["serviceId"] }
      public var tripId: TimetableAPI.ID { __data["tripId"] }
      public var wheelchairAccessible: GraphQLEnum<TimetableAPI.WheelchairBoarding> { __data["wheelchairAccessible"] }
      public var bikesAllowed: GraphQLEnum<TimetableAPI.BikesAllowed> { __data["bikesAllowed"] }
      public var arrivalDelay: Int? { __data["arrivalDelay"] }
      public var departureDelay: Int? { __data["departureDelay"] }
      public var scheduleRelationship: GraphQLEnum<TimetableAPI.ScheduleRelationship>? { __data["scheduleRelationship"] }
      public var isNext: Bool { __data["isNext"] }
      public var isPast: Bool { __data["isPast"] }
    }
  }
}
