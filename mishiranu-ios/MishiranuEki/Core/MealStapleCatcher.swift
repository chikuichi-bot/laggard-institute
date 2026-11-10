import Foundation

/// 土地の定番めしを「屋号＋業態」で捕まえる。
/// 例: 「お米自慢 おにぎり屋さん」＝固有屋号＋おにぎり。曖昧な「おにぎり屋」や多目的カフェは落とす。
enum MealStapleCatcher {
    /// 同じ系統の店は1系統につき最強の屋号だけ残す。
    private static let families: [(id: String, tokens: [String])] = [
        ("onigiri", ["おにぎり", "おむすび"]),
        ("bakery", ["パン", "ベーカリー", "bakery", "進々堂", "新進堂"]),
        ("udon_diner", ["うどん", "満寿形", "ますがた"]),
        ("soba", ["そば", "蕎麦"]),
        ("sushi_diner", ["鯖寿司", "寿司", "すし"]),
        ("teishoku", ["定食", "食堂"]),
    ]

    private static let tradeSuffixes = [
        "屋さん", "本舗", "食堂", "茶屋", "ベーカリー", "Bakery", "堂", "屋", "店",
    ]

    private static let foodOnlyTokens: Set<String> = [
        "おにぎり", "おむすび", "パン", "うどん", "そば", "蕎麦", "食堂", "定食",
        "寿司", "すし", "ラーメン", "中華", "ご飯", "食事",
    ]

    private static let softNoise = [
        "多目的", "つながる", "知る、感じる", "コワーキング", "レンタルスペース",
        "シェアキッチン", "コミュニティ",
    ]

    /// 屋号の強さ（0〜）。固有名＋業態が高い。「おにぎり屋」だけは低い。
    static func brandTradeScore(_ name: String) -> Double {
        let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !n.isEmpty else { return 0 }
        if softNoise.contains(where: { n.contains($0) }) { return -40 }

        var score = 0.0
        let (brand, trade) = splitBrandTrade(n)

        if let trade, !trade.isEmpty {
            score += 18
            if trade.contains("屋さん") { score += 14 }
            if trade.hasSuffix("堂") || trade.contains("食堂") || trade.contains("本舗") { score += 12 }
        }

        if let brand, !brand.isEmpty {
            let compact = NameMatch.normalize(brand)
            if compact.count >= 2, !foodOnlyTokens.contains(brand), !foodOnlyTokens.contains(compact) {
                score += 36
                // 地元屋号っぽい語（自慢・屋号の固有感）
                if brand.contains("自慢") || brand.contains("本家") || brand.contains("老舗") {
                    score += 10
                }
                // 漢字・かなの屋号は英数字のみより優先
                if brand.range(of: #"\p{Han}|\p{Hiragana}|\p{Katakana}"#, options: .regularExpression) != nil {
                    score += 8
                }
            } else {
                score -= 12
            }
        } else {
            // 業態語だけ（「おにぎり屋」「カフェ」）
            score -= 20
        }

        // 空白区切りの「屋号 業態」はキャッチしやすい正式名
        if n.contains(" ") || n.contains("　") { score += 8 }

        return score
    }

    /// ご飯の定番度。案内・コースの並び用。
    static func stapleScore(name: String, blurb: String = "", detail: String? = nil) -> Double {
        let blob = name + blurb + (detail ?? "")
        var score = brandTradeScore(name)
        for family in families {
            if family.tokens.contains(where: { name.contains($0) || blob.contains($0) }) {
                score += 22
                break
            }
        }
        if softNoise.contains(where: { blob.contains($0) }) { score -= 50 }
        return score
    }

    static func stapleScore(_ spot: Spot) -> Double {
        guard spot.guide == .meal else { return 0 }
        var score = stapleScore(name: spot.name, blurb: spot.blurb, detail: spot.detail)
        score += max(0, 8 - Double(spot.walkMinutes) * 0.3)
        return score
    }

