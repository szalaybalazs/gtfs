import SwiftUI
import TimetableAPI
import Flow

// Separate view for hour row to improve performance
struct HourRowView: View {
    let hourData: HourEvents
    @Binding var selectedEvent: TimetableQuery.Data.Timetable?
    
    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            Text(hourData.hour)
                .font(.callout)
                .frame(width: 24)
                .foregroundColor(.secondary)
                .fontWeight(.semibold)
            
            if hourData.events.isEmpty {
                Text("No events")
                    .foregroundStyle(.secondary)
                    .font(.caption)
                    .padding(.horizontal, 8)
            } else {
                HFlow(itemSpacing: 4, rowSpacing: 4) {
                    ForEach(hourData.events) { event in
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

struct TimestampView: View {
    let event: ProcessedTimetableEvent
    @Binding var selectedEvent: TimetableQuery.Data.Timetable?
    
    var body: some View {
        Button(action: {
            selectedEvent = event.originalEvent
        }) {
            HStack(alignment: .center, spacing: 0) {
                Text(event.minute)
                    .underline(event.wheelchairAccessible, color: Color.secondary)
                if event.hasScheduleRelationship {
                    Text("'")
                }
            }
            .fontWeight(.medium)
            .foregroundStyle(event.isPast ? Color.secondary : Color.primary)
            .allowsTightening(true)
            .padding(.vertical, 3)
            .padding(.leading, 6)
            .padding(.trailing, event.hasScheduleRelationship ? 2 : 6)
            .monospaced()
            .background(event.isNext ? Color.gray.opacity(0.15) : nil)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .fixedSize(horizontal: true, vertical: true)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

struct TimetableView: View {
    let stopId: String
    @StateObject var viewModel: TimetableViewModel
    @Binding public var selectedEvent: TimetableQuery.Data.Timetable?
    @Binding public var showHistoric: Bool
    
    init(routeId: String, stopId: String, selectedEvent: Binding<TimetableQuery.Data.Timetable?>, showHistoric: Binding<Bool>) {
        print("INITTT")
        self.stopId = stopId
        _selectedEvent = selectedEvent
        _showHistoric = showHistoric
        _viewModel = StateObject(wrappedValue: TimetableViewModel(routeId: routeId, stopId: stopId))
    }
    
    private func filterHourEvents(_ date: DateEvents) -> [HourEvents] {
       let calendar = Calendar.current
        let now = Foundation.Date()
       let currentHour = calendar.component(.hour, from: now)
       let isToday = calendar.isDate(date.date, inSameDayAs: now)
       
       return date.events.filter { hourEvent in
           let hour = Int(hourEvent.hour) ?? 0
           
           if isToday {
               if showHistoric {
                   return true
               } else {
                   // For current hour, show if it has any events
                   if hour == currentHour {
                       return !hourEvent.events.isEmpty
                   }
                   // For other hours, only show future hours
                   return hour >= currentHour
               }
           } else {
               // Show all hours for future dates
               return true
           }
       }
   }
   
    var filteredDates: [DateEvents] {
        viewModel.dates.map { date in
            DateEvents(
                id: date.id,
                date: date.date,
                dateString: date.dateString,
                events: filterHourEvents(date)
            )
        }
        .filter { !$0.events.isEmpty } // Filter out dates with no events after filtering
    }


    
    var body: some View {
        ForEach(filteredDates, id: \.id) { date in
            Section(header: Text(date.dateString)) {
                ForEach(date.events) { hourData in
                    HourRowView(hourData: hourData, selectedEvent: $selectedEvent)
                }
            }
        }
        .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 0))
        .onAppear {
            viewModel.fetchTimetable()
        }
        .onChange(of: stopId) { newStopId in
            viewModel.updateStopId(newStopId)
        }
    }
}

#Preview {
    List{
        TimetableView(routeId: "3560", stopId: "007975", selectedEvent: .constant(nil), showHistoric: .constant(false))
    }
}
