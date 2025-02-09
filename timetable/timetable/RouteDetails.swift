//
//  RouteDetails.swift
//  timetable
//
//  Created by Balázs Szalay on 2025. 02. 08..
//

import SwiftUI



struct RouteDetails: View {
    public let id: String
    public let shortName: String?
    @State private var selectedStop: String = "test"
    
    var body: some View {
        VStack {
            List {
                

                
                Section {
                    Picker("Stop", selection: $selectedStop) {
                        Text("test").tag("test")
                        Text("test2").tag("test2")
                    }
                    Picker("Direction", selection: $selectedStop) {
                        Text("test").tag("test")
                        Text("test2").tag("test2")
                    }
                }
                Section {
                    Picker("Direction", selection: $selectedStop) {
                        Text("test").tag("test")
                        Text("test2").tag("test2")
                    }
                }
            }.listSectionSpacing(.compact)
                .navigationBarItems(
                    trailing:
                        Button("Add 1") {
                            
                        }
                )
                
            
           
        }.navigationTitle(shortName ?? id)
        
    }
}

#Preview {
    RouteDetails(id: "3560", shortName: "56")
}
