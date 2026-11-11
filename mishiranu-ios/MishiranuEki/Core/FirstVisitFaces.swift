import Foundation

/// 初めて駅を降りた人が通る「メジャーな普通のところ」だけを残す。
/// 近所の無名な寺・小社は、社寺というだけで顔にしない。
enum FirstVisitFaces {
    /// ガイドブック1ページ目級の社寺・名所っぽさ（全国共通の合図）。
    static func isGuidebookWorship(_ name: String, stationName: String? = nil) -> Bool {
        let n = name
        guard isWorshipName(n) else { return false }

        let fameTokens = [
            "大社", "神宮", "八幡", "天満宮", "東照宮", "稲荷大社",
            "別雷", "御祖", "春日", "明治神宮", "平安神宮", "熱田", "住吉大社",
            "太宰府", "鶴岡", "浅草寺", "清水寺", "金閣", "銀閣", "東大寺",
            "興福寺", "法隆寺", "中尊寺", "平等院", "厳島", "出雲大社",
            "善光寺", "永平寺", "金剛峯", "総本山", "大本山", "国宝",
            "世界遺産", "飛行神社", "石清水", "下鴨", "上賀茂", "賀茂",
        ]
        if fameTokens.contains(where: { n.contains($0) }) { return true }

        // 駅名そのものが社寺名（石清水八幡宮駅 → 石清水八幡宮）
        if let stationName {
            let bare = SavedStationStore.bareName(stationName)
            if bare.count >= 2, n.contains(bare) { return true }
            // 「八幡」駅の門前など、駅名断片が社寺に入る
            if bare.count >= 2 {
                let stem = bare.replacingOccurrences(of: "駅", with: "")
                if stem.count >= 2, n.contains(stem), (n.contains("神社") || n.contains("神宮") || n.contains("大社") || n.hasSuffix("寺")) {
                    return true
                }
            }
        }
        return false
    }

    /// 近所の寺・小社（初めての土地案内には出さない）。
    static func isNeighborhoodWorship(_ name: String, stationName: String? = nil) -> Bool {
        guard isWorshipName(name) else { return false }
        return !isGuidebookWorship(name, stationName: stationName)
    }

    static func isWorshipName(_ name: String) -> Bool {
        let n = name
        // 「タイムズ 下鴨神社南」など駐車場は社寺扱いしない
        if PlaceNoise.isNoise(n) { return false }
        if n.contains("茶屋") || n.contains("茶房") || n.contains("食堂") || n.hasSuffix("本店") || n.hasSuffix("店") {
            return false
        }
        return n.hasSuffix("寺") || n.hasSuffix("神社") || n.hasSuffix("神宮")
            || n.hasSuffix("大社") || n.hasSuffix("寺院") || n.contains("神社")
    }

    /// 川・橋・商店街など、初めて降りた人が通る普通の顔。
    static func isOrdinaryPublicFace(_ name: String) -> Bool {
        let n = name
        let tokens = [
            "デルタ", "三角州", "合流", "河原", "河川敷",
            "商店街", "市場", "朝市", "港", "桟橋", "灯台",
            "城", "城跡", "公園", "橋", "並木", "参道",
        ]
        return tokens.contains(where: { n.contains($0) })
    }

    /// 楼門・参拝記念など、社寺の付属ピン（本体と別カードにしない）。
    static func isWorshipSatellite(_ name: String) -> Bool {
        let tokens = [
            "楼門", "神門", "南門", "東門", "西門", "北門", "表門",
            "参拝記念", "手水", "摂社", "末社", "授与所", "社務所",
            "絵馬殿", "境内図", "御朱印", "お守り",
        ]
        return tokens.contains(where: { name.contains($0) })
    }

    /// 「参拝記念 下鴨神社」「下鴨神社 楼門」→ 核は「下鴨神社」。
    static func worshipCoreName(_ name: String) -> String? {
        let pattern = "([一-龥々ぁ-んァ-ヶーA-Za-z0-9]{2,14}(?:神社|神宮|大社|寺院|寺))"
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(name.startIndex..<name.endIndex, in: name)
        let matches = regex.matches(in: name, range: range)
        guard let last = matches.last, let r = Range(last.range(at: 1), in: name) else { return nil }
        let core = String(name[r])
        // 「下鴨神社（賀茂御祖神社）」は短い側（土地の通称）を核にする
        if name.contains("下鴨"), core.contains("賀茂御祖") { return "下鴨神社" }
        return core
    }

