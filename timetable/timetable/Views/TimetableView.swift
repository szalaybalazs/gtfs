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
                            .padding(.horizontal, 8)
                    } else {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 4) {
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
            HStack(alignment: .center, spacing: 0) {
                Text("\(minuteFormatter.string(from: isoFormatter.date(from: event.arrival) ?? Date()))")
                    .underline(event.wheelchairAccessible == .available, color: Color.secondary)
                if let scheduled = event.scheduleRelationship {
                    Text("'")
                }
            }
                .fontWeight(.medium)
                .foregroundStyle(event.isPast ? Color.secondary : Color.black)
                .allowsTightening(true)
                .padding(.vertical, 3)
                .padding(.leading, 6)
                .padding(.trailing, 2)
                .monospaced()
                .background(event.isNext ? Color.gray.opacity(0.15) : nil)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        
    }
}

#Preview {
    List{
        TimetableView(routeId: "3560", stopId: "007975")
    }

}

//Text(route.shortName ?? "")
//    .padding(.vertical, 3)
//    .padding(.horizontal, 6)
//    .background(Color(hex: route.color ?? "#000000"))
//    .font(.system(size: 13, weight: .semibold))
//    .foregroundStyle(Color(hex: route.textColor ?? "#ffffff"))
//    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
