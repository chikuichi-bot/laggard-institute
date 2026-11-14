import CoreLocation
import Foundation

/// 地図は線を引かず、walkGuide（正本）と入り口点で最初の一歩を支える（仕様 C+E）。
enum WalkGuideOrientation {
    struct EntranceHint {
        let label: String
        let coordinate: CLLocationCoordinate2D
    }

    /// 地図下カード用。歩き方文の先頭 1〜2 文（長すぎたら切る）。
    static func guideCardText(from walkGuide: String?) -> String? {
        let raw = (walkGuide ?? "")
            .replacingOccurrences(of: "\n", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return nil }
        let parts = raw
            .components(separatedBy: CharacterSet(charactersIn: "。．"))
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        guard let first = parts.first else { return nil }
        var text = first + "。"
        if parts.count >= 2, text.count < 48 {
            text += parts[1] + "。"
        }
        if text.count > 90 {
            let idx = text.index(text.startIndex, offsetBy: 88)
            return String(text[..<idx]) + "…"
        }
        return text
    }

    /// 改札後の最初の手がかり（0番）。橋・門・踏切など。線は引かない。
    static func entranceHint(
        stationLat: Double,
        stationLng: Double,
        walkGuide: String?,
        firstStop: (lat: Double, lng: Double)?,
        spots: [Spot]
    ) -> EntranceHint? {
        let guide = (walkGuide ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !guide.isEmpty || firstStop != nil else { return nil }

        let label = entranceLabel(from: guide) ?? "最初の手がかり"
        let head = String(guide.prefix(100))

        // 歩き方文の頭に出る名所がスポットにあれば、それを入り口に使う
        if let matched = spots.first(where: { spot in
            guard spot.lat != 0 || spot.lng != 0 else { return false }
            let n = spot.name
            guard n.count >= 2 else { return false }
            return head.contains(n) || head.contains(bareLandmark(n))
        }) {
            let dist = Geo.haversineKm(
                lat1: stationLat, lng1: stationLng,
                lat2: matched.lat, lng2: matched.lng
            )
            // 駅から遠すぎる本殿などは「最初」ではない
            if dist <= 0.55 {
                return EntranceHint(
                    label: shortEntranceLabel(matched.name, fallback: label),
                    coordinate: CLLocationCoordinate2D(latitude: matched.lat, longitude: matched.lng)
                )
            }
        }

        guard let first = firstStop, (first.lat != 0 || first.lng != 0) else {
            return nil
        }
        let fullKm = Geo.haversineKm(
            lat1: stationLat, lng1: stationLng,
            lat2: first.lat, lng2: first.lng
        )
        guard fullKm > 0.04 else { return nil }
        // 駅からおおよそ 120〜180m、または最初の立ち寄りまでの 35%（近いときは少し手前）
        let targetKm = min(0.18, max(0.11, fullKm * 0.35))
        let t = min(0.85, targetKm / fullKm)
        let lat = stationLat + (first.lat - stationLat) * t
        let lng = stationLng + (first.lng - stationLng) * t
        return EntranceHint(
            label: label,
            coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lng)
        )
    }

    private static func bareLandmark(_ name: String) -> String {
        name
            .replacingOccurrences(of: "（", with: "")
            .replacingOccurrences(of: "）", with: "")
            .replacingOccurrences(of: "(", with: "")
            .replacingOccurrences(of: ")", with: "")
    }

    private static func shortEntranceLabel(_ name: String, fallback: String) -> String {
        if name.count <= 12 { return name }
        if let gate = entranceLabel(from: name) { return gate }
        return fallback
    }

    /// 歩き方文から「最初の目印」らしい短いラベルを取る。
    static func entranceLabel(from guide: String) -> String? {
        let g = guide.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !g.isEmpty else { return nil }
        let patterns: [(String, String)] = [
            (#"([^、。]{0,12}踏切)"#, "踏切"),
            (#"([^、。]{0,14}鳥居)"#, "鳥居"),
            (#"([^、。]{0,14}仁王門)"#, "仁王門"),
            (#"([^、。]{0,12}総門)"#, "総門"),
            (#"([^、。]{0,14}門前)"#, "門前"),
            (#"([^、。]{0,12}大鳥居)"#, "大鳥居"),
            (#"([^、。]{0,16}橋)(?:を|の|へ|に|下)?"#, "橋"),
            (#"(改札を出て[^、。]{2,20})"#, "改札"),
            (#"([^、。]{2,14}通)(?:を|へ)"#, "通り"),
        ]
        for (pattern, _) in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern),
               let match = regex.firstMatch(
                in: g,
                range: NSRange(g.startIndex..., in: g)
               ),
               let range = Range(match.range(at: 1), in: g)
            {
                var label = String(g[range])
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                if label.hasPrefix("改札を出て") {
                    label = String(label.dropFirst("改札を出て".count))
                    if label.isEmpty { label = "改札の外" }
                }
                if label.count > 14 {
                    label = String(label.prefix(12)) + "…"
                }
                if !label.isEmpty { return label }
            }
        }
        // 一文目の冒頭だけ（「北口から出て…」型）
        if let first = g.split(whereSeparator: { "。．、".contains($0) }).first {
            let s = String(first).trimmingCharacters(in: .whitespacesAndNewlines)
            if s.count >= 4 {
                return s.count <= 14 ? s : String(s.prefix(12)) + "…"
            }
        }
        return nil
    }
}
