import SwiftUI
import TimetableAPI

// Separate model for processed departure data to avoid recalculations
struct DepartureItem: Identifiable {
    let id: String // Use a unique identifier from your data
    let stopTime: StopByIdQuery.Data.Stop.StopTime
    let formattedTime: String
    let minutesUntilDeparture: Int
    
    var formattedDifferenceTime: String {
        if abs(minutesUntilDeparture) >= 60 {
            let isNegative = minutesUntilDeparture < 0
            let absoluteMinutes = abs(minutesUntilDeparture)
            let hours = absoluteMinutes / 60
            let remainingMinutes = absoluteMinutes % 60
            return String(format: "%@%d:%02d", isNegative ? "-" : "", hours, remainingMinutes)
        } else {
            return "\(minutesUntilDeparture)"
        }
    }
}

struct DepartureListItem: View {
    let item: DepartureItem
    
    private var trip: StopByIdQuery.Data.Stop.StopTime.Trip {
        item.stopTime.trip
    }
    
    var body: some View {
        NavigationLink(destination: TripView(tripId: trip.tripId, headsign: trip.headsign)) {
            HStack(alignment: .center, spacing: 8) {
                VStack(alignment: .leading) {
                    RouteBanner(name: trip.route.shortName ?? "",
                              color: trip.route.color,
                              textColor: trip.route.textColor)
                }
                .frame(width: 46)
                
                VStack(alignment: .leading) {
                    Text(trip.headsign ?? "")
                        .font(.headline)
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .fontWeight(.semibold)
                    
                    Text(item.formattedTime)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                Text(item.formattedDifferenceTime)
                    .foregroundStyle(item.minutesUntilDeparture < 0 ? .secondary : .primary)
            }
        }
            .listRowInsets(EdgeInsets(
                top: 8,
                leading: 8,
                bottom: 8,
                trailing: 16
            ))
            .alignmentGuide(.listRowSeparatorLeading) { _ in
                return 52
            }
    }
}

struct StopView: View {
    public let stopId: String
    public let name: String?
    @StateObject private var stopModel: StopViewModel
    
    // Store processed departures
    @State private var processedDepartures: [DepartureItem] = []
    
    init(stopId: String, name: String?) {
        self.stopId = stopId
        self.name = name
        _stopModel = StateObject(wrappedValue: StopViewModel(stopId: stopId))
    }
    
    private static let dateFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
    
    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        formatter.timeZone = TimeZone(abbreviation: "UTC")
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()
    
    private func processDepartures() {
        let now = Foundation.Date()
        
        Task {
            // Process departures in background
            let processed = await withTaskGroup(of: DepartureItem?.self) { group in
                for departure in stopModel.departures {
                    group.addTask {
                        guard let date = Self.dateFormatter.date(from: departure.arrival),
                              date > now else { return nil }
                        
                        return DepartureItem(
                            id: departure.arrival, // Use a better unique identifier if available
                            stopTime: departure,
                            formattedTime: Self.timeFormatter.string(from: date),
                            minutesUntilDeparture: Int(ceil(date.timeIntervalSinceNow / 60))
                        )
                    }
                }
                
                var results: [DepartureItem] = []
                for await result in group {
                    if let result = result {
                        results.append(result)
                    }
                }
                return results
            }
            
            // Update UI on main thread
            await MainActor.run {
                processedDepartures = processed
                    .sorted { $0.minutesUntilDeparture < $1.minutesUntilDeparture }
            }
        }
    }
    
    var body: some View {
        List {
            Section(header: Text("Departures")) {
                ForEach(processedDepartures) { item in
                    DepartureListItem(item: item)
                }
            }
        }
        .listStyle(.grouped)
        .listRowInsets(EdgeInsets(
            top: 0,
            leading: 0,  // Default horizontal padding
            bottom: 0,
            trailing: 0  // Default horizontal padding
        ))
        .alignmentGuide(.listRowSeparatorLeading) { viewDimensions in
            return 50
        }
        .navigationTitle(stopModel.stop?.name ?? name ?? "Stop \(stopId)")
        .onAppear {
            stopModel.loadStop()
        }
        .onChange(of: stopModel.departures) { _ in
            processDepartures()
        }
    }
}

#Preview {
    NavigationView {
        StopView(stopId: "F00918", name: "Kecskemét")
    }
}
