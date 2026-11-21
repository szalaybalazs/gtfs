// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI

public class RoutesQuery: GraphQLQuery {
  public static let operationName: String = "Routes"
  public static let operationDocument: ApolloAPI.OperationDocument = .init(
    definition: .init(
      #"query Routes($limit: Int, $page: Int) { routes(limit: $limit, page: $page) { __typename limit pages page data { __typename longName desc color textColor shortName routeId type } } }"#
    ))

  public var limit: GraphQLNullable<Int>
  public var page: GraphQLNullable<Int>

  public init(
    limit: GraphQLNullable<Int>,
    page: GraphQLNullable<Int>
  ) {
    self.limit = limit
    self.page = page
  }

  public var __variables: Variables? { [
    "limit": limit,
    "page": page
  ] }

  public struct Data: TimetableAPI.SelectionSet {
    public let __data: DataDict
    public init(_dataDict: DataDict) { __data = _dataDict }

    public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Query }
    public static var __selections: [ApolloAPI.Selection] { [
      .field("routes", Routes.self, arguments: [
        "limit": .variable("limit"),
        "page": .variable("page")
      ]),
    ] }

    public var routes: Routes { __data["routes"] }

    /// Routes
    ///
    /// Parent Type: `RoutePaginated`
    public struct Routes: TimetableAPI.SelectionSet {
      public let __data: DataDict
      public init(_dataDict: DataDict) { __data = _dataDict }

      public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.RoutePaginated }
      public static var __selections: [ApolloAPI.Selection] { [
        .field("__typename", String.self),
        .field("limit", Int?.self),
        .field("pages", Int?.self),
        .field("page", Int?.self),
        .field("data", [Datum].self),
      ] }

      public var limit: Int? { __data["limit"] }
      public var pages: Int? { __data["pages"] }
      public var page: Int? { __data["page"] }
      public var data: [Datum] { __data["data"] }

      /// Routes.Datum
      ///
      /// Parent Type: `Route`
      public struct Datum: TimetableAPI.SelectionSet {
        public let __data: DataDict
        public init(_dataDict: DataDict) { __data = _dataDict }

        public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Route }
        public static var __selections: [ApolloAPI.Selection] { [
          .field("__typename", String.self),
          .field("longName", String?.self),
          .field("desc", String?.self),
          .field("color", String?.self),
          .field("textColor", String?.self),
          .field("shortName", String?.self),
          .field("routeId", TimetableAPI.ID.self),
            .field("type", GraphQLEnum<TimetableAPI.RouteType>?.self),
        ] }

        public var longName: String? { __data["longName"] }
        public var desc: String? { __data["desc"] }
        public var color: String? { __data["color"] }
        public var textColor: String? { __data["textColor"] }
        public var shortName: String? { __data["shortName"] }
        public var routeId: TimetableAPI.ID { __data["routeId"] }
        public var type: GraphQLEnum<TimetableAPI.RouteType>? { __data["type"] }

      }
    }
  }
}
