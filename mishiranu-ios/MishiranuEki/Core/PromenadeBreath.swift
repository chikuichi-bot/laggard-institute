import Foundation

/// TTS 用「散歩の呼吸」一筆書き。
/// 駅を出て → 空気の区間 → 折れる → 同じ駅へ帰る。店・名所は道の途中の短い後段。
enum PromenadeBreath {
    static func script(
        for station: Station,
        course: WalkCourse? = nil
    ) -> String {
        let bare = SavedStationStore.bareName(station.name)
        let corridors: [AtmosphereCorridor] = {
            if let course, !course.corridors.isEmpty {
                return Array(course.corridors.prefix(3))
            }
            return Array(
                AtmosphereCorridorCanon.corridors(
                    for: station,
                    matching: [],
                    preferAtmosphere: true
                ).prefix(3)
            )
        }()

        var parts: [String] = []
        parts.append("私は、\(bare)の改札を出る。")

        if let first = corridors.first {
            parts.append("まず、\(first.name)を通る。\(trimSentence(first.blurb))")
        } else if let walk = station.walkGuide?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !walk.isEmpty {
            parts.append(firstSentences(walk, max: 2))
        } else {
            parts.append("名前のない道の空気を、足の裏で確かめながら歩き出す。")
        }

        if corridors.count >= 2 {
            let second = corridors[1]
            parts.append("途中で、\(second.name)へ折れる。\(trimSentence(second.blurb))")
        } else if corridors.count == 1,
                  let walk = station.walkGuide?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !walk.isEmpty {
            let rest = firstSentences(walk, max: 1)
            if !rest.isEmpty {
                parts.append("道の向きが少し変わる。\(rest)")
            }
        }

        let mid = pickMidSpots(
            from: course.map { $0.stops.map(\.spot) } ?? station.spots,
            corridors: corridors
        )
        if !mid.isEmpty {
            let names = mid.map(\.name).joined(separator: "、")
            parts.append("道の途中で、\(names)が目に入る。立ち止まるのは、ほんの一瞬でよい。")
        }

        if corridors.count >= 3 {
            parts.append("\(corridors[2].name)の気配を残して、私は向きを駅へ戻す。")
        }

        parts.append(
            "また、同じ駅へ帰る。歩いたぶんだけ、さっきまでの名前は、私の散歩道になっていく。"
        )

        return parts
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
    }

    private static func trimSentence(_ text: String) -> String {
        text.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func firstSentences(_ text: String, max: Int) -> String {
        let flat = text.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        var lines: [String] = []
        var current = ""
        for ch in flat {
            current.append(ch)
            if "。！？".contains(ch) {
                let t = current.trimmingCharacters(in: .whitespacesAndNewlines)
                if !t.isEmpty { lines.append(t) }
                current = ""
                if lines.count >= max { break }
            }
        }
        if lines.count < max {
            let rest = current.trimmingCharacters(in: .whitespacesAndNewlines)
            if !rest.isEmpty { lines.append(rest) }
        }
        return lines.prefix(max).joined()
    }

    private static func pickMidSpots(
        from spots: [Spot],
        corridors: [AtmosphereCorridor]
    ) -> [Spot] {
        let keys = Set(corridors.flatMap { [$0.name] + $0.relatedSpotNames })
        return spots.filter { spot in
            if spot.guide == .meal || spot.guide == .souvenir { return false }
            if keys.contains(spot.name) { return false }
            if corridors.contains(where: {
                spot.name.contains($0.name) || $0.name.contains(spot.name)
            }) {
                return false
            }
            return spot.guide == .sight || spot.guide == .rest || spot.guide == .tip
                || spot.majorWorthy
        }
        .prefix(2)
        .map { $0 }
    }
}
