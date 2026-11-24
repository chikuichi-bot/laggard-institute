import CoreLocation
import Foundation
import Observation

/// 散歩中の GPS 軌跡（G3）。ナビの予定線は引かず、歩いた事実だけ残す。
/// 駅を切り替えても、前の駅の軌跡は端末に残す。
@MainActor
@Observable
final class WalkTrailRecorder: NSObject, CLLocationManagerDelegate {
    private(set) var coordinates: [CLLocationCoordinate2D] = []
    private(set) var isRecording = false

    private let manager = CLLocationManager()
    private var stationId: String = ""
    private var stationName: String = ""
    private var stationCenter: CLLocationCoordinate2D?
    private var maxRadiusMeters: Double = 2_500

    /// 直前点からこの距離未満は無視（ジッター抑制）。
    private let minStepMeters: Double = 10
    /// これより粗い測位は捨てる。
    private let maxAccuracyMeters: Double = 45

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        manager.distanceFilter = minStepMeters
        manager.activityType = .fitness
        manager.pausesLocationUpdatesAutomatically = true
    }

    /// 散歩道が開いているあいだ、駅の徒歩圏内の移動を記録する。
    func start(
        stationId: String,
        stationName: String,
        lat: Double,
        lng: Double,
        radiusKm: Double
    ) {
        guard !stationId.isEmpty || !stationName.isEmpty else { return }
        let nextKey = WalkTrailStore.storageKey(stationId: stationId, stationName: stationName)
        let currentKey = WalkTrailStore.storageKey(stationId: self.stationId, stationName: self.stationName)

        // 別駅へ移る／再開する前に、いまの軌跡を必ずディスクへ。
        persistCurrentIfNeeded()

        if isRecording, nextKey == currentKey, !currentKey.isEmpty {
            // 同じ駅のまま。中心・半径だけ更新。
            self.stationId = stationId
            self.stationName = stationName
            stationCenter = CLLocationCoordinate2D(latitude: lat, longitude: lng)
            maxRadiusMeters = max(radiusKm, 0.8) * 1_000 * 1.35
            resumeUpdatesIfAllowed()
            return
        }

        manager.stopUpdatingLocation()
        self.stationId = stationId
        self.stationName = stationName
        stationCenter = CLLocationCoordinate2D(latitude: lat, longitude: lng)
        maxRadiusMeters = max(radiusKm, 0.8) * 1_000 * 1.35
        coordinates = WalkTrailStore.load(stationId: stationId, stationName: stationName)
        isRecording = true
        resumeUpdatesIfAllowed()
    }

    func stop(save: Bool) {
        manager.stopUpdatingLocation()
        let wasRecording = isRecording
        isRecording = false
        if save, wasRecording || !coordinates.isEmpty {
            persistCurrentIfNeeded()
        }
    }

    func clearTrail() {
        coordinates = []
        WalkTrailStore.clear(stationId: stationId, stationName: stationName)
    }

    /// 地図表示用。2点未満なら線を出さない。
    var drawableCoordinates: [CLLocationCoordinate2D] {
        coordinates.count >= 2 ? coordinates : []
    }

    /// おおよそ歩いた距離（メートル）。
    var pathLengthMeters: Double {
        guard coordinates.count >= 2 else { return 0 }
        var total = 0.0
        for i in 1 ..< coordinates.count {
            total += Self.meters(coordinates[i - 1], coordinates[i])
        }
        return total
    }

    private func persistCurrentIfNeeded() {
        guard !coordinates.isEmpty else { return }
        guard !stationId.isEmpty || !stationName.isEmpty else { return }
        WalkTrailStore.save(
            stationId: stationId,
            stationName: stationName,
            coordinates: coordinates
        )
    }

    private func resumeUpdatesIfAllowed() {
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .denied, .restricted:
            isRecording = false
        default:
            manager.startUpdatingLocation()
        }
    }

    private func authorizationChanged(_ status: CLAuthorizationStatus) {
        guard isRecording else { return }
        switch status {
        case .authorizedAlways, .authorizedWhenInUse:
            manager.startUpdatingLocation()
        case .denied, .restricted:
            persistCurrentIfNeeded()
            isRecording = false
            manager.stopUpdatingLocation()
        default:
            break
        }
    }

    private func accept(_ location: CLLocation) {
        guard isRecording else { return }
        guard location.horizontalAccuracy >= 0,
              location.horizontalAccuracy <= maxAccuracyMeters
        else { return }
        if let center = stationCenter {
            let fromStation = location.distance(
                from: CLLocation(latitude: center.latitude, longitude: center.longitude)
            )
            guard fromStation <= maxRadiusMeters else { return }
        }
        let next = location.coordinate
        if let last = coordinates.last {
            let step = Self.meters(last, next)
            guard step >= minStepMeters else { return }
            // トンネル抜け等のジャンプは捨てる
            guard step <= 180 else { return }
        }
        coordinates.append(next)
        // 点が増えたらすぐ残す（別駅検索で消えないように）。
        persistCurrentIfNeeded()
    }

    private static func meters(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        CLLocation(latitude: a.latitude, longitude: a.longitude)
            .distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude))
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in self.authorizationChanged(status) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        Task { @MainActor in self.accept(location) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if let cl = error as? CLError, cl.code == .denied {
            Task { @MainActor in
                self.persistCurrentIfNeeded()
                self.isRecording = false
                self.manager.stopUpdatingLocation()
            }
        }
    }
}
