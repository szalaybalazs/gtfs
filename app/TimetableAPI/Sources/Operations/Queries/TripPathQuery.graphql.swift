// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI

public class TripPathQuery: GraphQLQuery {
  public static let operationName: String = "TripPath"
  public static let operationDocument: ApolloAPI.OperationDocument = .init(
    definition: .init(
      #"query TripPath($id: ID!, $serviceDate: String) { trip(id: $id, serviceDate: $serviceDate) { __typename tripId path { __typename coordinates } } }"#
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
        .field("path", Path?.self),
      ] }

      public var tripId: TimetableAPI.ID { __data["tripId"] }
      public var path: Path? { __data["path"] }

      /// Trip.Path
      ///
      /// Parent Type: `LineStringGeometry`
      public struct Path: TimetableAPI.SelectionSet {
        public let __data: DataDict
        public init(_dataDict: DataDict) { __data = _dataDict }

        public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.LineStringGeometry }
        public static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .field("coordinates", [[Double]?]?.self),
        ] }

        public var coordinates: [[Double]?]? { __data["coordinates"] }
      }
    }
  }
}
