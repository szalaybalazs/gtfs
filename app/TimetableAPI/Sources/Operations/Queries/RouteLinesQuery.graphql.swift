// @generated
// This file was automatically generated and should not be edited.

@_exported import ApolloAPI

public class RouteLinesQuery: GraphQLQuery {
  public static let operationName: String = "RouteLines"
  public static let operationDocument: ApolloAPI.OperationDocument = .init(
    definition: .init(
      #"query RouteLines($types: [RouteType!]) { routeLines(types: $types) }"#
    ))

  public var types: GraphQLNullable<[GraphQLEnum<RouteType>]>

  public init(types: GraphQLNullable<[GraphQLEnum<RouteType>]>) {
    self.types = types
  }

  public var __variables: Variables? { ["types": types] }

  public struct Data: TimetableAPI.SelectionSet {
    public let __data: DataDict
    public init(_dataDict: DataDict) { __data = _dataDict }

    public static var __parentType: any ApolloAPI.ParentType { TimetableAPI.Objects.Query }
    public static var __selections: [ApolloAPI.Selection] { [
      .field("routeLines", String.self, arguments: ["types": .variable("types")]),
    ] }

    public var routeLines: String { __data["routeLines"] }
  }
}
