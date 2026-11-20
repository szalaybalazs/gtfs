//
//  LoadState.swift
//  timetable
//

import Foundation

/// Shared loading/error state for view models.
enum LoadState: Equatable {
    case idle
    case loading
    case failed(String)

    var isLoading: Bool { self == .loading }

    var errorMessage: String? {
        if case .failed(let message) = self { return message }
        return nil
    }

    static func failure(_ error: Error) -> LoadState {
        .failed(error.localizedDescription)
    }
}
