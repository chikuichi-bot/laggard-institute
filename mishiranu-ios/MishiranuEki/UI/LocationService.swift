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
        // 粗い精度指定は屋内で locationUnknown を増やしやすい。
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        manager.distanceFilter = kCLDistanceFilterNone
    }

    /// - Parameter preferFresh: 「この駅について」用。隣駅へ移った直後でも古いキャッシュで確定しない。
    func requestOnce(timeout: TimeInterval = 25, preferFresh: Bool = false) async throws -> CLLocation {
        // 前回が残っていたら捨ててやり直す（ボタン連打・失敗直後の再試行用）。
        if continuation != nil {
            finish(.failure(LocateFailure.unknown))
        }

        // 地図の現在地ボタンなど: ごく新しい位置だけ再利用。駅確定ボタンは常に取り直す。
        if !preferFresh,
           let cached = manager.location,
           cached.horizontalAccuracy > 0,
           cached.horizontalAccuracy <= 500,
           abs(cached.timestamp.timeIntervalSinceNow) < 20
        {
            return cached
        }

        return try await withCheckedThrowingContinuation { cont in
            continuation = cont
            timeoutTask = Task { [weak self] in
                try? await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
                guard !Task.isCancelled else { return }
                await MainActor.run {
                    self?.manager.stopUpdatingLocation()
                    self?.finish(.failure(LocateFailure.timeout))
                }
            }
            switch manager.authorizationStatus {
            case .notDetermined:
                manager.requestWhenInUseAuthorization()
            case .denied, .restricted:
                finish(.failure(LocateFailure.denied))
            default:
                startFix()
            }
        }
    }

    /// 進行中の取得を止める（画面離脱・キャンセル用）。
    func cancel() {
        manager.stopUpdatingLocation()
        finish(.failure(LocateFailure.unknown))
    }

    private func startFix() {
        // requestLocation と併用すると locationUnknown が連続し、早期失敗しやすい。
        // 追従だけにして、最初の妥当な座標で止める。
        // 駅の取り違えを減らすため、測位中は十メートル級を狙う。
        manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        manager.startUpdatingLocation()
    }

    private func restoreDefaultAccuracy() {
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    private func finish(_ result: Result<CLLocation, Error>) {
        timeoutTask?.cancel()
        timeoutTask = nil
        manager.stopUpdatingLocation()
        restoreDefaultAccuracy()
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
            startFix()
        }
    }

    private func acceptIfUsable(_ location: CLLocation) {
        // 無効な測位は無視して待ち続ける（タイムアウトが最終判定）。
        guard location.horizontalAccuracy >= 0 else { return }
        // 極端に粗い（>5km）は捨てる。数百〜数千mは駅探しに使える。
        guard location.horizontalAccuracy <= 5_000 else { return }
        finish(.success(location))
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in self.authorizationChanged(status) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        Task { @MainActor in self.acceptIfUsable(location) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            guard self.continuation != nil else { return }
            if let clError = error as? CLError {
                switch clError.code {
                case .denied:
                    self.finish(.failure(LocateFailure.denied))
                case .locationUnknown, .network:
                    // 測位中の一時エラー。追従を続け、タイムアウトまで待つ。
                    return
                default:
                    // その他も即死させず待つ（稀なコードで使える位置が後から来ることがある）。
                    return
                }
            }
        }
    }
}
