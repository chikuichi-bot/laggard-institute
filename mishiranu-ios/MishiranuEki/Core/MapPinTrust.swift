import Foundation

/// 地図にピンを出してよいかのハードルール。
/// 文章・案内には未確定も出せるが、地図の座標は lock / Apple のみ。
/// Apple は駅中心から徒歩圏内だけ（飛び地・同名店を落とす）。
enum MapPinTrust {
    /// 通常の Apple ピン上限（駅から）。
    static let appleMapMaxKm = 1.5
    /// 半日の「徒歩圏の外」1件（`reach-`）だけ少し広げる。
    static let reachMapMaxKm = 2.4

    static func allowsOnMap(_ spot: Spot, stationName: String, stationLat: Double, stationLng: Double) -> Bool {
        // 他駅に出町の顔・出町ピンが混ざったら地図に出さない
        if DemachiTemplate.isForeignDemachiPlace(spot.name, stationName: stationName) {
            return false
        }
        if !DemachiTemplate.isDemachiStationName(stationName),
           DemachiTemplate.isOnDemachiPin(lat: spot.lat, lng: spot.lng) {
            return false
        }
        if LandmarkRegistry.isLocked(spot, stationName: stationName) { return true }
        switch spot.coordTrust {
        case .lock:
            return true
        case .apple:
            let km = Geo.haversineKm(
                lat1: stationLat, lng1: stationLng,
                lat2: spot.lat, lng2: spot.lng
            )
            if spot.id.hasPrefix("reach-") {
                return km <= reachMapMaxKm
            }
            return km <= appleMapMaxKm
        case .unverified:
            return false
        }
    }

    static func allowsOnMap(_ spot: Spot, in station: Station) -> Bool {
        allowsOnMap(
            spot,
            stationName: station.name,
            stationLat: station.lat,
            stationLng: station.lng
        )
    }

    static func mapSpots(from spots: [Spot], station: Station) -> [Spot] {
        spots.filter { allowsOnMap($0, in: station) }
    }
}
