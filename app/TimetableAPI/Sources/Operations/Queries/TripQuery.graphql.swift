// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI

public class TripQuery: GraphQLQuery {
  public static let operationName: String = "Trip"
  public static let operationDocument: ApolloAPI.OperationDocument = .init(
    definition: .init(
      #"query Trip($id: ID!, $serviceDate: String) { trip(id: $id, serviceDate: $serviceDate) { __typename tripId serviceDate headsign route { __typename routeId shortName color textColor type } vehicle { __typename latitude longitude bearing vehicleLabel vehicleLicensePlate vehicleModel vehicleWheelchairAccessible timestamp } stops { __typename stopSequence arrival departure arrivalDelay departureDelay realtime stop { __typename stopId name lat lon station { __typename stationId } } } } }"#
    ))

  public var id: ID
  public var serviceDate: GraphQLNullable<String>

  public init(
    id: ID,
    serviceDate: GraphQLNullable<String>
  ) {
    self.id = id
    self.serviceDate = serviceDate
  }

  public var __variables: Variables? { [
    "id": id,
    "serviceDate": serviceDate
  ] }

  public struct Data: TimetableAPI.SelectionSet {
    public let __data: DataDict
    public init(_dataDict: DataDict) { __data = _dataDict }

    public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Query }
    public static var __selections: [ApolloAPI.Selection] { [
      .field("trip", Trip?.self, arguments: [
        "id": .variable("id"),
        "serviceDate": .variable("serviceDate")
      ]),
    ] }

    public var trip: Trip? { __data["trip"] }

    /// Trip
    ///
    /// Parent Type: `TripDetails`
    public struct Trip: TimetableAPI.SelectionSet {
      public let __data: DataDict
      public init(_dataDict: DataDict) { __data = _dataDict }

      public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.TripDetails }
      public static var __selections: [ApolloAPI.Selection] { [
        .field("__typename", String.self),
        .field("tripId", TimetableAPI.ID.self),
        .field("serviceDate", String.self),
        .field("headsign", String?.self),
        .field("route", Route?.self),
        .field("vehicle", Vehicle?.self),
        .field("stops", [Stop].self),
      ] }

      public var tripId: TimetableAPI.ID { __data["tripId"] }
      public var serviceDate: String { __data["serviceDate"] }
      public var headsign: String? { __data["headsign"] }
      public var route: Route? { __data["route"] }
      public var vehicle: Vehicle? { __data["vehicle"] }
      public var stops: [Stop] { __data["stops"] }

      /// Trip.Vehicle
      ///
      /// Parent Type: `VehiclePosition`
      public struct Vehicle: TimetableAPI.SelectionSet {
        public let __data: DataDict
        public init(_dataDict: DataDict) { __data = _dataDict }

        public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.VehiclePosition }
        public static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .field("latitude", Double?.self),
          .field("longitude", Double?.self),
          .field("bearing", Double?.self),
          .field("vehicleLabel", String?.self),
          .field("vehicleLicensePlate", String?.self),
          .field("vehicleModel", String?.self),
          .field("vehicleWheelchairAccessible", Bool?.self),
          .field("timestamp", TimetableAPI.DateTime?.self),
        ] }

        public var latitude: Double? { __data["latitude"] }
        public var longitude: Double? { __data["longitude"] }
        public var bearing: Double? { __data["bearing"] }
        public var vehicleLabel: String? { __data["vehicleLabel"] }
        public var vehicleLicensePlate: String? { __data["vehicleLicensePlate"] }
        public var vehicleModel: String? { __data["vehicleModel"] }
        public var vehicleWheelchairAccessible: Bool? { __data["vehicleWheelchairAccessible"] }
        public var timestamp: TimetableAPI.DateTime? { __data["timestamp"] }
      }

      /// Trip.Route
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

      /// Trip.Stop
      ///
      /// Parent Type: `TripStop`
      public struct Stop: TimetableAPI.SelectionSet {
        public let __data: DataDict
        public init(_dataDict: DataDict) { __data = _dataDict }

        public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.TripStop }
        public static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .field("stopSequence", Int.self),
          .field("arrival", TimetableAPI.DateTime.self),
          .field("departure", TimetableAPI.DateTime.self),
          .field("arrivalDelay", Int?.self),
          .field("departureDelay", Int?.self),
          .field("realtime", Bool.self),
          .field("stop", Stop.self),
        ] }

        public var stopSequence: Int { __data["stopSequence"] }
        public var arrival: TimetableAPI.DateTime { __data["arrival"] }
        public var departure: TimetableAPI.DateTime { __data["departure"] }
        public var arrivalDelay: Int? { __data["arrivalDelay"] }
        public var departureDelay: Int? { __data["departureDelay"] }
        public var realtime: Bool { __data["realtime"] }
        public var stop: Stop { __data["stop"] }

        /// Trip.Stop.Stop
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
            .field("station", Station?.self),
          ] }

          public var stopId: TimetableAPI.ID { __data["stopId"] }
          public var name: String? { __data["name"] }
          public var lat: Double? { __data["lat"] }
          public var lon: Double? { __data["lon"] }
          public var station: Station? { __data["station"] }

          /// Trip.Stop.Stop.Station
          ///
          /// Parent Type: `Station`
          public struct Station: TimetableAPI.SelectionSet {
            public let __data: DataDict
            public init(_dataDict: DataDict) { __data = _dataDict }

            public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Station }
            public static var __selections: [ApolloAPI.Selection] { [
              .field("__typename", String.self),
              .field("stationId", TimetableAPI.ID.self),
            ] }

            public var stationId: TimetableAPI.ID { __data["stationId"] }
          }
        }
      }
    }
  }
}
