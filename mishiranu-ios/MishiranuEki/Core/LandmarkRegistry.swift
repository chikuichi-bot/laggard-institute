import CoreLocation
import Foundation

/// 間違えてはいけない場所の正本。
/// 座標は店名検索や目分量では入れない。`landmark-locks.json` の住所と OSM 店舗ノードが正。
enum LandmarkRegistry {
    struct Pin {
        let id: String
        let coordinate: CLLocationCoordinate2D
        let walkMinutes: Int
        let address: String
    }

    private struct LockFile: Decodable {
        struct Lock: Decodable {
            let id: String
            let station: String
            let kind: String
            let keywords: [String]
            let canonical: String?
            let address: String
            let lat: Double
            let lng: Double
            let walkMinutes: Int
        }
        let locks: [Lock]
    }

    /// 京阪・叡電の出町柳。川端通の南へずらさない（徒歩ルートが橋で切れる）。
    /// 出町柳駅（京阪・叡電）。35°01′50.3″N 135°46′21.6″E。川端通の南には置かない。
    static let demachiStation = CLLocationCoordinate2D(latitude: 35.030639, longitude: 135.772667)

    /// 駅ピンの正本。Apple 検索が南の道路に吸う駅だけ固定する。
    static func lockedStationCenter(name: String) -> CLLocationCoordinate2D? {
        let bare = SavedStationStore.bareName(name)
        if bare.contains("出町柳") { return demachiStation }
        return nil
    }

    static func applyingStationCenter(_ station: Station) -> Station {
        guard let center = lockedStationCenter(name: station.name) else { return station }
        let moved = abs(station.lat - center.latitude) > 0.00005
            || abs(station.lng - center.longitude) > 0.00005
        guard moved else { return station }
        return station.relocated(center: center, spots: station.spots)
    }

    /// OSM node/1774463562。京都市左京区北白川追分町88（今出川通の店舗）。キャンパス内ではない。
    static let demachiShinshindo = CLLocationCoordinate2D(latitude: 35.028684, longitude: 135.7819409)
    /// OSM node/4374432589。出町桝形商店街の店先。
    static let demachiFutaba = CLLocationCoordinate2D(latitude: 35.0301072, longitude: 135.7696274)
    static let demachiDelta = CLLocationCoordinate2D(latitude: 35.0301227, longitude: 135.7717415)
    /// Apple Maps「満寿形屋」。二神町179。川端通ではない。
    static let demachiMasugataya = CLLocationCoordinate2D(latitude: 35.030249, longitude: 135.769436)
    /// 枡形商店街（通り）。食堂と近いが、商店街ピンはここを正本のまま動かさない。
    static let demachiMasugataArcade = CLLocationCoordinate2D(latitude: 35.030249, longitude: 135.769436)
    /// Apple Maps「加茂みたらし茶屋」。下鴨本通の西側・松ノ木町53（境内ではない）。
    static let demachiMitarashi = CLLocationCoordinate2D(latitude: 35.039632, longitude: 135.770796)
    /// 吉田キャンパス（百万遍方面）。駅やデルタに寄せない。
    static let demachiKyotoUniversity = CLLocationCoordinate2D(latitude: 35.0272, longitude: 135.7808)
    /// 相国寺境内（同志社へ向かうときの寄り道。最短の南回りを避ける）。
    static let demachiShokokuji = CLLocationCoordinate2D(latitude: 35.03325, longitude: 135.7627)
    /// 今出川キャンパス。駅やデルタに寄せない。
    static let demachiDoshisha = CLLocationCoordinate2D(latitude: 35.029714, longitude: 135.760715)

