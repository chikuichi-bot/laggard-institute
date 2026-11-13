import CoreLocation
import Foundation

/// 粋な寄り道（相国寺→同志社型）。駅非依存。
enum PreferredDetour {
    struct Item {
        let id: String
        let name: String
        let beforeKeys: [String]
        let blurb: String
        let lat: Double
        let lng: Double
        let path: [CLLocationCoordinate2D]
        let walkMinutes: Int
    }

    private static func nameHit(_ hay: String, _ needle: String) -> Bool {
        let a = hay.trimmingCharacters(in: .whitespacesAndNewlines)
        let b = needle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard a.count >= 2, b.count >= 2 else { return false }
        return a.contains(b) || b.contains(a)
    }

    private static func spotMatches(_ spot: Spot, keys: [String]) -> Bool {
        keys.contains { nameHit(spot.name, $0) }
    }

    private static func firstCapture(_ pattern: String, in text: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        guard let match = regex.firstMatch(in: text, range: range), match.numberOfRanges >= 2,
              let r = Range(match.range(at: 1), in: text)
        else { return nil }
        let s = String(text[r]).trimmingCharacters(in: .whitespacesAndNewlines)
        return s.count >= 2 ? s : nil
    }

    static func inferWeaveBeforeKeys(name: String, related: [String]) -> [String] {
        if var key = firstCapture(#"(?:から|より)\s*(.+?)(?:へ|まで|へ向か|方面)"#, in: name) {
            for suffix in ["大学", "神社", "寺", "駅"] {
                if key.hasSuffix(suffix), key.count > suffix.count + 1 {
                    key = String(key.dropLast(suffix.count))
                }
            }
            if key.count >= 2 { return [key] }
        }
        let viaHints = [name] + Array(related.prefix(1))
        return Array(
            related.filter { r in
                r.count >= 2 && !viaHints.contains { nameHit($0, r) }
            }.prefix(3)
        )
    }

    static func viaName(from corridor: AtmosphereCorridor) -> String {
        if let raw = firstCapture(
            #"^(.+?)(?:の境内|の中|沿い|を通|経由|から)"#,
            in: corridor.name
        ), raw.count <= 20 {
            return raw
        }
        let before = corridor.weaveBeforeKeys.isEmpty
            ? inferWeaveBeforeKeys(name: corridor.name, related: corridor.relatedSpotNames)
            : corridor.weaveBeforeKeys
        if let first = corridor.relatedSpotNames.first(where: { r in
            !before.contains { nameHit(r, $0) }
        }) {
            return first
        }
        return corridor.name.count <= 16 ? corridor.name : String(corridor.name.prefix(12))
    }

    static func detour(from corridor: AtmosphereCorridor) -> Item? {
        let beforeKeys: [String] = {
            if !corridor.weaveBeforeKeys.isEmpty {
                return corridor.weaveBeforeKeys.filter { $0.count >= 2 }
            }
            return inferWeaveBeforeKeys(name: corridor.name, related: corridor.relatedSpotNames)
        }()
        guard !beforeKeys.isEmpty else { return nil }
        if corridor.weaveBeforeKeys.isEmpty,
           corridor.name.contains("線路沿い")
            || corridor.name.contains("用水の低い")
            || corridor.name.contains("畑に変わる") {
            return nil
        }
        guard let mid = corridor.path.isEmpty
            ? nil
            : corridor.path[corridor.path.count / 2]
        else { return nil }
        let name = viaName(from: corridor)
        if beforeKeys.contains(where: { nameHit(name, $0) }) { return nil }
        return Item(
            id: corridor.id.isEmpty ? "detour-\(name)" : corridor.id,
            name: name,
            beforeKeys: beforeKeys,
            blurb: corridor.blurb,
            lat: mid.lat,
            lng: mid.lng,
            path: corridor.mapCoordinates,
            walkMinutes: max(4, min(18, corridor.walkMinutes))
        )
    }

    static func collect(for station: Station) -> [Item] {
        var out: [Item] = []
        var seen = Set<String>()
        for corridor in AtmosphereCorridorCanon.corridors(for: station) {
            guard let d = detour(from: corridor) else { continue }
            let key = "\(d.name)|\(d.beforeKeys.joined(separator: ","))"
            guard !seen.contains(key) else { continue }
            seen.insert(key)
            out.append(d)
            if out.count >= 4 { break }
        }
        return out
    }

    private static func makeSpot(_ d: Item) -> Spot {
        Spot(
            id: d.id.contains("detour") ? d.id : "detour-\(d.id)",
            name: d.name,
            genre: {
                if d.name.contains("川") || d.name.contains("河") || d.name.contains("公園")
                    || d.name.contains("デルタ") || d.name.contains("堤") || d.name.contains("坂") {
                    return "nature"
                }
                return "history"
            }(),
            guide: .sight,
            mealTier: .casual,
            mealTimes: [],
            soloOk: true,
            budgetYen: "—",
            hours: "終日（屋外・境内は現地の案内に従う）",
            blurb: d.blurb,
            detail: "最短より、土地らしい寄り道として通る。",
            walkMinutes: d.walkMinutes,
            secretWorthy: false,
            majorWorthy: true,
            lat: d.lat,
            lng: d.lng,
            coordTrust: .lock
        )
    }

    /// 目的地の直前に粋な寄り道を挟む（全駅）。
    static func weave(_ spots: [Spot], station: Station) -> [Spot] {
        var out = spots
        for d in collect(for: station) {
            guard let destIdx = out.firstIndex(where: { spotMatches($0, keys: d.beforeKeys) }) else {
                continue
            }
            if let existingIdx = out.firstIndex(where: { nameHit($0.name, d.name) }) {
                if existingIdx == destIdx - 1 { continue }
                let via = out.remove(at: existingIdx)
                let newDest = out.firstIndex(where: { spotMatches($0, keys: d.beforeKeys) })
                    ?? min(out.count, max(0, destIdx))
                out.insert(via, at: newDest)
                continue
            }
            out.insert(makeSpot(d), at: destIdx)
        }
        return out
    }
}
