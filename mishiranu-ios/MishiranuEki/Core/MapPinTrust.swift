import Foundation

/// 地図にピンを出してよいかのハードルール。
/// 文章・案内には未確定も出せるが、地図の座標は lock / Apple のみ。
enum MapPinTrust {
    static func allowsOnMap(_ spot: Spot, stationName: String) -> Bool {
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
        case .lock, .apple: return true
        case .unverified: return false
        }
    }

    static func mapSpots(from spots: [Spot], stationName: String) -> [Spot] {
        spots.filter { allowsOnMap($0, stationName: stationName) }
    }
}
