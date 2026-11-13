import CoreLocation
import Foundation

/// 点では表せない「空気のある道」——商店街・街並み・川辺など、通って感じる区間。
struct AtmosphereCorridor: Hashable, Identifiable, Codable {
    struct Coord: Hashable, Codable {
        var lat: Double
        var lng: Double

        var cl: CLLocationCoordinate2D {
            CLLocationCoordinate2D(latitude: lat, longitude: lng)
        }
    }

    let id: String
    let name: String
    /// arcade / streetscape / riverside / road
    let kind: String
    let blurb: String
    let path: [Coord]
    let relatedSpotNames: [String]
    let walkMinutes: Int

    var mapCoordinates: [CLLocationCoordinate2D] {
        path.map(\.cl)
    }
}

/// 設定: 空気の道を散歩の主役にする（既定オン）。
enum AtmosphereWalkPrefs {
    static let storageKey = "mishiranu.atmosphereFirst"

    static var preferAtmosphere: Bool {
        get {
            if UserDefaults.standard.object(forKey: storageKey) == nil { return true }
            return UserDefaults.standard.bool(forKey: storageKey)
        }
        set { UserDefaults.standard.set(newValue, forKey: storageKey) }
    }
}

enum AtmosphereCorridorCanon {
    /// 駅の土地から、空気の区間を集める（正本＋アンカー由来）。
    static func corridors(for station: Station) -> [AtmosphereCorridor] {
        var list = canon(forStationName: station.name)
        let named = Set(list.map(\.name))
        for derived in deriveFromAnchors(station) where !named.contains(derived.name) {
            list.append(derived)
        }
        for derived in deriveFromSpots(station) where !list.contains(where: { $0.name == derived.name }) {
            list.append(derived)
        }
        return list
    }

    /// コースに載せる区間（選んだ立ち寄りと関連するものを優先）。
    static func corridors(
        for station: Station,
        matching spots: [Spot],
        preferAtmosphere: Bool
    ) -> [AtmosphereCorridor] {
        let all = corridors(for: station)
        guard preferAtmosphere else {
            // オフでも関連区間は薄く残す（地図の補助）
            return all.filter { corridor in
                spots.contains { spot in related(spot, corridor: corridor) }
            }
        }
        let matched = all.filter { corridor in
            spots.contains { spot in related(spot, corridor: corridor) }
        }
        if !matched.isEmpty { return matched }
        // まだ点が少ない駅でも、正本区間を散歩の芯にする
        return Array(all.prefix(3))
    }

    static func isAtmosphereSpot(_ spot: Spot) -> Bool {
        let n = spot.name
        if n.contains("商店街") || n.contains("商店会") || n.contains("市場") { return true }
        if n.contains("街並み") || n.contains("町並み") || n.contains("鯖街道") { return true }
        if n.contains("通り") || n.contains("川端") || n.contains("河川敷") { return true }
        if n.contains("デルタ") || n.contains("三角州") { return true }
        if spot.guide == .sight || spot.guide == .tip {
            if n.contains("坂") || n.contains("道") { return true }
        }
        return false
    }

    /// 空気優先のとき、区間に紐づく顔を先に並べる。
    static func prioritize(
        _ spots: [Spot],
        corridors: [AtmosphereCorridor],
        preferAtmosphere: Bool
    ) -> [Spot] {
        guard preferAtmosphere, !spots.isEmpty else { return spots }
        return spots.enumerated().sorted { a, b in
            let aScore = atmosphereScore(a.element, corridors: corridors)
            let bScore = atmosphereScore(b.element, corridors: corridors)
            if aScore != bScore { return aScore > bScore }
            return a.offset < b.offset
        }.map(\.element)
    }

    private static func atmosphereScore(_ spot: Spot, corridors: [AtmosphereCorridor]) -> Int {
        var score = 0
        if isAtmosphereSpot(spot) { score += 4 }
        if spot.guide == .meal || spot.guide == .souvenir { score -= 2 }
        if corridors.contains(where: { related(spot, corridor: $0) }) { score += 5 }
        return score
    }

    private static func related(_ spot: Spot, corridor: AtmosphereCorridor) -> Bool {
        corridor.relatedSpotNames.contains { key in
            key.count >= 2 && (spot.name.contains(key) || key.contains(spot.name))
        } || spot.name.contains(corridor.name) || corridor.name.contains(spot.name)
    }

    private static func canon(forStationName name: String) -> [AtmosphereCorridor] {
        let bare = SavedStationStore.bareName(name)
        if bare.contains("出町柳") || name.contains("出町柳") {
            return demachiCorridors
        }
        return []
    }

