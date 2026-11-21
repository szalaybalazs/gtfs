// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI

public class StationsQuery: GraphQLQuery {
  public static let operationName: String = "Stations"
  public static let operationDocument: ApolloAPI.OperationDocument = .init(
    definition: .init(
      #"query Stations($limit: Int, $page: Int, $search: String) { stations(limit: $limit, page: $page, search: $search) { __typename page pages total data { __typename stationId name lat lon routes { __typename routeId shortName color textColor type } stops { __typename stopId name code lat lon headsigns routes { __typename routeId shortName color textColor type } } } } }"#
    ))

  public var limit: GraphQLNullable<Int>
  public var page: GraphQLNullable<Int>
  public var search: GraphQLNullable<String>

  public init(
    limit: GraphQLNullable<Int>,
    page: GraphQLNullable<Int>,
    search: GraphQLNullable<String>
  ) {
    self.limit = limit
    self.page = page
    self.search = search
  }

  public var __variables: Variables? { [
    "limit": limit,
    "page": page,
    "search": search
  ] }

  public struct Data: TimetableAPI.SelectionSet {
    public let __data: DataDict
    public init(_dataDict: DataDict) { __data = _dataDict }

    public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Query }
    public static var __selections: [ApolloAPI.Selection] { [
      .field("stations", Stations.self, arguments: [
        "limit": .variable("limit"),
        "page": .variable("page"),
        "search": .variable("search")
      ]),
    ] }

    public var stations: Stations { __data["stations"] }

    /// Stations
    ///
    /// Parent Type: `StationPaginated`
    public struct Stations: TimetableAPI.SelectionSet {
      public let __data: DataDict
      public init(_dataDict: DataDict) { __data = _dataDict }

      public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.StationPaginated }
      public static var __selections: [ApolloAPI.Selection] { [
        .field("__typename", String.self),
        .field("page", Int.self),
        .field("pages", Int.self),
        .field("total", Int.self),
        .field("data", [Datum].self),
      ] }

      public var page: Int { __data["page"] }
      public var pages: Int { __data["pages"] }
      public var total: Int { __data["total"] }
      public var data: [Datum] { __data["data"] }

      /// Stations.Datum
      ///
      /// Parent Type: `Station`
      public struct Datum: TimetableAPI.SelectionSet {
        public let __data: DataDict
        public init(_dataDict: DataDict) { __data = _dataDict }

        public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Station }
        public static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .field("stationId", TimetableAPI.ID.self),
          .field("name", String.self),
          .field("lat", Double.self),
          .field("lon", Double.self),
          .field("routes", [Route].self),
          .field("stops", [Stop].self),
        ] }

        public var stationId: TimetableAPI.ID { __data["stationId"] }
        public var name: String { __data["name"] }
        public var lat: Double { __data["lat"] }
        public var lon: Double { __data["lon"] }
        public var routes: [Route] { __data["routes"] }
        public var stops: [Stop] { __data["stops"] }

        /// Stations.Datum.Route
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

        /// Stations.Datum.Stop
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
            .field("code", String?.self),
            .field("lat", Double?.self),
            .field("lon", Double?.self),
            .field("headsigns", [String].self),
            .field("routes", [Route].self),
          ] }

          public var stopId: TimetableAPI.ID { __data["stopId"] }
          public var name: String? { __data["name"] }
          public var code: String? { __data["code"] }
          public var lat: Double? { __data["lat"] }
          public var lon: Double? { __data["lon"] }
          public var headsigns: [String] { __data["headsigns"] }
          public var routes: [Route] { __data["routes"] }

          /// Stations.Datum.Stop.Route
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
}
