import Foundation

/// 一度調べた駅を端末に少しずつ保存する（Application Support）。
enum SavedStationStore {
    private struct File: Codable {
        var version: Int
        var savedAt: String
        var stations: [Station]
    }

    /// かつてアプリに同梱していた種駅。ライブラリからも外す。
    private static let retiredIds: Set<String> = [
        "demachiyanagi", "chushojima", "iwashimizu-hachimangu", "oyamazaki",
        "biei", "kanita", "ashio", "sawara", "manazuru", "hamakanaya",
        "nagatoro", "katsunuma", "kobuchizawa", "obasute", "shimosuwa",
        "yui", "nebukawa", "amarube", "onomichi", "misumi", "usuki",
        "hitoyoshi", "tsukazaki", "tamatsukuri",
    ]

    private static var fileURL: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let folder = dir.appendingPathComponent("MishiranuEki", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder.appendingPathComponent("saved-stations.json")
    }

    static func load() -> [Station] {
        guard let data = try? Data(contentsOf: fileURL), !data.isEmpty else { return [] }
        // 1件壊れていても全体を捨てない
        if let file = try? JSONDecoder().decode(File.self, from: data) {
            let kept = file.stations.filter { !retiredIds.contains($0.id) }
            if kept.count != file.stations.count {
                _ = write(kept)
            }
            return kept
        }
        // 旧形式や部分破損: stations 配列だけ拾う
        guard
            let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let rows = root["stations"] as? [[String: Any]]
        else { return [] }
        let decoder = JSONDecoder()
        var kept: [Station] = []
        for row in rows {
            guard
                let rowData = try? JSONSerialization.data(withJSONObject: row),
                let station = try? decoder.decode(Station.self, from: rowData),
                !retiredIds.contains(station.id)
            else { continue }
            kept.append(station)
        }
        if !kept.isEmpty { _ = write(kept) }
        return kept
    }

    private static func write(_ stations: [Station]) -> [Station] {
        let file = File(
            version: 1,
            savedAt: ISO8601DateFormatter().string(from: Date()),
            stations: stations
        )
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.sortedKeys]
            let data = try encoder.encode(file)
            try data.write(to: fileURL, options: [.atomic])
        } catch {
            assertionFailure("saved-stations.json の書き込みに失敗: \(error)")
        }
        return stations
    }

    /// 駅名（「駅」なし）で保存済みを探す。
    static func find(byName name: String, in stations: [Station]? = nil) -> Station? {
        let bare = bareName(name)
        guard !bare.isEmpty else { return nil }
        let pool = stations ?? load()
        return pool.first { bareName($0.name) == bare }
    }

    /// 安定した保存用 id（時刻を付けない）。
    static func stableId(forName name: String) -> String {
        "ai-\(bareName(name))"
    }

    @discardableResult
    static func upsert(_ station: Station) -> [Station] {
        guard !retiredIds.contains(station.id) else { return load() }
        let bare = Self.bareName(station.name)
        var next = load().filter {
            $0.id != station.id && Self.bareName($0.name) != bare
        }
        next.insert(station, at: 0)
        return write(next)
    }

    /// バンドル種＋保存済み。同じ id / 駅名は保存側を優先。保存済みが先頭。
    static func merge(bundled: [Station], saved: [Station]) -> [Station] {
        var byId: [String: Station] = [:]
        for s in bundled { byId[s.id] = s }
        for s in saved { byId[s.id] = s }

        var usedNames = Set<String>()
        var out: [Station] = []

        func appendUnique(_ station: Station) {
            let resolved = byId[station.id] ?? station
            let nameKey = bareName(resolved.name)
            guard !usedNames.contains(nameKey) else { return }
            // 同名の別 id が保存側にあればそちら
            if let savedHit = saved.first(where: { bareName($0.name) == nameKey }) {
                out.append(savedHit)
            } else {
                out.append(resolved)
            }
            usedNames.insert(nameKey)
        }

        for s in saved { appendUnique(s) }
        for s in bundled { appendUnique(s) }
        return out
    }

    static func bareName(_ name: String) -> String {
        name.hasSuffix("駅") ? String(name.dropLast()) : name
    }
}
