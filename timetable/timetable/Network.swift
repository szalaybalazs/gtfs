//
//  Network.swift
//  timetable
//
//  Created by Balázs Szalay on 2025. 02. 08..
//

import Foundation
import Apollo

class Network {
  static let shared = Network()

  private(set) lazy var apollo = ApolloClient(url: URL(string: "http://192.168.68.69:4000")!)
}
