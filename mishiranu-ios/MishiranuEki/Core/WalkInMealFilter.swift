import Foundation

/// 歩いて入れるご飯屋さんではないもの（配食・宅食の事業所など）を落とす。
/// 実地 2026-11-12: ライフデリ京田辺・八幡店は高齢者配食で店内飲食不可。
enum WalkInMealFilter {
    private static let brands = [
        "ライフデリ",
        "LIFE DELI",
        "ワタミの宅食",
        "まごころ弁当",
        "おまかせさん",
        "ベネッセのお弁当",
        "コスモス配食",
    ]

    private static let markers = [
        "配食",
        "宅食",
        "宅配弁当",
        "高齢者配食",
        "配食サービス",
        "訪問弁当",
    ]

    static func isNonWalkIn(name: String, blurb: String = "", detail: String? = nil) -> Bool {
        let blob = "\(name)\n\(blurb)\n\(detail ?? "")"
        let upper = blob.uppercased()
        if brands.contains(where: { blob.contains($0) || upper.contains($0.uppercased()) }) {
            return true
        }
        if markers.contains(where: { blob.contains($0) }) { return true }
        return false
    }

    static func isNonWalkIn(_ spot: Spot) -> Bool {
        guard spot.guide == .meal else { return false }
        return isNonWalkIn(name: spot.name, blurb: spot.blurb, detail: spot.detail)
    }

    /// meal から配食・宅食を除いた駅。
    static func strip(from station: Station) -> Station {
        let spots = station.spots.filter { !isNonWalkIn($0) }
        guard spots.count != station.spots.count else { return station }
        return Station(
            id: station.id, name: station.name, nameReading: station.nameReading,
            line: station.line, prefecture: station.prefecture, region: station.region,
            mood: station.mood, radiiKm: station.radiiKm, stationIntro: station.stationIntro,
            areaAbout: station.areaAbout, walkGuide: station.walkGuide,
            historyNotes: station.historyNotes, sightseeingNotes: station.sightseeingNotes,
            bikeRental: station.bikeRental, tourTitle: station.tourTitle,
            catchCopy: station.catchCopy, emptyCopy: station.emptyCopy,
            lat: station.lat, lng: station.lng, spots: spots
        )
    }
}
