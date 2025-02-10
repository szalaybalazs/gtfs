//
//  StopView.swift
//  timetable
//
//  Created by Balázs Szalay on 2025. 02. 10..
//

import SwiftUI
import TimetableAPI

struct DepartureListItem: View {
    let stopTime: StopByIdQuery.Data.Stop.StopTime
    
    private var trip: StopByIdQuery.Data.Stop.StopTime.Trip {
        stopTime.trip
    }
    
    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        formatter.timeZone = TimeZone(abbreviation: "UTC")
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()
    
    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"
        formatter.timeZone = TimeZone(abbreviation: "UTC")
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()
    
    var time: String {
        guard let date = Self.dateFormatter.date(from: stopTime.arrival) else {
            return "--:--"
        }
        return Self.timeFormatter.string(from: date)
    }
    
    var body: some View {
        NavigationLink(destination: TripView(tripId: trip.tripId, headsign: trip.headsign)){
            HStack(alignment: .center, spacing: 8) {
                VStack(alignment: .leading) {
                    RouteBanner(name: trip.route.shortName ?? "", color: trip.route.color, textColor: trip.route.textColor)
                }.frame(width: 48)
                VStack(alignment: .leading) {
                    Text(trip.headsign ??  "")
                        .font(.headline)
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .fontWeight(.semibold)
                    HStack {
                        Text(time)
                            .font(.subheadline)
                            .lineLimit(1)
                            .truncationMode(.tail)
                    }
                    
                }
                
                let diffInMinutes: Int = {
                    let formatter = ISO8601DateFormatter()
                    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                    
                    guard let arrivalTime = formatter.date(from: stopTime.arrival) else {
                        return 0
                    }
                    
                    return Int(ceil(arrivalTime.timeIntervalSinceNow / 60))
                }()

                let formattedTime: String = {
                    if abs(diffInMinutes) >= 60 {
                        let isNegative = diffInMinutes < 0
                        let absoluteMinutes = abs(diffInMinutes)
                        let hours = absoluteMinutes / 60
                        let remainingMinutes = absoluteMinutes % 60
                        return String(format: "%@%d:%02d", isNegative ? "-" : "", hours, remainingMinutes)
                    } else {
                        return "\(diffInMinutes)"
                    }
                }()
                
                Spacer()
                Text(formattedTime)
                    .foregroundStyle(diffInMinutes < 0 ? .secondary : .primary)
            }
        }
    }

    
}

struct StopView: View {
    public let stopId: String
    public let name: String?
    @StateObject private var stopModel: StopViewModel
    
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
    
    private var departures: [StopByIdQuery.Data.Stop.StopTime] {
        let now = Foundation.Date()
       
        return stopModel.departures.filter {
            guard let date = Self.dateFormatter.date(from: $0.arrival) else { return false }
            return date > now
        }
            .prefix(100)
            .map { $0 }
    }
    

    
    var body: some View {
        List {
            Section(header: Text("Departures")) {
                ForEach(0..<departures.count, id: \.self) { index in
                    DepartureListItem(stopTime: departures[index])
                }
            }
        }
        .listStyle(.grouped)
        .navigationTitle(name ?? "Stop \(stopId)")
        .onAppear {
            stopModel.loadStop()
        }
    }
}

#Preview {
    NavigationView {
        StopView(stopId: "F00918", name: "Kecskemét")
    }
}
