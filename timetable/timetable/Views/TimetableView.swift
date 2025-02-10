//
//  Timetable.swift
//  timetable
//
//  Created by Balázs Szalay on 2025. 02. 09..
//

import SwiftUI
import TimetableAPI
import Foundation
import Flow

struct IdentifiableEvent: Identifiable {
    let id = UUID()
    let event: TimetableQuery.Data.Timetable
}

struct TimetableView: View {
    public let routeId: String
    public let stopId: String
    
    @StateObject var timetableModel: TimetableViewModel
    @Binding var selectedEvent: TimetableQuery.Data.Timetable?
    
    init(routeId: String, stopId: String, selectedEvent: Binding<TimetableQuery.Data.Timetable?>) {
        self.routeId = routeId
        self.stopId = stopId
        _selectedEvent = selectedEvent // Use _selectedEvent to initialize the binding

        
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
        let grouped = Dictionary(grouping: timetableModel.entries) { entry in
            guard let date = isoFormatter.date(from: entry.arrival) else {
                return Foundation.Date()
            }
            
            let key = Calendar.current.date(from:
                Calendar.current.dateComponents([.year, .month, .day, .hour], from: date)
            ) ?? date
            
            return key
        }
        
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
                        HFlow(itemSpacing: 4, rowSpacing: 4) {
                            ForEach(events, id: \.self) { event in
                                TimestampView(event: event, selectedEvent: $selectedEvent)
                            }
                        }
                        .padding(.vertical, 8)
                        .padding(.trailing, 16)
                        
                        
                    }
                }
                .font(.callout)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 0))
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
    @Binding var selectedEvent: TimetableQuery.Data.Timetable?
    @State private var isPressed = false  // Add this state
    @Environment(\.navigationPath) private var path
    
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
        let minute = minuteFormatter.string(from: isoFormatter.date(from: event.arrival) ?? Date())
        Button(action: {
            print("TIMESTAMP \(minute)")
            print("Trip id: \(event.tripId)")
            selectedEvent = event
            
        }) {
            HStack(alignment: .center, spacing: 0) {
                Text(minute).underline(event.wheelchairAccessible == .available, color: Color.secondary)
                if event.scheduleRelationship != nil {
                    Text("'")
                }
            }
                .fontWeight(.medium)
                .foregroundStyle(event.isPast ? Color.secondary : Color.primary)
                .allowsTightening(true)
                .padding(.vertical, 3)
                .padding(.leading, 6)
                .padding(.trailing, event.scheduleRelationship != nil ? 2 : 6)
                .monospaced()
                .background(event.isNext ? Color.gray.opacity(0.15) : nil)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .fixedSize(horizontal: true, vertical: true)
                .buttonStyle(PlainButtonStyle())
        }
        .buttonStyle(PlainButtonStyle())
    }
}

#Preview {
    List{
        TimetableView(routeId: "3560", stopId: "007975", selectedEvent: .constant(nil))
    }
}