    private static let locks: [LockFile.Lock] = {
        guard let url = Bundle.main.url(forResource: "landmark-locks", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let file = try? JSONDecoder().decode(LockFile.self, from: data) else {
            return []
        }
        return file.locks
    }()

    /// 括弧の注釈（「※出町ふたば以外…」など）を外した店名。ロックはここだけ見る。
    static func placeTitle(_ name: String) -> String {
        name.replacingOccurrences(
            of: "[（(][^）)]*[）)]",
            with: "",
            options: .regularExpression
        ).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// 生成メモが店名に混ざったもの。場所として扱わない。
    static func isEditorialName(_ name: String) -> Bool {
        name.contains("※") || name.contains("以外")
    }

    private static func matches(_ name: String, lock: LockFile.Lock) -> Bool {
        if isEditorialName(name) { return false }
        let title = placeTitle(name)
        if lock.kind == "river" {
            // 「鴨川公園」はデルタ正本に吸わせない（合流点の座標はデルタ専用）
            if title.contains("公園") { return false }
            let river = title.contains("デルタ") || title.contains("河川敷") || title.contains("三角州")
                || (title.contains("鴨川") && (title.contains("川端") || title.contains("川沿い")))
            return river
                && !title.contains("カフェ") && !title.contains("茶房")
                && !title.hasSuffix("店") && !title.contains("ふたば")
        }
        return lock.keywords.contains { title.contains($0) }
    }

    private static func pin(for spotName: String, stationName: String) -> Pin? {
        if let lock = locks.first(where: {
            stationName.contains($0.station) && matches(spotName, lock: $0) && branchAllowed(spotName, lock: $0)
        }) {
            return Pin(
                id: lock.id,
                coordinate: CLLocationCoordinate2D(latitude: lock.lat, longitude: lock.lng),
                walkMinutes: lock.walkMinutes,
                address: lock.address
            )
        }
        return fallback(for: spotName, stationName: stationName)
    }

    /// 「進々堂 京大北門前」ロックに寺町店・飛鳥井を当てない。
    private static func branchAllowed(_ spotName: String, lock: LockFile.Lock) -> Bool {
        let canonical = lock.canonical ?? lock.keywords.first ?? ""
        guard !canonical.isEmpty else { return true }
        if lock.kind == "meal" || lock.kind == "souvenir" {
            return matchesLockedBranch(spotName, canonical: canonical)
        }
        return true
    }

    /// 正式名（屋号＋支店）に合うか。屋号だけの一致では支店を拾わない。
    static func matchesLockedBranch(_ name: String, canonical: String) -> Bool {
        if NameMatch.score(name, canonical) >= 78 { return true }
        let parts = canonical
            .split(whereSeparator: { $0 == " " || $0 == "　" })
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        guard let brand = parts.first else { return false }
        let brandHit = name.contains(brand)
            || (brand.contains("進々堂") && (name.contains("進々堂") || name.contains("新進堂")))
        guard brandHit else { return false }
        let branch = parts.dropFirst()
        if branch.isEmpty {
            // 「満寿形屋」のように一語なら屋号一致でよい
            return true
        }
        // 「京大北門前」→ 北門 / 京大 など支店語が名前に要る
        return branch.contains { bit in
            bit.count >= 2 && name.contains(bit)
        }
    }

    /// JSON が読めないときも、確認済みノードには戻す。
    private static func fallback(for spotName: String, stationName: String) -> Pin? {
        guard stationName.contains("出町柳") else { return nil }
        if (spotName.contains("進々堂") || spotName.contains("新進堂")),
           matchesLockedBranch(spotName, canonical: "進々堂 京大北門前") {
            return Pin(id: "demachi-shinshindo", coordinate: demachiShinshindo, walkMinutes: 12, address: "京都市左京区北白川追分町88")
        }
        let title = placeTitle(spotName)
        if !isEditorialName(spotName), title.contains("ふたば") {
            return Pin(id: "demachi-futaba", coordinate: demachiFutaba, walkMinutes: 3, address: "京都市上京区出町桝形商店街")
        }
        // 商店街と満寿形屋は別ピン。フォールバックでも食堂座標に吸い込みしない。
        if spotName.contains("満寿形") {
            return Pin(id: "demachi-masugataya", coordinate: demachiMasugataya, walkMinutes: 4, address: "京都市上京区桝形通出町西入ル二神町179")
        }
        if spotName.contains("枡形商店街") || spotName.contains("桝形商店街")
            || spotName.contains("出町枡形") || spotName.contains("出町桝形")
            || ((spotName.contains("枡形") || spotName.contains("桝形")) && !spotName.contains("満寿")) {
            return Pin(
                id: "demachi-masugata-arcade",
                coordinate: demachiMasugataArcade,
                walkMinutes: 3,
                address: "京都市上京区出町桝形商店街"
            )
        }
        if spotName.contains("みたらし") {
            return Pin(id: "demachi-mitarashi", coordinate: demachiMitarashi, walkMinutes: 15, address: "京都市左京区下鴨松ノ木町53")
        }
        if spotName.contains("公園") {
            // 出町の川沿い公園はデルタ先端より南。デルタ正本と重ねない。
            if stationName.contains("出町柳"), spotName.contains("鴨川") || spotName.contains("出町") {
                return Pin(
                    id: "demachi-kamogawa-park",
                    coordinate: CLLocationCoordinate2D(latitude: 35.02955, longitude: 135.77188),
                    walkMinutes: 4,
                    address: "鴨川沿い（出町柳駅南側）"
                )
            }
        }
        if spotName.contains("デルタ") || spotName.contains("河川敷") || spotName.contains("三角州") {
            return Pin(id: "demachi-delta", coordinate: demachiDelta, walkMinutes: 3, address: "鴨川デルタ")
        }
        if spotName.contains("京都大学") {
            return Pin(
                id: "demachi-kyoto-u",
                coordinate: demachiKyotoUniversity,
                walkMinutes: 14,
                address: "京都市左京区吉田本町（吉田キャンパス・百万遍方面）"
            )
        }
        if spotName.contains("相国寺") {
            return Pin(
                id: "demachi-shokokuji",
                coordinate: demachiShokokuji,
                walkMinutes: 12,
                address: "京都市上京区相国寺門前町"
            )
        }
        if spotName.contains("同志社大学") {
            return Pin(
                id: "demachi-doshisha",
                coordinate: demachiDoshisha,
                walkMinutes: 15,
                address: "京都市上京区今出川通烏丸東入（今出川キャンパス）"
            )
        }
        return nil
    }

    static func apply(_ spot: Spot, stationName: String) -> Spot {
        guard let pin = pin(for: spot.name, stationName: stationName) else { return spot }
        return spot.moved(to: pin.coordinate, walkMinutes: pin.walkMinutes, coordTrust: .lock)
    }

    static func apply(to station: Station) -> Station {
        var spots = station.spots.map { apply($0, stationName: station.name) }
        // ロックされた名所がスポットに無いときは、正本から足す（石清水八幡宮・飛行神社など）
        for lock in locks where station.name.contains(lock.station) {
            // meal も足す（満寿形屋など。無いと AI の仮座標のまま川端に残ることがある）
            guard lock.kind == "keyword" || lock.kind == "river" || lock.kind == "souvenir" || lock.kind == "meal" else { continue }
            let label = lock.canonical ?? lock.keywords.first ?? lock.id
            let already = spots.contains { spot in
                // 「石清水八幡宮駅」は社殿ではない
                if spot.name.hasSuffix("駅") { return false }
                if NameMatch.score(spot.name, label) >= 80 { return true }
                if spot.name.contains(label) { return true }
                return lock.keywords.contains { key in
                    key.count >= 3 && spot.name.contains(key)
                }
            }
            guard !already else { continue }
            let isSouvenir = lock.kind == "souvenir"
                || lock.keywords.contains { $0.contains("餅") || $0.contains("菓子") || $0.contains("土産") || $0.contains("みたらし") }
            let isMeal = lock.kind == "meal"
            let isRiver = lock.kind == "river"
            let guide: GuideKind = isMeal ? .meal : (isSouvenir ? .souvenir : (isRiver ? .rest : .sight))
            spots.append(
                Spot(
                    id: "lock-\(lock.id)",
                    name: label,
                    genre: (isSouvenir || isMeal) ? "gourmet" : "history",
                    guide: guide,
                    mealTier: .casual,
                    mealTimes: [.morning, .lunch],
                    soloOk: true,
                    budgetYen: isMeal ? "〜¥1,500" : (isSouvenir ? "〜¥1,000" : "—"),
                    hours: isSouvenir || isMeal ? "要確認" : nil,
                    blurb: isMeal
                        ? (label.contains("朝日屋")
                            ? "駅前の鯖の棒寿司で知られる一軒。参詣のあと腹ごしらえに寄れる。"
                            : "\(label)。この駅の定番めし。")
                        : (isSouvenir
                            ? "\(label)。門前の手土産・名物。軽い包みで駅からの帰りにも向きやすい。"
                            : (isRiver
                                ? SpotCopy.compose(name: label, guide: .rest, address: lock.address)
                                : "\(label)。この駅の土地の顔になる名所。")),
                    detail: lock.address,
                    walkMinutes: lock.walkMinutes,
                    secretWorthy: false,
                    majorWorthy: true,
                    lat: lock.lat,
                    lng: lock.lng,
                    coordTrust: .lock
                )
            )
        }
        return station.relocated(
            center: CLLocationCoordinate2D(latitude: station.lat, longitude: station.lng),
            spots: spots
        )
    }

    static func isLocked(_ spot: Spot, stationName: String) -> Bool {
        isLocked(name: spot.name, stationName: stationName)
    }

    static func isLocked(name: String, stationName: String) -> Bool {
        pin(for: name, stationName: stationName) != nil
    }

    /// Apple 名検索用。ロックされた正式名・キーワード（みたらし・神社含む）。
    static func appleSearchNames(for stationName: String) -> [String] {
        var names: [String] = []
        for lock in locks where stationName.contains(lock.station) {
            if let canonical = lock.canonical, !canonical.isEmpty {
                names.append(canonical)
            }
            for key in lock.keywords where key.count >= 3 {
                names.append(key)
            }
        }
        return Array(Set(names))
    }

    /// ご飯の定番として検索する正式名（canonical または meal ロック）。
    static func mealStapleNames(for stationName: String) -> [String] {
        var names: [String] = []
        for lock in locks where stationName.contains(lock.station) {
            if lock.kind == "meal" {
                names.append(lock.canonical ?? lock.keywords.first ?? lock.id)
                continue
            }
            let mealHints = [
                "進々堂", "新進堂", "おにぎり", "お米自慢", "満寿形", "ますがた",
                "朝日屋", "棒寿司", "鯖寿司", "鯖の棒寿司",
            ]
            guard lock.keywords.contains(where: { key in mealHints.contains { key.contains($0) } }) else {
                continue
            }
            if let canonical = lock.canonical {
                names.append(canonical)
            } else if lock.keywords.contains(where: { $0.contains("進々堂") || $0.contains("新進堂") }) {
                names.append("進々堂 京大北門前")
            } else {
                names.append(lock.keywords[0])
            }
        }
        return Array(Set(names))
    }

    /// 弱い業態名を、ロックされた正式屋号へ寄せる。
    /// 寺町店など別支店は正式名に寄せず、nil（後でライバルとして落とす）。
    static func canonicalizeMealName(_ name: String, stationName: String) -> String? {
        for lock in locks where stationName.contains(lock.station) {
            guard lock.kind == "meal" || lock.canonical != nil else { continue }
            let canonical = lock.canonical ?? lock.keywords.first
            guard let canonical else { continue }
            if matchesLockedBranch(name, canonical: canonical) { return canonical }
            if MealStapleCatcher.isWeakCategoryName(name),
               lock.keywords.contains(where: { name.contains($0) || $0.contains(name) }) {
                return canonical
            }
        }
        return nil
    }
}
