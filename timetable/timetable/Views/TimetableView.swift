//
//  Timetable.swift
//  timetable
//
//  Created by Balázs Szalay on 2025. 02. 09..
//

import SwiftUI

struct Timetable: View {
    public let routeId: String
    public let stopId: String
    
    @StateObject var timetableModel: TimetableViewModel
    
    init(routeId: String, stopId: String) {
        self.routeId = routeId
        self.stopId = stopId
        _timetableModel = StateObject(wrappedValue: TimetableViewModel(routeId: routeId, stopId: stopId))
    }
    var body: some View {
        HStack {
            Text("Entries found: \(timetableModel.entries.count)")
        }
            .onAppear {
                timetableModel.fetchTimetable()
            }
    }
}

#Preview {
    Timetable(routeId: "3560", stopId: "007975")
}
