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

    /// OSM node/1774463562。京都市左京区北白川追分町88（今出川通の店舗）。キャンパス内ではない。
    static let demachiShinshindo = CLLocationCoordinate2D(latitude: 35.028684, longitude: 135.7819409)
    /// OSM node/4374432589。出町桝形商店街の店先。
    static let demachiFutaba = CLLocationCoordinate2D(latitude: 35.0301072, longitude: 135.7696274)
    static let demachiDelta = CLLocationCoordinate2D(latitude: 35.0301227, longitude: 135.7717415)

    private static let locks: [LockFile.Lock] = {
        guard let url = Bundle.main.url(forResource: "landmark-locks", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let file = try? JSONDecoder().decode(LockFile.self, from: data) else {
            return []
        }
        return file.locks
    }()

    private static func matches(_ name: String, lock: LockFile.Lock) -> Bool {
        if lock.kind == "river" {
            let river = name.contains("デルタ") || name.contains("河川敷") || name.contains("三角州")
                || (name.contains("鴨川") && (name.contains("川端") || name.contains("川沿い")))
            return river
                && !name.contains("カフェ") && !name.contains("茶房")
                && !name.hasSuffix("店") && !name.contains("ふたば")
        }
        return lock.keywords.contains { name.contains($0) }
    }

    private static func pin(for spotName: String, stationName: String) -> Pin? {
        if let lock = locks.first(where: { stationName.contains($0.station) && matches(spotName, lock: $0) }) {
            return Pin(
                id: lock.id,
                coordinate: CLLocationCoordinate2D(latitude: lock.lat, longitude: lock.lng),
                walkMinutes: lock.walkMinutes,
                address: lock.address
            )
        }
        return fallback(for: spotName, stationName: stationName)
    }

    /// JSON が読めないときも、確認済みノードには戻す。
    private static func fallback(for spotName: String, stationName: String) -> Pin? {
        guard stationName.contains("出町柳") else { return nil }
        if spotName.contains("進々堂") || spotName.contains("新進堂") {
            return Pin(id: "demachi-shinshindo", coordinate: demachiShinshindo, walkMinutes: 12, address: "京都市左京区北白川追分町88")
        }
        if spotName.contains("ふたば") {
            return Pin(id: "demachi-futaba", coordinate: demachiFutaba, walkMinutes: 3, address: "京都市上京区出町桝形商店街")
        }
        if spotName.contains("デルタ") || spotName.contains("河川敷") || spotName.contains("三角州") {
            return Pin(id: "demachi-delta", coordinate: demachiDelta, walkMinutes: 3, address: "鴨川デルタ")
        }
        return nil
    }

    static func apply(_ spot: Spot, stationName: String) -> Spot {
        guard let pin = pin(for: spot.name, stationName: stationName) else { return spot }
        return spot.moved(to: pin.coordinate, walkMinutes: pin.walkMinutes)
    }

    static func apply(to station: Station) -> Station {
        let spots = station.spots.map { apply($0, stationName: station.name) }
        return station.relocated(
            center: CLLocationCoordinate2D(latitude: station.lat, longitude: station.lng),
            spots: spots
        )
    }

    static func isLocked(_ spot: Spot, stationName: String) -> Bool {
        pin(for: spot.name, stationName: stationName) != nil
    }

    /// ご飯の定番として検索する正式名（canonical または meal ロック）。
    static func mealStapleNames(for stationName: String) -> [String] {
        var names: [String] = []
        for lock in locks where stationName.contains(lock.station) {
            if lock.kind == "meal" {
                names.append(lock.canonical ?? lock.keywords.first ?? lock.id)
                continue
            }
            let mealHints = ["進々堂", "新進堂", "おにぎり", "お米自慢", "満寿形", "ますがた"]
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
    static func canonicalizeMealName(_ name: String, stationName: String) -> String? {
        for lock in locks where stationName.contains(lock.station) {
            guard lock.kind == "meal" || lock.canonical != nil else { continue }
            let canonical = lock.canonical ?? lock.keywords.first
            guard let canonical else { continue }
            if NameMatch.score(name, canonical) >= 72 { return canonical }
            if lock.keywords.contains(where: { name.contains($0) || $0.contains(name) }) {
                // 「おにぎり屋」だけ等の弱い名は、正式 canonical へ昇格
                if MealStapleCatcher.isWeakCategoryName(name) || NameMatch.score(name, canonical) >= 55 {
                    return canonical
                }
            }
        }
        return nil
    }
}
