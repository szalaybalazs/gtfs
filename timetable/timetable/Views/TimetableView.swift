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

struct TimeEntry: Identifiable {
    let id: Int
    let hour: Int
    let date: Foundation.Date
    
    var hourTime: Foundation.Date {
        Calendar.current.date(byAdding: .hour, value: hour, to: Date())!
    }
}

struct IntrinsicHeightTable: UIViewRepresentable {
    let timeEntries: [TimeEntry]
    let groupedEntries: [Foundation.Date: [TimetableQuery.Data.Timetable]]
    let hourFormatter: DateFormatter
    
    func makeUIView(context: Context) -> UITableView {
        let tableView = UITableView(frame: .zero, style: .insetGrouped)
        tableView.delegate = context.coordinator
        tableView.dataSource = context.coordinator
        tableView.isScrollEnabled = false
        tableView.backgroundColor = .clear
        tableView.separatorStyle = .singleLine
        tableView.separatorInset = .zero
        return tableView
    }
    
    func updateUIView(_ tableView: UITableView, context: Context) {
        context.coordinator.timeEntries = timeEntries
        context.coordinator.groupedEntries = groupedEntries
        tableView.reloadData()
        
        tableView.layoutIfNeeded()
        let height = tableView.contentSize.height
        tableView.frame = CGRect(x: 0, y: 0, width: tableView.frame.width, height: height)
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, UITableViewDelegate, UITableViewDataSource {
        var parent: IntrinsicHeightTable
        var timeEntries: [TimeEntry]
        var groupedEntries: [Foundation.Date: [TimetableQuery.Data.Timetable]]
        private var hostingControllers: [IndexPath: UIHostingController<TimeEntryRowView>] = [:]
        
        init(_ parent: IntrinsicHeightTable) {
            self.parent = parent
            self.timeEntries = parent.timeEntries
            self.groupedEntries = parent.groupedEntries
        }
        
        func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
            return timeEntries.count
        }
        
        func tableView(_ tableView: UITableView, heightForRowAt indexPath: IndexPath) -> CGFloat {
            return UITableView.automaticDimension
        }
        
        func tableView(_ tableView: UITableView, minimumHeightForRowAt indexPath: IndexPath) -> CGFloat {
            return 32
        }
        
        func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
            let cell = UITableViewCell(style: .default, reuseIdentifier: nil)
            cell.backgroundColor = .clear
            cell.contentView.backgroundColor = .clear
            cell.selectionStyle = .none
            
            let entry = timeEntries[indexPath.row]
            let key = Calendar.current.date(from:
                Calendar.current.dateComponents([.year, .month, .day, .hour], from: entry.hourTime)
            ) ?? entry.hourTime
            
            let events = groupedEntries[key] ?? []
            
            // Remove old hosting controller
            if let oldController = hostingControllers[indexPath] {
                oldController.view.removeFromSuperview()
                hostingControllers[indexPath] = nil
            }
            
            let hostingController = UIHostingController(rootView:
                TimeEntryRowView(entry: entry, events: events, hourFormatter: parent.hourFormatter)
            )
            
            hostingControllers[indexPath] = hostingController
            
            hostingController.view.backgroundColor = .clear
            
            cell.contentView.subviews.forEach { $0.removeFromSuperview() }
            cell.contentView.addSubview(hostingController.view)
            
            hostingController.view.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                hostingController.view.topAnchor.constraint(equalTo: cell.contentView.topAnchor),
                hostingController.view.bottomAnchor.constraint(equalTo: cell.contentView.bottomAnchor),
                hostingController.view.leadingAnchor.constraint(equalTo: cell.contentView.leadingAnchor),
                hostingController.view.trailingAnchor.constraint(equalTo: cell.contentView.trailingAnchor)
            ])
            
            return cell
        }
    }
}

struct TimeEntryRowView: View {
    let entry: TimeEntry
    let events: [TimetableQuery.Data.Timetable]
    let hourFormatter: DateFormatter
    
    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            Text(entry.hourTime, formatter: hourFormatter)
                .font(.callout)
                .frame(width: 24)
                .foregroundColor(.secondary)
                .fontWeight(.semibold)
                .padding(.leading, 8)
            
            if events.isEmpty {
                Text("No events")
                    .foregroundStyle(.secondary)
                    .font(.caption)
                    .padding(.horizontal, 8)
            } else {
                HFlow(itemSpacing: 4, rowSpacing: 4) {
                    ForEach(events, id: \.self) { event in
                        TimestampView(event: event)
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 32, alignment: .leading)
    }
}




// Modified TimetableView
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
        let timeEntries = (0..<24).map { hour in
            TimeEntry(id: hour, hour: hour, date: Calendar.current.date(byAdding: .hour, value: hour, to: Date())!)
        }
        
        IntrinsicHeightTable(
            timeEntries: timeEntries,
            groupedEntries: groupedEntries,
            hourFormatter: hourFormatter
        )
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
        NavigationLink(destination: Text("ALMA")) {
            HStack(alignment: .center, spacing: 0) {
                Text(minute).underline(event.wheelchairAccessible == .available, color: Color.secondary)
                if event.scheduleRelationship != nil {
                    Text("'")
                }
            }
        }
            .buttonStyle(PlainButtonStyle())
            .fontWeight(.medium)
            .allowsTightening(true)
            .padding(.vertical, 3)
            .padding(.leading, 6)
            .padding(.trailing, event.scheduleRelationship != nil ? 2 : 6)
            .monospaced()
            .background(event.isNext ? Color.gray.opacity(0.15) : nil)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .fixedSize(horizontal: true, vertical: true)
            // Force true black color
            .foregroundColor(event.isPast ? .secondary : .black)



    }
}

#Preview {
    NavigationView {
        TimetableView(routeId: "3560", stopId: "007975")
    }
}
