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
    /// 駅の土地から、空気の区間を集める（正本＋API＋アンカー＋名もなき微地形）。
    static func corridors(for station: Station) -> [AtmosphereCorridor] {
        let isDemachi = station.name.contains("出町柳")
            || SavedStationStore.bareName(station.name).contains("出町柳")
        var list = canon(forStationName: station.name)
        var named = Set(list.map(\.name))
        for (index, raw) in station.atmosphereCorridors.enumerated() {
            guard let c = sanitize(raw, station: station, index: index) else { continue }
            guard !named.contains(c.name) else { continue }
            list.append(c)
            named.insert(c.name)
        }
        for derived in deriveFromAnchors(station) where !named.contains(derived.name) {
            list.append(derived)
            named.insert(derived.name)
        }
        for derived in deriveFromSpots(station) where !named.contains(derived.name) {
            list.append(derived)
            named.insert(derived.name)
        }
        // 空白駅: 名所・商店街が無くても名もなき微地形を芯にする
        if !isDemachi, list.count < 2 {
            for blank in namelessBlankCorridors(for: station, count: 3) where !named.contains(blank.name) {
                list.append(blank)
                named.insert(blank.name)
                if list.count >= 3 { break }
            }
        }
        return list
    }

    static func isInventedTouristName(_ name: String) -> Bool {
        let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if n.isEmpty { return true }
        if n.contains("城下町") { return true }
        if n.contains("観光案内") || n.contains("観光スポット") || n.contains("名所めぐり") {
            return true
        }
        if n == "商店街" || n == "市場" { return true }
        return false
    }

    static func sanitize(
        _ raw: AtmosphereCorridor,
        station: Station,
        index: Int
    ) -> AtmosphereCorridor? {
        let name = raw.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !isInventedTouristName(name) else { return nil }
        var kind = raw.kind.trimmingCharacters(in: .whitespacesAndNewlines)
        if !["arcade", "streetscape", "riverside", "road"].contains(kind) {
            kind = "road"
        }
        if kind == "arcade",
           !(name.contains("商店街") || name.contains("商店会") || name.contains("市場")
            || name.contains("アーケード")) {
            kind = "road"
        }
        let blurbProbe = name + raw.blurb
        if kind == "riverside",
           !(blurbProbe.contains("川") || blurbProbe.contains("用水") || blurbProbe.contains("河")
            || blurbProbe.contains("デルタ") || blurbProbe.contains("堤") || blurbProbe.contains("河原")) {
            kind = "road"
        }
        let path: [AtmosphereCorridor.Coord]
        if raw.path.count >= 2 {
            path = Array(raw.path.prefix(6))
        } else if let mid = raw.path.first {
            path = shortPath(from: station, through: mid, meters: 110)
        } else {
            let mid = offset(from: station, bearingDeg: 40 + Double(index) * 70, meters: 90)
            path = shortPath(from: station, through: mid, meters: 110)
        }
        let mid = path[path.count / 2]
        let km = Geo.haversineKm(
            lat1: station.lat, lng1: station.lng,
            lat2: mid.lat, lng2: mid.lng
        )
        guard km <= 1.6 else { return nil }
        let bare = SavedStationStore.bareName(station.name)
        let blurb = raw.blurb.trimmingCharacters(in: .whitespacesAndNewlines)
        return AtmosphereCorridor(
            id: raw.id.isEmpty ? "ai-\(bare)-corridor-\(index + 1)" : raw.id,
            name: name,
            kind: kind,
            blurb: blurb.isEmpty
                ? "名前のない道を通り、足元の傾斜と風だけを感じて駅へ戻る。"
                : blurb,
            path: path,
            relatedSpotNames: raw.relatedSpotNames.filter { $0.count >= 2 },
            walkMinutes: max(3, min(15, raw.walkMinutes > 0 ? raw.walkMinutes : 6))
        )
    }

    private static func offset(
        from station: Station,
        bearingDeg: Double,
        meters: Double
    ) -> AtmosphereCorridor.Coord {
        let rad = bearingDeg * .pi / 180
        let dLat = (meters / 111_320) * cos(rad)
        let cosLat = cos(station.lat * .pi / 180)
        let dLng = (meters / (111_320 * max(cosLat, 0.2))) * sin(rad)
        return .init(lat: station.lat + dLat, lng: station.lng + dLng)
    }

    /// 名もなき微地形（固有観光名を付けない）。
    static func namelessBlankCorridors(for station: Station, count: Int) -> [AtmosphereCorridor] {
        let templates: [(id: String, name: String, kind: String, blurb: String, bearing: Double, meters: Double, walk: Int)] = [
            (
                "rail-side",
                "線路沿いの細道",
                "road",
                "何もないからこそ、線路と並ぶ細い道の傾斜と風の通り道だけを感じて駅へ戻る区間。",
                18, 140, 6
            ),
            (
                "ditch-low",
                "用水の低い道",
                "road",
                "土地がわずかに低くなる用水沿い。名前のない高低差が、駅名のラベルを薄くする。",
                125, 120, 5
            ),
            (
                "field-edge",
                "畑に変わる境目",
                "streetscape",
                "住宅の気配が途切れ、畑や空き地へ開く境目。用事のない角を曲がって、また駅へ帰る。",
                230, 130, 7
            ),
        ]
        let bare = SavedStationStore.bareName(station.name)
        let n = max(0, min(3, count))
        return templates.prefix(n).map { t in
            let mid = offset(from: station, bearingDeg: t.bearing, meters: t.meters * 0.55)
            return AtmosphereCorridor(
                id: "blank-\(bare)-\(t.id)",
                name: t.name,
                kind: t.kind,
                blurb: t.blurb,
                path: shortPath(from: station, through: mid, meters: t.meters),
                relatedSpotNames: [],
                walkMinutes: t.walk
            )
        }
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
