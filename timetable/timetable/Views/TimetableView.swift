//
//  Timetable.swift
//  timetable
//
//  Created by Balázs Szalay on 2025. 02. 09..
//

import SwiftUI
import TimetableAPI
import Foundation

struct TimetableView: View {
    public let routeId: String
    public let stopId: String
    
    @StateObject var timetableModel: TimetableViewModel
    
    init(routeId: String, stopId: String) {
        self.routeId = routeId
        self.stopId = stopId
        
        print("route id: \(routeId), stopid: \(stopId)")
        _timetableModel = StateObject(wrappedValue: TimetableViewModel(routeId: routeId, stopId: stopId))
    }
    
    private let isoFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"  // Note the added .SSS for milliseconds
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()

    private let hourFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH"
        return formatter
    }()
    
  
    
    var groupedEntries: [Foundation.Date: [TimetableQuery.Data.Timetable]] {
//        print("Total entries: \(timetableModel.entries.count)")
        
        let grouped = Dictionary(grouping: timetableModel.entries) { entry in
            // Verbose logging
//            print("Raw arrival string: \(entry.arrival)")
            
            guard let date = isoFormatter.date(from: entry.arrival) else {
//                print("Failed to parse date: \(entry.arrival)")
                return Foundation.Date()
            }
            
            let key = Calendar.current.date(from:
                Calendar.current.dateComponents([.year, .month, .day, .hour], from: date)
            ) ?? date
            
//            print("Parsed date: \(date), Rounded key: \(key)")
            return key
        }
        
//        print("Grouped entries count: \(grouped.count)")
        return grouped
    }

    var body: some View {
        Section(header: Text("Timetable")) {
            ForEach(0..<24, id: \.self) { offset in
                let hourTime = Calendar.current.date(byAdding: .hour, value: offset, to: Date())!
                let key = Calendar.current.date(from:
                    Calendar.current.dateComponents([.year, .month, .day, .hour], from: hourTime)
                ) ?? hourTime
                
                let events = self.groupedEntries[key] ?? []
                
                
                HStack(alignment: .center, spacing: 8) {
                    Text(hourTime, formatter: hourFormatter).font(.callout).frame(width: 24)
                        .foregroundColor(.secondary)
                        .fontWeight(.semibold)
                    if events.isEmpty {
                        Text("No events")
                            .foregroundStyle(.secondary)
                            .font(.caption)
                    } else {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack {
                                ForEach(events, id: \.self) { event in
                                    TimestampView(event: event)
                                }
                            }.padding(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 16))
                        }
                        

                    }
                }
                    .font(.callout)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }.listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 0))
        }
        .listStyle(.plain)
        .onAppear {
            timetableModel.fetchTimetable()
        }
        .onChange(of: stopId) {
            timetableModel.stopId = $0
            timetableModel.fetchTimetable()
        }
        .onChange(of: routeId) {
            timetableModel.routeId = $0
            timetableModel.fetchTimetable()
        }
    }
}

struct TimestampView: View {
    public let event: TimetableQuery.Data.Timetable
    
    private let isoFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"  // Note the added .SSS for milliseconds
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()
    
    // Add this formatter to extract just the minutes
    private let minuteFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "mm"
        return formatter
    }()
    
    var body: some View {
        NavigationLink(destination: Text("TRIP")) {
            Text(minuteFormatter.string(from: isoFormatter.date(from: event.arrival) ?? Date()))
                .fontWeight(.medium)
                .foregroundStyle(.black)
                .underline(event.wheelchairAccessible == .available)
                .allowsTightening(true)
        }
        
    }
}

#Preview {
    List{
        TimetableView(routeId: "3560", stopId: "007975")
    }

}
