//
//  TripView.swift
//  timetable
//
//  Created by Balázs Szalay on 2025. 02. 10..
//

import SwiftUI

struct TripView: View {
    public let tripId: String
    @StateObject private var tripModel: TripViewModel
    
    init(tripId: String) {
        self.tripId = tripId
        
        _tripModel = StateObject(wrappedValue: TripViewModel(tripId: tripId))
    }
    
    var body: some View {
        List {
            Section(header: Text("Stations")) {
                ForEach(0..<tripModel.stopTimes.count, id: \.self) { index in
                    NavigationLink(destination: Text("STOP")) {
                        GeometryReader { geometry in
                            HStack(spacing: 8) {
                                let height = geometry.size.height
                                let isEnd = index == tripModel.stopTimes.count - 1 || index == 0
//                                let color = Color(hex: tripModel.trip!.color!)
                                let color = Color(hex: tripModel.trip!.route!.color!)
                                ZStack(alignment: .center) {
                                    Rectangle()
                                        .fill(color)
                                        .frame(width: 4)
                                        .frame(height: isEnd ? height / 2 : height)
                                        .offset(y: index == 0 ? height / 4 : index == tripModel.stopTimes.count - 1 ? -height / 4 : 0)
                                    Circle()
                                        .stroke(color, lineWidth: 8)
                                        .fill(Color(uiColor: .systemBackground))
                                        .frame(width: 8, height: 8)
                                }
                                .frame(width: 20, height: height)
                                
                                // Stop information
                                HStack {
                                    let stopTime = tripModel.stopTimes[index]
                                    let stopTimeDelta = {
                                        let formatter = ISO8601DateFormatter()
                                        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                                        
                                        guard let arrivalTime = formatter.date(from: stopTime.arrival) else {
                                            return "-"
                                        }
                                        let diffInMinutes = Int(ceil(arrivalTime.timeIntervalSinceNow / 60))
                                        return "\(diffInMinutes)"
                                    }()
                                    Text(stopTime.stop?.name ?? "-")
                                    Spacer()
                                    Text(stopTimeDelta)
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
        TripView(tripId: "C922453125")
    }
}
