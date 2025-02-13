//
//  RouteBanner.swift
//  timetable
//
//  Created by Balázs Szalay on 2025. 02. 10..
//

import SwiftUI

struct RouteBanner: View {
    public let name: String
    public let color: String?
    public let textColor: String?
    
    var body: some View {
        HStack(alignment: .center) {
            Text(name)
                .padding(.vertical, 3)
                .padding(.horizontal, 6)
                .background(Color(hex: color ?? "#000000"))
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color(hex: textColor ?? "#ffffff"))
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
    }
}

#Preview {
    RouteBanner(name: "56", color: "#FF0000", textColor: "#FFFFFF")
}