    /// 同じ社の楼門・記念所などを1件に畳む。
    static func collapseWorshipDuplicates(_ spots: [Spot], stationName: String) -> [Spot] {
        var groups: [String: [Spot]] = [:]
        var passthrough: [Spot] = []
        for spot in spots {
            guard isWorshipName(spot.name) || isWorshipSatellite(spot.name),
                  let core = worshipCoreName(spot.name)
            else {
                passthrough.append(spot)
                continue
            }
            // 「タイムズ 下鴨神社南」などは核抽出できてもノイズ扱いのまま外へ
            if PlaceNoise.isNoise(spot.name) {
                passthrough.append(spot)
                continue
            }
            groups[core, default: []].append(spot)
        }
        var collapsed: [Spot] = []
        for (core, members) in groups {
            collapsed.append(pickWorshipRepresentative(members, core: core, stationName: stationName))
        }
        return passthrough + collapsed
    }

    private static func pickWorshipRepresentative(
        _ members: [Spot],
        core: String,
        stationName: String
    ) -> Spot {
        let ranked = members.sorted { lhs, rhs in
            let ls = worshipPickScore(lhs, core: core, stationName: stationName)
            let rs = worshipPickScore(rhs, core: core, stationName: stationName)
            if ls != rs { return ls > rs }
            return lhs.name.count < rhs.name.count
        }
        guard var best = ranked.first else {
            return members[0]
        }
        // 表示名は核（またはロック正式名）へ寄せ、楼門名のまま残さない
        if isWorshipSatellite(best.name) || best.name != core {
            let locked = LandmarkRegistry.isLocked(name: core, stationName: stationName)
                ? LandmarkRegistry.apply(
                    Spot(
                        id: best.id, name: core, genre: best.genre, guide: .sight,
                        mealTier: best.mealTier, mealTimes: best.mealTimes, soloOk: best.soloOk,
                        budgetYen: best.budgetYen, hours: best.hours, blurb: best.blurb,
                        detail: best.detail, walkMinutes: best.walkMinutes,
                        secretWorthy: best.secretWorthy, majorWorthy: true,
                        lat: best.lat, lng: best.lng
                    ),
                    stationName: stationName
                )
                : nil
            if let locked {
                best = locked.withCopy(from: best)
            } else if isWorshipSatellite(best.name) {
                best = Spot(
                    id: best.id, name: core, genre: best.genre, guide: best.guide,
                    mealTier: best.mealTier, mealTimes: best.mealTimes, soloOk: best.soloOk,
                    budgetYen: best.budgetYen, hours: best.hours, blurb: best.blurb,
                    detail: best.detail, walkMinutes: best.walkMinutes,
                    secretWorthy: best.secretWorthy, majorWorthy: best.majorWorthy,
                    lat: best.lat, lng: best.lng, coordTrust: best.coordTrust
                )
            }
        }
        return best
    }

    private static func worshipPickScore(_ spot: Spot, core: String, stationName: String) -> Double {
        var score = 0.0
        if LandmarkRegistry.isLocked(spot, stationName: stationName) { score += 100 }
        if spot.name == core || spot.name.hasPrefix(core) { score += 40 }
        if spot.name.contains("賀茂御祖") || spot.name.contains("（") { score += 20 }
        if spot.majorWorthy { score += 15 }
        if isWorshipSatellite(spot.name) { score -= 50 }
        score += max(0, 20 - Double(spot.name.count))
        return score
    }

    /// 採取・保存データの両方で、近所の社寺・駐車場ノイズを落とす。
    static func filterSpots(_ spots: [Spot], stationName: String) -> [Spot] {
        let filtered = spots.filter { spot in
            if PlaceNoise.isNoise(spot.name) { return false }
            if DemachiTemplate.isForeignDemachiPlace(spot.name, stationName: stationName) {
                return false
            }
            if !DemachiTemplate.isDemachiStationName(stationName),
               DemachiTemplate.isOnDemachiPin(lat: spot.lat, lng: spot.lng) {
                return false
            }
            if LandmarkRegistry.isLocked(spot, stationName: stationName) { return true }
            if isNeighborhoodWorship(spot.name, stationName: stationName) { return false }
            return true
        }
        return collapseWorshipDuplicates(filtered, stationName: stationName)
    }
}
