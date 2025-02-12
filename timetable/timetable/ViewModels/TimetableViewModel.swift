//
//  RoutesViewModel.swift
//  timetable
//
//  Created by Balázs Szalay on 2025. 02. 09..
//

import Foundation
import Combine
import Apollo
import TimetableAPI

// New struct to hold date information and its events
struct DateEvents: Identifiable {
    let id: String // date string as ID
    let date: Foundation.Date
    let dateString: String
    let events: [HourEvents]
}

struct HourEvents: Identifiable {
    let id: Int // hour
    let date: Foundation.Date
    let hour: String
    let events: [ProcessedTimetableEvent]
}

struct ProcessedTimetableEvent: Identifiable, Hashable {
    let id: String
    let minute: String
    let isPast: Bool
    let isNext: Bool
    let wheelchairAccessible: Bool
    let hasScheduleRelationship: Bool
    let originalEvent: TimetableQuery.Data.Timetable
    
    static func == (lhs: ProcessedTimetableEvent, rhs: ProcessedTimetableEvent) -> Bool {
        lhs.id == rhs.id
    }
    
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}



class TimetableViewModel: ObservableObject {
    // Add a flag to track if initial load has happened
    private var hasInitialLoad = false

    var routeId: TimetableAPI.ID
    var stopId: TimetableAPI.ID
    
    @Published var isLoading: Bool = false
    @Published var activeRequest: Apollo.Cancellable?
    
    @Published var processedHours: [HourEvents] = []
    @Published var dates: [DateEvents] = []
    @Published var entries = [TimetableQuery.Data.Timetable]()

    
    init(routeId: TimetableAPI.ID, stopId: TimetableAPI.ID) {
        self.routeId = routeId
        self.stopId = stopId
    }

    private var cancellables = Set<AnyCancellable>()
    
    private static let isoFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()
    
    private static let minuteFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "mm"
        return formatter
    }()
    
    func updateRouteId(_ newId: String) {
        routeId = newId
        fetchTimetable()
    }
    
    func updateStopId(_ newId: String) {
        stopId = newId
        fetchTimetable()
    }

    func fetchTimetable(forceRefresh: Bool = false) {
        // Only proceed if it's the first load or we're forcing a refresh
        guard !hasInitialLoad || forceRefresh else { return }
        
        // Cancel any existing request
        activeRequest?.cancel()
        
        // Clear existing data
        self.processedHours = []
        self.isLoading = true
        
        self.activeRequest = Network.shared.apollo.fetch(query: TimetableQuery(stopId: stopId, routeId: routeId, range: .null)) { [weak self] result in
            guard let self = self else { return }
            
            self.isLoading = false
            self.hasInitialLoad = true
            
            switch result {
            case .success(let graphQLResult):
                if let timetableConnection = graphQLResult.data?.timetable {
                    self.entries = timetableConnection
                    self.processEntries()
                }
                
                if let errors = graphQLResult.errors {
                    print("GraphQL errors: \(errors)")
                }
            case .failure(let error):
                print("Failure! Error: \(error)")
            }
        }
    }
    
    private func processEntries() {
        Task {
            // Create a dictionary to store unique events by date and hour
            var hourEvents: [String: Set<ProcessedTimetableEvent>] = [:]
            var uniqueDates = Set<Foundation.Date>() // Store unique dates
            let calendar = Calendar.current
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "yyyy-MM-dd-HH"
            
            let displayDateFormatter = DateFormatter()
            displayDateFormatter.dateFormat = "yyyy-MM-dd"
            
            let now = Foundation.Date()
            let today = calendar.startOfDay(for: now)
            let yesterday = calendar.date(byAdding: .day, value: -1, to: today)!
            let tomorrow = calendar.date(byAdding: .day, value: 1, to: today)!
            
            // First pass: collect all events and dates
            for entry in entries {
                guard let date = Self.isoFormatter.date(from: entry.arrival) else { continue }
                let startOfDay = calendar.startOfDay(for: date)

                // Only include today and tomorrow
                if calendar.isDate(startOfDay, inSameDayAs: today)
                    || calendar.isDate(startOfDay, inSameDayAs: tomorrow)
                    || calendar.isDate(startOfDay, inSameDayAs: yesterday){
                    
                    // Store the start of day
                    uniqueDates.insert(calendar.startOfDay(for: date))
                    
                    let hourKey = dateFormatter.string(from: date)
                    let minute = Self.minuteFormatter.string(from: date)
                    
                    let processedEvent = ProcessedTimetableEvent(
                        id: entry.tripId,
                        minute: minute,
                        isPast: entry.isPast,
                        isNext: entry.isNext,
                        wheelchairAccessible: entry.wheelchairAccessible == .available,
                        hasScheduleRelationship: entry.scheduleRelationship != nil,
                        originalEvent: entry
                    )
                    
                    // Use a Set to ensure uniqueness
                    hourEvents[hourKey, default: Set()].insert(processedEvent)
                }
            }
            
            // Process each date
            let dateEvents = uniqueDates.map { startOfDay -> DateEvents in
                var hoursForDate: [HourEvents] = []
                
                // Create entries for all 24 hours
                for hour in 0..<24 {
                    // Create date with the current hour
                    var components = calendar.dateComponents([.year, .month, .day], from: startOfDay)
                    components.hour = hour
                    let dateWithHour = calendar.date(from: components)!
                    
                    // Create the hour key
                    let hourKey = dateFormatter.string(from: dateWithHour)
                    
                    // Create HourEvents with existing events or empty array
                    let hourEvent = HourEvents(
                        id: hour,
                        date: dateWithHour,
                        hour: String(format: "%02d", hour),
                        events: Array(hourEvents[hourKey, default: Set()])
                            .sorted { $0.minute < $1.minute }
                    )
                    
                    hoursForDate.append(hourEvent)
                }
                
                // Create named date string
                let namedDateString: String
                if calendar.isDate(startOfDay, inSameDayAs: yesterday) {
                    namedDateString = "Yesterday"
                } else if calendar.isDate(startOfDay, inSameDayAs: today) {
                    namedDateString = "Today"
                } else if calendar.isDate(startOfDay, inSameDayAs: tomorrow) {
                    namedDateString = "Tomorrow"
                } else {
                    // For other dates, use the regular date string
                    namedDateString = displayDateFormatter.string(from: startOfDay)
                }

                
                return DateEvents(
                    id: displayDateFormatter.string(from: startOfDay),
                    date: startOfDay,
                    dateString: namedDateString,
                    events: hoursForDate.sorted { $0.hour < $1.hour }
                )
            }
            .sorted { $0.date < $1.date }
            
            // Create full processed hours array
            let allProcessedHours = dateEvents.flatMap { $0.events }
            
            print("Processed events: \(dateEvents.count) \(allProcessedHours.count)")
            
            await MainActor.run {
                self.processedHours = allProcessedHours
                self.dates = dateEvents
            }
        }
    }

}
