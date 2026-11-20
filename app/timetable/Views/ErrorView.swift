//
//  ErrorView.swift
//  timetable
//

import SwiftUI

/// Inline error message with a retry button.
struct ErrorView: View {
    let message: String
    let retry: () async -> Void

    var body: some View {
        VStack(spacing: 8) {
            Label("Couldn't load", systemImage: "wifi.exclamationmark")
                .font(.headline)
            Text(message)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Retry") { Task { await retry() } }
                .buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
    }
}

#Preview {
    ErrorView(message: "The Internet connection appears to be offline.") {}
}
