// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI

public class VehiclesQuery: GraphQLQuery {
  public static let operationName: String = "Vehicles"
  public static let operationDocument: ApolloAPI.OperationDocument = .init(
    definition: .init(
      #"query Vehicles($bbox: BboxInput) { vehiclePositions(bbox: $bbox) { __typename id latitude longitude bearing vehicleLabel vehicleLicensePlate vehicleModel tripStartDate trip { __typename tripId headsign route { __typename routeId shortName color textColor type } } } }"#
    ))

  public var bbox: GraphQLNullable<BboxInput>

  public init(bbox: GraphQLNullable<BboxInput>) {
    self.bbox = bbox
  }

  public var __variables: Variables? { ["bbox": bbox] }

  public struct Data: TimetableAPI.SelectionSet {
    public let __data: DataDict
    public init(_dataDict: DataDict) { __data = _dataDict }

    public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Query }
    public static var __selections: [ApolloAPI.Selection] { [
      .field("vehiclePositions", [VehiclePosition?].self, arguments: ["bbox": .variable("bbox")]),
    ] }

    public var vehiclePositions: [VehiclePosition?] { __data["vehiclePositions"] }

    /// VehiclePosition
    ///
    /// Parent Type: `VehiclePosition`
    public struct VehiclePosition: TimetableAPI.SelectionSet {
      public let __data: DataDict
      public init(_dataDict: DataDict) { __data = _dataDict }

      public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.VehiclePosition }
      public static var __selections: [ApolloAPI.Selection] { [
        .field("__typename", String.self),
        .field("id", TimetableAPI.ID.self),
        .field("latitude", Double?.self),
        .field("longitude", Double?.self),
        .field("bearing", Double?.self),
        .field("vehicleLabel", String?.self),
        .field("vehicleLicensePlate", String?.self),
        .field("vehicleModel", String?.self),
        .field("tripStartDate", String?.self),
        .field("trip", Trip?.self),
      ] }

      public var id: TimetableAPI.ID { __data["id"] }
      public var latitude: Double? { __data["latitude"] }
      public var longitude: Double? { __data["longitude"] }
      public var bearing: Double? { __data["bearing"] }
      public var vehicleLabel: String? { __data["vehicleLabel"] }
      public var vehicleLicensePlate: String? { __data["vehicleLicensePlate"] }
      public var vehicleModel: String? { __data["vehicleModel"] }
      public var tripStartDate: String? { __data["tripStartDate"] }
      public var trip: Trip? { __data["trip"] }

      /// VehiclePosition.Trip
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
          .field("route", Route?.self),
        ] }

        public var tripId: TimetableAPI.ID { __data["tripId"] }
        public var headsign: String? { __data["headsign"] }
        public var route: Route? { __data["route"] }

        /// VehiclePosition.Trip.Route
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
