// @generated
// This file was automatically generated and should not be edited.

import ApolloAPI

public struct RangeInput: InputObject {
  public private(set) var __data: InputDict

  public init(_ data: InputDict) {
    __data = data
  }

  public init(
    start: Date,
    end: Date
  ) {
    __data = InputDict([
      "start": start,
      "end": end
    ])
  }

  public var start: Date {
    get { __data["start"] }
    set { __data["start"] = newValue }
  }

  public var end: Date {
    get { __data["end"] }
    set { __data["end"] = newValue }
  }
}