    /// 出町柳正本: 点ではなく通る空気。
    private static let demachiCorridors: [AtmosphereCorridor] = [
        AtmosphereCorridor(
            id: "demachi-masugata-arcade",
            name: "枡形商店街",
            kind: "arcade",
            blurb: "短いアーケードを一本通り抜ける。店の点ではなく、道幅と人の密度そのものが土地の顔。",
            path: [
                .init(lat: 35.02995, lng: 135.77015),
                .init(lat: 35.03025, lng: 135.76944),
                .init(lat: 35.03048, lng: 135.76895),
            ],
            relatedSpotNames: ["枡形商店街", "桝形商店街", "枡形", "ふたば", "満寿形"],
            walkMinutes: 4
        ),
        AtmosphereCorridor(
            id: "demachi-sabakaido-approach",
            name: "鯖街道の着き口まわり",
            kind: "streetscape",
            blurb: "若狭から塩鯖が都へ入る最後の町場だった記憶が、枡形の名と細い道に残る。名所の点ではなく、曲がり角ごとの気配を歩く。",
            path: [
                .init(lat: 35.03005, lng: 135.76980),
                .init(lat: 35.03055, lng: 135.76910),
                .init(lat: 35.03100, lng: 135.76870),
            ],
            relatedSpotNames: ["枡形", "鯖街道", "若狭街道", "町場"],
            walkMinutes: 6
        ),
        AtmosphereCorridor(
            id: "demachi-delta-bank",
            name: "鴨川デルタの川辺",
            kind: "riverside",
            blurb: "二つの川が一つになる三角の縁。水音と空の広がりが、駅名のラベルを薄くする。",
            path: [
                .init(lat: 35.03040, lng: 135.77120),
                .init(lat: 35.03012, lng: 135.77174),
                .init(lat: 35.02970, lng: 135.77210),
            ],
            relatedSpotNames: ["鴨川デルタ", "デルタ", "河川敷", "三角州", "鴨川"],
            walkMinutes: 5
        ),
    ]

    private static func deriveFromAnchors(_ station: Station) -> [AtmosphereCorridor] {
        LandPresentAnchors.anchors(forStationName: station.name).compactMap { anchor -> AtmosphereCorridor? in
            let kind = anchor.kind
            guard kind == "arcade" || kind == "road" || kind == "river" else { return nil }
            guard let lat = anchor.lat, let lng = anchor.lng else { return nil }
            let corridorKind: String = {
                switch kind {
                case "arcade": return "arcade"
                case "river": return "riverside"
                default: return "road"
                }
            }()
            let path = shortPath(
                from: station,
                through: .init(lat: lat, lng: lng),
                meters: kind == "arcade" ? 90 : 120
            )
            return AtmosphereCorridor(
                id: "anchor-\(SavedStationStore.bareName(station.name))-\(anchor.name)",
                name: anchor.name,
                kind: corridorKind,
                blurb: anchor.present,
                path: path,
                relatedSpotNames: anchor.keys,
                walkMinutes: anchor.walkMinutes ?? 5
            )
        }
    }

    private static func deriveFromSpots(_ station: Station) -> [AtmosphereCorridor] {
        station.spots.compactMap { spot -> AtmosphereCorridor? in
            guard isAtmosphereSpot(spot) else { return nil }
            guard spot.lat != 0 || spot.lng != 0 else { return nil }
            let kind: String = {
                if spot.name.contains("商店街") { return "arcade" }
                if spot.name.contains("デルタ") || spot.name.contains("川") { return "riverside" }
                if spot.name.contains("街並") || spot.name.contains("町並") || spot.name.contains("鯖街道") {
                    return "streetscape"
                }
                return "road"
            }()
            return AtmosphereCorridor(
                id: "spot-\(spot.id)",
                name: spot.name,
                kind: kind,
                blurb: spot.blurb,
                path: shortPath(
                    from: station,
                    through: .init(lat: spot.lat, lng: spot.lng),
                    meters: 100
                ),
                relatedSpotNames: [spot.name],
                walkMinutes: max(3, min(12, spot.walkMinutes))
            )
        }
    }

    /// 駅→地点→少し先、の短い帯（地図用）。
    private static func shortPath(
        from station: Station,
        through mid: AtmosphereCorridor.Coord,
        meters: Double
    ) -> [AtmosphereCorridor.Coord] {
        let dLat = mid.lat - station.lat
        let dLng = mid.lng - station.lng
        let dist = max(Geo.haversineKm(
            lat1: station.lat, lng1: station.lng,
            lat2: mid.lat, lng2: mid.lng
        ), 0.05)
        let scale = (meters / 1000) / dist
        let beyond = AtmosphereCorridor.Coord(
            lat: mid.lat + dLat * scale,
            lng: mid.lng + dLng * scale
        )
        // 駅そのものではなく、地点の手前〜先を帯にする（駅円と重なりすぎない）
        let approach = AtmosphereCorridor.Coord(
            lat: mid.lat - dLat * scale * 0.45,
            lng: mid.lng - dLng * scale * 0.45
        )
        return [approach, mid, beyond]
    }
}
