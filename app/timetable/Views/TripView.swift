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
    public let targetArrivalTime: DateTime
    public let highlighted: Bool
    
    private func timeFormatter(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        guard let date = formatter.date(from: dateString) else {
            return ""
        }
        
        let dateComponents = Calendar.current.dateComponents([.hour, .minute], from: date)
        
        return String(format: "%02d:%02d", dateComponents.hour ?? 0, dateComponents.minute ?? 0)
    }
    
    
    var body: some View {
        NavigationLink(destination: StopView(stopId: stopTime.stop.stopId, name: stopTime.stop.name)) {
            GeometryReader { geometry in
                HStack(spacing: 8) {
                    let diffInMinutes: Int = {
                       let formatter = ISO8601DateFormatter()
                       formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                       
                       guard let arrivalTime = formatter.date(from: stopTime.arrival),
                             let targetTime = formatter.date(from: targetArrivalTime) else {
                           return 0
                       }
                       
                       // Calculate difference between targetArrivalTime and arrivalTime
                       return Int(ceil((arrivalTime.timeIntervalSince(targetTime)) / 60))
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
                    
                    ZStack {
                        if diffInMinutes != 0 {
                            Text("\(abs(diffInMinutes))'")
                        }
                    }
                        .foregroundStyle(diffInMinutes < 0 ? .secondary : .primary)
                        .font(.caption)
                        .frame(width: 24, alignment: .trailing)
                        .monospaced()
                        .fontWeight(.semibold)
                        .multilineTextAlignment(.trailing)
                    
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
                            .fill(Color(UIColor.secondarySystemBackground))
                            .frame(width: 8, height: 8)
                    }
                    .frame(width: 20, height: height)
                    
                    // Stop information
                    HStack {
                        Text(stopTime.stop.name ?? "")
                            .font(.headline)
                            .lineLimit(1)
                            .truncationMode(.tail)
                            .foregroundStyle(highlighted ? .primary : .secondary)
                        Spacer()
                        Text(timeFormatter(stopTime.arrival))
                            .font(.subheadline)
                            .monospaced()
                            .fontWeight(.semibold)
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
            return 28 + 24 + 8
        }
    }
}

struct TripView: View {
    public let tripId: String
    public let headsign: String?
    public let stopId: String?
    @StateObject private var tripModel: TripViewModel
    
    init(tripId: String, headsign: String?, stopId: String?) {
        self.tripId = tripId
        self.headsign = headsign
        self.stopId = stopId
        
        _tripModel = StateObject(wrappedValue: TripViewModel(tripId: tripId))
    }
    
    var highligtedStopIndex: Int {
        guard let stopId else { return 0 }
        return tripModel.stopTimes.firstIndex { $0.stop.stopId == stopId } ?? 0
    }
    
    var targetArrivalTime: DateTime {
        tripModel.stopTimes[highligtedStopIndex].arrival
    }
    
    var body: some View {
        List {
            Section {
                ForEach(0..<tripModel.stopTimes.count, id: \.self) { index in
                    StopListItem(stopTime: tripModel.stopTimes[index],
                                 route: (tripModel.trip?.route)!,
                                 index: index,
                                 numberOfStops: tripModel.stopTimes.count,
                                 targetArrivalTime: targetArrivalTime,
                                 highlighted: index >= highligtedStopIndex
                    )
                }
            }
            if let trip = tripModel.trip {
                if trip.wheelchairAccessible == .available || trip.bikesAllowed == .allowed {
                    Section(header: Text("Accessabilities")) {
                        if (trip.wheelchairAccessible == .available) {
                            HStack(spacing: 12) {
                                Image(systemName: "accessibility").frame(width: 18, height: 18)
                                Text("Wheelchair accessible").font(.footnote)
                            }
                        }
                        if (trip.bikesAllowed == .allowed) {
                            HStack(spacing: 12) {
                                Image(systemName: "bicycle.circle").frame(width: 18, height: 18)
                                Text("Bicycle allowed").font(.footnote)
                            }
                        }
                        
                    }
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
        TripView(tripId: "C922453125", headsign: "Test", stopId: nil)
    }
}
