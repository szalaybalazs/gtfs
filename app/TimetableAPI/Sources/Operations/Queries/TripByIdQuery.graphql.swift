// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI

public class TripByIdQuery: GraphQLQuery {
  public static let operationName: String = "TripById"
  public static let operationDocument: ApolloAPI.OperationDocument = .init(
    definition: .init(
      #"query TripById($tripId: ID!) { trip(id: $tripId) { __typename tripId headsign wheelchairAccessible bikesAllowed route { __typename color textColor } stopTimes { __typename arrivalTime departureTime arrivalDelay departureDelay scheduleRelationship stopSequence pickupType dropOffType shapeDistTraveled arrival departure stop { __typename stopId name } } } }"#
    ))

  public var tripId: ID

  public init(tripId: ID) {
    self.tripId = tripId
  }

  public var __variables: Variables? { ["tripId": tripId] }

  public struct Data: TimetableAPI.SelectionSet {
    public let __data: DataDict
    public init(_dataDict: DataDict) { __data = _dataDict }

    public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Query }
    public static var __selections: [ApolloAPI.Selection] { [
      .field("trip", Trip?.self, arguments: ["id": .variable("tripId")]),
    ] }

    public var trip: Trip? { __data["trip"] }

    /// Trip
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
        .field("stopTimes", [StopTime]?.self),
      ] }

      public var tripId: TimetableAPI.ID { __data["tripId"] }
      public var headsign: String? { __data["headsign"] }
      public var wheelchairAccessible: GraphQLEnum<TimetableAPI.WheelchairBoarding>? { __data["wheelchairAccessible"] }
      public var bikesAllowed: GraphQLEnum<TimetableAPI.BikesAllowed>? { __data["bikesAllowed"] }
      public var route: Route { __data["route"] }
      public var stopTimes: [StopTime]? { __data["stopTimes"] }

      /// Trip.Route
      ///
      /// Parent Type: `Route`
      public struct Route: TimetableAPI.SelectionSet {
        public let __data: DataDict
        public init(_dataDict: DataDict) { __data = _dataDict }

        public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Route }
        public static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .field("color", String?.self),
          .field("textColor", String?.self),
        ] }

        public var color: String? { __data["color"] }
        public var textColor: String? { __data["textColor"] }
      }

      /// Trip.StopTime
      ///
      /// Parent Type: `StopTime`
      public struct StopTime: TimetableAPI.SelectionSet {
        public let __data: DataDict
        public init(_dataDict: DataDict) { __data = _dataDict }

        public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.StopTime }
        public static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .field("arrivalTime", String?.self),
          .field("departureTime", String?.self),
          .field("arrivalDelay", Int?.self),
          .field("departureDelay", Int?.self),
          .field("scheduleRelationship", GraphQLEnum<TimetableAPI.ScheduleRelationship>?.self),
          .field("stopSequence", Int?.self),
          .field("pickupType", Int?.self),
          .field("dropOffType", Int?.self),
          .field("shapeDistTraveled", Double?.self),
          .field("arrival", TimetableAPI.DateTime.self),
          .field("departure", TimetableAPI.DateTime.self),
          .field("stop", Stop.self),
        ] }

        public var arrivalTime: String? { __data["arrivalTime"] }
        public var departureTime: String? { __data["departureTime"] }
        public var arrivalDelay: Int? { __data["arrivalDelay"] }
        public var departureDelay: Int? { __data["departureDelay"] }
        public var scheduleRelationship: GraphQLEnum<TimetableAPI.ScheduleRelationship>? { __data["scheduleRelationship"] }
        public var stopSequence: Int? { __data["stopSequence"] }
        public var pickupType: Int? { __data["pickupType"] }
        public var dropOffType: Int? { __data["dropOffType"] }
        public var shapeDistTraveled: Double? { __data["shapeDistTraveled"] }
        public var arrival: TimetableAPI.DateTime { __data["arrival"] }
        public var departure: TimetableAPI.DateTime { __data["departure"] }
        public var stop: Stop { __data["stop"] }

        /// Trip.StopTime.Stop
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
