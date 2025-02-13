//
//  LocationManager.swift
//  timetable
//
//  Created by Balázs Szalay on 2025. 02. 09..
//

import Foundation
import CoreLocation

class LocationManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var lastKnownLocation: CLLocationCoordinate2D?
    @Published var locationError: String?
    
    private let manager = CLLocationManager()
    private var locationRequestCompletion: ((CLLocationCoordinate2D?) -> Void)?
    
    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
    }
    
    func requestOneTimeLocation(completion: @escaping (CLLocationCoordinate2D?) -> Void) {
        // Store the completion handler
        locationRequestCompletion = completion
        
        // Check current authorization status
        switch manager.authorizationStatus {
        case .notDetermined:
            // Request permission if not determined
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            // Request a single location update
            manager.requestLocation()
        case .denied, .restricted:
            // Handle denied or restricted access
            locationError = "Location access is not allowed"
            completion(nil)
        @unknown default:
            locationError = "Unknown location access status"
            completion(nil)
        }
    }
    
    // CLLocationManagerDelegate methods
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        // If authorization just became authorized, request location
        if manager.authorizationStatus == .authorizedWhenInUse ||
           manager.authorizationStatus == .authorizedAlways {
            manager.requestLocation()
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        if let location = locations.first {
            lastKnownLocation = location.coordinate
            locationRequestCompletion?(location.coordinate)
            // Clear the completion handler after use
            locationRequestCompletion = nil
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        locationError = error.localizedDescription
        locationRequestCompletion?(nil)
        // Clear the completion handler after use
        locationRequestCompletion = nil
    }
}
