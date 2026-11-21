// @generated
// This file was automatically generated and should not be edited.

import ApolloAPI

public struct BboxInput: InputObject {
  public private(set) var __data: InputDict

  public init(_ data: InputDict) {
    __data = data
  }

  public init(
    minLat: Double,
    minLon: Double,
    maxLat: Double,
    maxLon: Double
  ) {
    __data = InputDict([
      "minLat": minLat,
      "minLon": minLon,
      "maxLat": maxLat,
      "maxLon": maxLon
    ])
  }

  public var minLat: Double {
    get { __data["minLat"] }
    set { __data["minLat"] = newValue }
  }

  public var minLon: Double {
    get { __data["minLon"] }
    set { __data["minLon"] = newValue }
  }

  public var maxLat: Double {
    get { __data["maxLat"] }
    set { __data["maxLat"] = newValue }
  }

  public var maxLon: Double {
    get { __data["maxLon"] }
    set { __data["maxLon"] = newValue }
  }
}
