// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI

public class TripVehicleQuery: GraphQLQuery {
  public static let operationName: String = "TripVehicle"
  public static let operationDocument: ApolloAPI.OperationDocument = .init(
    definition: .init(
      #"query TripVehicle($id: ID!, $serviceDate: String) { trip(id: $id, serviceDate: $serviceDate) { __typename tripId vehicle { __typename latitude longitude bearing vehicleLabel vehicleLicensePlate vehicleModel vehicleWheelchairAccessible timestamp } } }"#
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
        .field("vehicle", Vehicle?.self),
      ] }

      public var tripId: TimetableAPI.ID { __data["tripId"] }
      public var vehicle: Vehicle? { __data["vehicle"] }

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
    }
  }
}
