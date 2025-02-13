// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI

public class StopByIdQuery: GraphQLQuery {
  public static let operationName: String = "StopById"
  public static let operationDocument: ApolloAPI.OperationDocument = .init(
    definition: .init(
      #"query StopById($stopId: ID!) { stop(id: $stopId) { __typename stopId name stopTimes { __typename arrival departure scheduleRelationship departureDelay arrivalDelay trip { __typename tripId headsign wheelchairAccessible bikesAllowed route { __typename routeId shortName color textColor desc longName } } } } }"#
    ))

  public var stopId: ID

  public init(stopId: ID) {
    self.stopId = stopId
  }

  public var __variables: Variables? { ["stopId": stopId] }

  public struct Data: TimetableAPI.SelectionSet {
    public let __data: DataDict
    public init(_dataDict: DataDict) { __data = _dataDict }

    public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Query }
    public static var __selections: [ApolloAPI.Selection] { [
      .field("stop", Stop?.self, arguments: ["id": .variable("stopId")]),
    ] }

    public var stop: Stop? { __data["stop"] }

    /// Stop
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
        .field("stopTimes", [StopTime]?.self),
      ] }

      public var stopId: TimetableAPI.ID { __data["stopId"] }
      public var name: String? { __data["name"] }
      public var stopTimes: [StopTime]? { __data["stopTimes"] }

      /// Stop.StopTime
      ///
      /// Parent Type: `StopTime`
      public struct StopTime: TimetableAPI.SelectionSet {
        public let __data: DataDict
        public init(_dataDict: DataDict) { __data = _dataDict }

        public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.StopTime }
        public static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .field("arrival", TimetableAPI.DateTime.self),
          .field("departure", TimetableAPI.DateTime.self),
          .field("scheduleRelationship", GraphQLEnum<TimetableAPI.ScheduleRelationship>?.self),
          .field("departureDelay", Int?.self),
          .field("arrivalDelay", Int?.self),
          .field("trip", Trip.self),
        ] }

        public var arrival: TimetableAPI.DateTime { __data["arrival"] }
        public var departure: TimetableAPI.DateTime { __data["departure"] }
        public var scheduleRelationship: GraphQLEnum<TimetableAPI.ScheduleRelationship>? { __data["scheduleRelationship"] }
        public var departureDelay: Int? { __data["departureDelay"] }
        public var arrivalDelay: Int? { __data["arrivalDelay"] }
        public var trip: Trip { __data["trip"] }

        /// Stop.StopTime.Trip
        ///
        /// Parent Type: `Trip`
        public struct Trip: TimetableAPI.SelectionSet {
          public let __data: DataDict
          public init(_dataDict: DataDict) { __data = _dataDict }

          public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Trip }
          public static var __selections: [ApolloAPI.Selection] { [
            .field("__typename", String.self),
            .field("tripId", TimetableAPI.ID.self),
            .field("headsign", String?.self),
            .field("wheelchairAccessible", GraphQLEnum<TimetableAPI.WheelchairBoarding>?.self),
            .field("bikesAllowed", GraphQLEnum<TimetableAPI.BikesAllowed>?.self),
            .field("route", Route.self),
          ] }

          public var tripId: TimetableAPI.ID { __data["tripId"] }
          public var headsign: String? { __data["headsign"] }
          public var wheelchairAccessible: GraphQLEnum<TimetableAPI.WheelchairBoarding>? { __data["wheelchairAccessible"] }
          public var bikesAllowed: GraphQLEnum<TimetableAPI.BikesAllowed>? { __data["bikesAllowed"] }
          public var route: Route { __data["route"] }

          /// Stop.StopTime.Trip.Route
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
              .field("desc", String?.self),
              .field("longName", String?.self),
            ] }

            public var routeId: TimetableAPI.ID { __data["routeId"] }
            public var shortName: String? { __data["shortName"] }
            public var color: String? { __data["color"] }
            public var textColor: String? { __data["textColor"] }
            public var desc: String? { __data["desc"] }
            public var longName: String? { __data["longName"] }
          }
        }
      }
    }
  }
}