    /// 系統内で弱い屋号を落とし、強い正式名を残す。
    /// ロック定番がある系統は、その正式名以外を落とす（例: おにぎり→お米自慢のみ。利次郎は不可）。
    static func consolidateMeals(_ spots: [Spot], stationName: String = "") -> [Spot] {
        var meals = spots.filter { $0.guide == .meal }
        let others = spots.filter { $0.guide != .meal }
        let locked = LandmarkRegistry.mealStapleNames(for: stationName)

        for family in families {
            let members = meals.indices.filter { idx in
                family.tokens.contains { meals[idx].name.contains($0) }
            }
            guard !members.isEmpty else { continue }

            // この系統にロック定番があれば、それ以外は出さない（利次郎など二番手を切る）
            let lockedForFamily = locked.filter { name in
                family.tokens.contains { name.contains($0) }
            }
            if !lockedForFamily.isEmpty {
                meals = meals.enumerated().compactMap { idx, spot in
                    guard members.contains(idx) else { return spot }
                    let isCanonical = lockedForFamily.contains { lock in
                        NameMatch.score(spot.name, lock) >= 70
                            || (lock.contains("お米自慢") && spot.name.contains("お米自慢"))
                            || (lock.contains("進々堂") && (spot.name.contains("進々堂") || spot.name.contains("新進堂")))
                            || (lock.contains("満寿形") && spot.name.contains("満寿形"))
                    }
                    return isCanonical ? spot : nil
                }
                continue
            }

            guard members.count >= 2 else { continue }
            let best = members.max { lhs, rhs in
                let a = brandTradeScore(meals[lhs].name) + (meals[lhs].name.contains("お米自慢") ? 50 : 0)
                let b = brandTradeScore(meals[rhs].name) + (meals[rhs].name.contains("お米自慢") ? 50 : 0)
                if a != b { return a < b }
                return meals[lhs].walkMinutes > meals[rhs].walkMinutes
            }
            guard let best else { continue }
            let drop = Set(members.filter { $0 != best })
            meals = meals.enumerated().compactMap { idx, spot in
                drop.contains(idx) ? nil : spot
            }
        }
        return others + meals
    }

    /// メジャー人気店だけ残す（件数埋めの二番手店は出さない）。
    static func keepMajorMealsOnly(_ spots: [Spot], stationName: String) -> [Spot] {
        let consolidated = consolidateMeals(spots, stationName: stationName)
        let locked = Set(LandmarkRegistry.mealStapleNames(for: stationName))
        return consolidated.filter { spot in
            guard spot.guide == .meal else { return true }
            if locked.contains(where: {
                NameMatch.score(spot.name, $0) >= 70
                    || (spot.name.contains("お米自慢") && $0.contains("お米自慢"))
                    || (spot.name.contains("進々堂") && $0.contains("進々堂"))
                    || (spot.name.contains("満寿形") && $0.contains("満寿形"))
            }) {
                return true
            }
            // ロック外は、かなり強い屋号だけ（二番手おにぎり等は切る）
            return stapleScore(spot) >= 70 && brandTradeScore(spot.name) >= 50
        }
    }

    /// Apple / AI 検索用。曖昧な「おにぎり」検索はせず、正式定番名だけ引く。
    static func searchQueries(stationName: String, existingNames: [String]) -> [String] {
        var queries: [String] = []
        let bare = SavedStationStore.bareName(stationName)
        for name in LandmarkRegistry.mealStapleNames(for: stationName) {
            queries.append(name)
            queries.append("\(name) \(bare)")
        }
        for name in existingNames where brandTradeScore(name) >= 50 {
            if !queries.contains(name) { queries.append(name) }
        }
        // 広い「駅名 おにぎり」は利次郎など二番手を拾うので使わない
        return queries
    }

    /// 業態語だけの弱い名前か。
    static func isWeakCategoryName(_ name: String) -> Bool {
        brandTradeScore(name) < 20
    }

    /// ロック定番以外の同系統店（おにぎり利次郎など）。
    static func isNonCanonicalRival(_ name: String, stationName: String) -> Bool {
        let locked = LandmarkRegistry.mealStapleNames(for: stationName)
        guard !locked.isEmpty else { return false }
        for family in families {
            guard family.tokens.contains(where: { name.contains($0) }) else { continue }
            let lockedForFamily = locked.filter { lock in
                family.tokens.contains { lock.contains($0) }
            }
            guard !lockedForFamily.isEmpty else { continue }
            let isCanonical = lockedForFamily.contains { lock in
                NameMatch.score(name, lock) >= 70
                    || (lock.contains("お米自慢") && name.contains("お米自慢"))
                    || (lock.contains("進々堂") && (name.contains("進々堂") || name.contains("新進堂")))
                    || (lock.contains("満寿形") && name.contains("満寿形"))
            }
            if !isCanonical { return true }
        }
        return false
    }

    // MARK: - split

    private static func splitBrandTrade(_ name: String) -> (String?, String?) {
        let trimmed = name.replacingOccurrences(of: "　", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if let space = trimmed.range(of: " ") {
            let brand = String(trimmed[..<space.lowerBound]).trimmingCharacters(in: .whitespaces)
            let trade = String(trimmed[space.upperBound...]).trimmingCharacters(in: .whitespaces)
            if !brand.isEmpty, !trade.isEmpty { return (brand, trade) }
        }
        for suffix in tradeSuffixes {
            if trimmed.hasSuffix(suffix), trimmed.count > suffix.count {
                let brand = String(trimmed.dropLast(suffix.count))
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                if !brand.isEmpty { return (brand, suffix) }
            }
        }
        return (nil, nil)
    }
}
