//
//  TripView.swift
//  timetable
//
//  Created by Balázs Szalay on 2025. 02. 10..
//

import SwiftUI
import TimetableAPI

struct StopListItem: View {
    public let stopTime: TripByIdQuery.Data.Trip.StopTime
    public let route: TripByIdQuery.Data.Trip.Route
    public let index: Int
    public let numberOfStops: Int
    
    var body: some View {
        NavigationLink(destination: StopView(stopId: stopTime.stop.stopId, name: stopTime.stop.name)) {
            GeometryReader { geometry in
                HStack(spacing: 8) {
                    let height = geometry.size.height
                    let isEnd = index == numberOfStops - 1 || index == 0
                    let color = Color(hex: route.color!)
                    ZStack(alignment: .center) {
                        Rectangle()
                            .fill(color)
                            .frame(width: 4)
                            .frame(height: isEnd ? height / 2 : height)
                            .offset(y: index == 0 ? height / 4 : index == numberOfStops - 1 ? -height / 4 : 0)
                        Circle()
                            .stroke(color, lineWidth: 8)
                            .fill(Color(uiColor: .systemBackground))
                            .frame(width: 8, height: 8)
                    }
                    .frame(width: 20, height: height)
                    
                    // Stop information
                    HStack {
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
                        Text(stopTime.stop.name ?? "")
                        Spacer()
                        Text(formattedTime)
                            .foregroundStyle(diffInMinutes < 0 ? .secondary : .primary)
                    }
                }
            }
        }
        .listRowInsets(EdgeInsets(
            top: 0,
            leading: 12,  // Default horizontal padding
            bottom: 0,
            trailing: 16  // Default horizontal padding
        ))
        .alignmentGuide(.listRowSeparatorLeading) { viewDimensions in
            return 28
        }
    }
}

struct TripView: View {
    public let tripId: String
    public let headsign: String?
    @StateObject private var tripModel: TripViewModel
    
    init(tripId: String, headsign: String?) {
        self.tripId = tripId
        self.headsign = headsign
        
        _tripModel = StateObject(wrappedValue: TripViewModel(tripId: tripId))
    }
    
    var body: some View {
        List {
            Section(header: Text("Stations")) {
                ForEach(0..<tripModel.stopTimes.count, id: \.self) { index in
                    StopListItem(stopTime: tripModel.stopTimes[index],
                                 route: (tripModel.trip?.route)!,
                                 index: index,
                                 numberOfStops: tripModel.stopTimes.count)
                }
            }
            Section(header: Text("Accessabilities")) {
                HStack(spacing: 12) {
                    Image(systemName: "accessibility").frame(width: 18, height: 18)
                    Text("Wheelchair accessible").font(.footnote)
                }
                HStack(spacing: 12) {
                    Image(systemName: "bicycle.circle").frame(width: 18, height: 18)
                    Text("Bicycle allowed").font(.footnote)
                }
            }
        }
        .listStyle(.grouped)
        .onAppear{
            tripModel.loadRoute()
        }
        .navigationTitle(tripModel.trip?.headsign ?? "")
    }
}

#Preview {
    NavigationView {
        TripView(tripId: "C922453125", headsign: "Test")
    }
}
