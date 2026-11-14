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
    /// 粋な寄り道: このキーの目的地の直前に区間を挟む（例: ["同志社"]）。
    let weaveBeforeKeys: [String]

    var mapCoordinates: [CLLocationCoordinate2D] {
        path.map(\.cl)
    }

    init(
        id: String,
        name: String,
        kind: String,
        blurb: String,
        path: [Coord],
        relatedSpotNames: [String],
        walkMinutes: Int,
        weaveBeforeKeys: [String] = []
    ) {
        self.id = id
        self.name = name
        self.kind = kind
        self.blurb = blurb
        self.path = path
        self.relatedSpotNames = relatedSpotNames
        self.walkMinutes = walkMinutes
        self.weaveBeforeKeys = weaveBeforeKeys
    }

    enum CodingKeys: String, CodingKey {
        case id, name, kind, blurb, path, relatedSpotNames, walkMinutes, weaveBeforeKeys
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? ""
        name = try c.decode(String.self, forKey: .name)
        kind = try c.decodeIfPresent(String.self, forKey: .kind) ?? "road"
        blurb = try c.decodeIfPresent(String.self, forKey: .blurb) ?? ""
        path = try c.decodeIfPresent([Coord].self, forKey: .path) ?? []
        relatedSpotNames = try c.decodeIfPresent([String].self, forKey: .relatedSpotNames) ?? []
        walkMinutes = try c.decodeIfPresent(Int.self, forKey: .walkMinutes) ?? 6
        weaveBeforeKeys = try c.decodeIfPresent([String].self, forKey: .weaveBeforeKeys) ?? []
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(name, forKey: .name)
        try c.encode(kind, forKey: .kind)
        try c.encode(blurb, forKey: .blurb)
        try c.encode(path, forKey: .path)
        try c.encode(relatedSpotNames, forKey: .relatedSpotNames)
        try c.encode(walkMinutes, forKey: .walkMinutes)
        try c.encode(weaveBeforeKeys, forKey: .weaveBeforeKeys)
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
        // 寺・公園・城跡: 敷地内を歩く grounds（正本 path が無い駅でも自動）
        for grounds in groundsCorridors(forSpots: station.spots) {
            let tip = grounds.relatedSpotNames.first ?? grounds.name
            let already = list.contains { corridor in
                guard corridor.kind == "grounds" else { return false }
                return corridor.relatedSpotNames.contains {
                    $0.count >= 2 && (tip.contains($0) || $0.contains(tip))
                } || corridor.name.contains(tip) || tip.contains(corridor.name)
            }
            if already || named.contains(grounds.name) { continue }
            list.append(grounds)
            named.insert(grounds.name)
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

    /// 手で確かめた正本の区間か（path が実在の道に沿う）。
    static func isCanon(_ corridor: AtmosphereCorridor, stationName: String) -> Bool {
        canon(forStationName: stationName).contains { $0.id == corridor.id || $0.name == corridor.name }
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
        if !["arcade", "streetscape", "riverside", "road", "grounds"].contains(kind) {
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
        if kind == "grounds", !isGroundsExplorableName(name) {
            kind = "road"
        }
        let path: [AtmosphereCorridor.Coord]
        if raw.path.count >= 2 {
            path = Array(raw.path.prefix(kind == "grounds" ? 10 : 6))
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
            walkMinutes: max(3, min(15, raw.walkMinutes > 0 ? raw.walkMinutes : 6)),
            weaveBeforeKeys: raw.weaveBeforeKeys.filter { $0.count >= 2 }
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
        // 水路そのもの（元田中の疏水分線など）。点ではなく通る空気。
        if n.contains("疏水") || n.contains("疎水") || n.contains("水路") { return true }
        if isGroundsExplorableName(n) { return true }
        if spot.guide == .sight || spot.guide == .tip {
            if n.contains("坂") || n.contains("道") { return true }
        }
        return false
    }

    /// お寺・神社・公園・城跡など、外周道路ではなく敷地内を歩きたい場所。
    static func isGroundsExplorableName(_ name: String) -> Bool {
        let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard n.count >= 2 else { return false }
        if n.contains("本店") || n.contains("食堂") || n.contains("茶屋")
            || n.contains("カフェ") || n.contains("喫茶") || n.contains("旅館")
            || n.contains("ホテル") || n.contains("弁当") {
            return false
        }
        if n.contains("城跡") || n.contains("城址") || n.contains("史跡") { return true }
        if n.contains("公園") || n.contains("庭園") || n.contains("御苑") || n.contains("植物園") {
            return true
        }
        if n.contains("神社") || n.contains("神宮") || n.contains("大社") || n.contains("天満宮") {
            return true
        }
        if n.hasSuffix("寺") || n.hasSuffix("院") || n.contains("寺院") || n.contains("仁王門") {
            return true
        }
        if n.contains("境内") || n.contains("参道") { return true }
        return false
    }

    /// ピン周辺の敷地内一周（実測 path が無い駅用）。北東入口寄りから時計回り。
    static func groundsLoopPath(
        centerLat: Double,
        centerLng: Double,
        radiusMeters: Double,
        count: Int = 7
    ) -> [AtmosphereCorridor.Coord] {
        let n = max(5, min(10, count))
        let cosLat = max(cos(centerLat * .pi / 180), 0.2)
        return (0..<n).map { i in
            // 北東（入口っぽい）から時計回り
            let ang = -Double.pi / 4 + Double(i) * 2 * .pi / Double(n)
            let rLat = radiusMeters * (0.92 + 0.08 * cos(ang * 2))
            let rLng = radiusMeters * 1.12
            let dLat = (rLat * cos(ang)) / 111_320
            let dLng = (rLng * sin(ang)) / (111_320 * cosLat)
            return .init(lat: centerLat + dLat, lng: centerLng + dLng)
        }
    }

    static func groundsRadiusMeters(forName name: String, walkMinutes: Int) -> Double {
        let n = name
        var base: Double = 62
        if n.contains("城跡") || n.contains("城址") || n.contains("公園") || n.contains("御苑") {
            base = 95
        } else if n.contains("庭園") || n.contains("植物園") {
            base = 80
        } else if n.contains("神社") || n.contains("神宮") {
            base = 70
        }
        let fromWalk = Double(max(4, min(18, walkMinutes))) * 5.5
        return min(140, max(base, fromWalk))
    }

    /// コース立ち寄りから敷地内帯を足す（駅 spots に無い土地文ピン用）。
    static func groundsCorridors(forSpots spots: [Spot]) -> [AtmosphereCorridor] {
        var out: [AtmosphereCorridor] = []
        var seen = Set<String>()
        for spot in spots {
            guard isGroundsExplorableName(spot.name) else { continue }
            guard spot.lat != 0 || spot.lng != 0 else { continue }
            let key = spot.name
            guard !seen.contains(key) else { continue }
            seen.insert(key)
            guard let c = groundsCorridor(for: spot) else { continue }
            out.append(c)
            if out.count >= 6 { break }
        }
        return out
    }

    static func groundsCorridor(for spot: Spot) -> AtmosphereCorridor? {
        guard isGroundsExplorableName(spot.name) else { return nil }
        guard spot.lat != 0 || spot.lng != 0 else { return nil }
        let radius = groundsRadiusMeters(forName: spot.name, walkMinutes: spot.walkMinutes)
        let path = groundsLoopPath(
            centerLat: spot.lat,
            centerLng: spot.lng,
            radiusMeters: radius
        )
        return AtmosphereCorridor(
            id: "grounds-\(spot.id)",
            name: "\(spot.name)の敷地内",
            kind: "grounds",
            blurb: "外周の車道ではなく、\(spot.name)の敷地・園内を通って歩く。",
            path: path,
            relatedSpotNames: [spot.name],
            walkMinutes: max(5, min(16, spot.walkMinutes > 0 ? spot.walkMinutes : 8))
        )
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
        if bare.contains("元田中") || name.contains("元田中") {
            return mototanakaCorridors
        }
        // 「淀屋橋」などに吸われないよう、駅名は淀だけ。
        if bare == "淀" || name == "淀駅" {
            return yodoCorridors
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
            // 正本は LandmarkRegistry.demachiMasugataArcade（通りの中ほど）。端を広げすぎると目印がずれる。
            path: [
                .init(lat: 35.03018, lng: 135.76978),
                .init(lat: 35.030249, lng: 135.769436),
                .init(lat: 35.03032, lng: 135.76910),
            ],
            relatedSpotNames: ["枡形商店街", "桝形商店街", "枡形", "ふたば", "満寿形"],
            walkMinutes: 4
        ),
        AtmosphereCorridor(
            id: "demachi-sabakaido-approach",
            name: "鯖街道の着き口まわり",
            kind: "streetscape",
            blurb: "若狭から塩鯖が都へ入る最後の町場だった記憶が、枡形の名と細い道に残る。名所の点ではなく、曲がり角ごとの気配を歩く。",
            // 枡形アーケードと同帯。北へ大きく外さない（目印ずれ防止）。
            path: [
                .init(lat: 35.03012, lng: 135.76970),
                .init(lat: 35.030249, lng: 135.769436),
                .init(lat: 35.03040, lng: 135.76915),
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
        AtmosphereCorridor(
            id: "demachi-shokokuji-to-doshisha",
            name: "相国寺の境内から同志社へ",
            kind: "grounds",
            blurb: "同志社へ向かうとき、今出川の南回りより境内の木立を東西に通る。無駄な寄り道が土地らしい。",
            path: [
                .init(lat: 35.03305, lng: 135.76420),
                .init(lat: 35.03325, lng: 135.76270),
                .init(lat: 35.03255, lng: 135.76135),
                .init(lat: 35.02971, lng: 135.76072),
            ],
            relatedSpotNames: ["相国寺", "同志社大学", "同志社", "今出川"],
            walkMinutes: 10,
            weaveBeforeKeys: ["同志社"]
        ),
    ]

    /// 淀: 歩き方文の「石垣と内堀の周りをぐるりと一周」。OSM way/240772722 の園内。
    /// MKDirections は外周道路に逃げるので、園内の散歩線を正本にする。
    private static let yodoCorridors: [AtmosphereCorridor] = [
        AtmosphereCorridor(
            id: "yodo-castle-moat-loop",
            name: "淀城跡の石垣と内堀まわり",
            kind: "grounds",
            blurb: "改札から南西の城跡へ入り、石垣と内堀の縁を一周する。外周の車道ではなく、園内を歩く空気。",
            path: [
                // 園内の歩道寄り（堀水面・外周車道に落とさない）。北東入口→時計回り。
                .init(lat: 34.90548, lng: 135.71810),
                .init(lat: 34.90550, lng: 135.71770),
                .init(lat: 34.90535, lng: 135.71735),
                .init(lat: 34.90512, lng: 135.71725),
                .init(lat: 34.90492, lng: 135.71740),
                .init(lat: 34.90485, lng: 135.71775),
                .init(lat: 34.90495, lng: 135.71810),
                .init(lat: 34.90518, lng: 135.71828),
                .init(lat: 34.90535, lng: 135.71832), // 与杼神社寄り
            ],
            relatedSpotNames: [
                "淀城跡公園", "淀城跡", "淀城", "与杼神社", "與杼神社", "予杼神社",
            ],
            walkMinutes: 18
        ),
    ]

    /// 元田中正本: 歩き方文の「疏水分線の水路沿い」を線にする（OSM relation/9491923）。
    private static let mototanakaCorridors: [AtmosphereCorridor] = [
        AtmosphereCorridor(
            id: "mototanaka-sosui-bunsen",
            name: "琵琶湖疏水分線の水路沿い",
            kind: "riverside",
            blurb: "駅の東側を南北に走る疏水分線。点ではなく、水路沿いの小道を一本通る空気。",
            path: [
                // OSM way 378872734 付近 · 南→北（駅から約630–790m 東）
                .init(lat: 35.029045, lng: 135.788465),
                .init(lat: 35.029907, lng: 135.788278),
                .init(lat: 35.030842, lng: 135.788178),
                .init(lat: 35.031703, lng: 135.788239),
                .init(lat: 35.032533, lng: 135.788832),
                .init(lat: 35.033438, lng: 135.788856),
            ],
            relatedSpotNames: ["琵琶湖疏水分線", "疏水分線", "疏水", "水路"],
            walkMinutes: 10
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
            // 寺・公園は groundsCorridors 側（敷地内一周）。短い road 帯にしない。
            if isGroundsExplorableName(spot.name) { return nil }
            guard spot.lat != 0 || spot.lng != 0 else { return nil }
            let kind: String = {
                if spot.name.contains("商店街") { return "arcade" }
                if spot.name.contains("デルタ") || spot.name.contains("川")
                    || spot.name.contains("疏水") || spot.name.contains("疎水")
                    || spot.name.contains("水路") {
                    return "riverside"
                }
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
