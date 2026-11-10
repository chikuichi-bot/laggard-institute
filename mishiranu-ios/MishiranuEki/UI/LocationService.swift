import CoreLocation

/// 1回だけ現在地を取る。座標は端末の中で最寄り駅を探すのにだけ使う。
@MainActor
final class LocationService: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<CLLocation, Error>?
    private var timeoutTask: Task<Void, Never>?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    func requestOnce(timeout: TimeInterval = 15) async throws -> CLLocation {
        if continuation != nil { throw LocateFailure.unknown }
        return try await withCheckedThrowingContinuation { cont in
            continuation = cont
            timeoutTask = Task { [weak self] in
                try? await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
                guard !Task.isCancelled else { return }
                self?.finish(.failure(LocateFailure.timeout))
            }
            switch manager.authorizationStatus {
            case .notDetermined:
                manager.requestWhenInUseAuthorization()
            case .denied, .restricted:
                finish(.failure(LocateFailure.denied))
            default:
                manager.requestLocation()
            }
        }
    }

    private func finish(_ result: Result<CLLocation, Error>) {
        timeoutTask?.cancel()
        timeoutTask = nil
        guard let cont = continuation else { return }
        continuation = nil
        cont.resume(with: result)
    }

    private func authorizationChanged(_ status: CLAuthorizationStatus) {
        guard continuation != nil else { return }
        switch status {
        case .notDetermined:
            break
        case .denied, .restricted:
            finish(.failure(LocateFailure.denied))
        default:
            manager.requestLocation()
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in self.authorizationChanged(status) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        Task { @MainActor in self.finish(.success(location)) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        let failure: LocateFailure
        if let clError = error as? CLError {
            switch clError.code {
            case .denied: failure = .denied
            case .locationUnknown, .network: failure = .unavailable
            default: failure = .unknown
            }
        } else {
            failure = .unknown
        }
        Task { @MainActor in self.finish(.failure(failure)) }
    }
}
