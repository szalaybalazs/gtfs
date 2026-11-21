// @generated
// This file was automatically generated and should not be edited.

import ApolloAPI

public protocol SelectionSet: ApolloAPI.SelectionSet & ApolloAPI.RootSelectionSet
where Schema == TimetableAPI.SchemaMetadata {}

public protocol InlineFragment: ApolloAPI.SelectionSet & ApolloAPI.InlineFragment
where Schema == TimetableAPI.SchemaMetadata {}

public protocol MutableSelectionSet: ApolloAPI.MutableRootSelectionSet
where Schema == TimetableAPI.SchemaMetadata {}

public protocol MutableInlineFragment: ApolloAPI.MutableSelectionSet & ApolloAPI.InlineFragment
where Schema == TimetableAPI.SchemaMetadata {}

public enum SchemaMetadata: ApolloAPI.SchemaMetadata {
  public static let configuration: any ApolloAPI.SchemaConfiguration.Type = SchemaConfiguration.self

  public static func objectType(forTypename typename: String) -> ApolloAPI.Object? {
    switch typename {
    case "Alert": return TimetableAPI.Objects.Alert
    case "Departure": return TimetableAPI.Objects.Departure
    case "Direction": return TimetableAPI.Objects.Direction
    case "Query": return TimetableAPI.Objects.Query
    case "Route": return TimetableAPI.Objects.Route
    case "RoutePaginated": return TimetableAPI.Objects.RoutePaginated
    case "Station": return TimetableAPI.Objects.Station
    case "StationPaginated": return TimetableAPI.Objects.StationPaginated
    case "Stop": return TimetableAPI.Objects.Stop
    case "TimetableEntry": return TimetableAPI.Objects.TimetableEntry
    case "TripDetails": return TimetableAPI.Objects.TripDetails
    case "TripStop": return TimetableAPI.Objects.TripStop
    default: return nil
    }
  }
}

public enum Objects {}
public enum Interfaces {}
public enum Unions {}
