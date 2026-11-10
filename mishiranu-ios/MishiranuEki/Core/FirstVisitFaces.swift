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

    /// 採取・保存データの両方で、近所の社寺を落とす。
    static func filterSpots(_ spots: [Spot], stationName: String) -> [Spot] {
        spots.filter { spot in
            if LandmarkRegistry.isLocked(spot, stationName: stationName) { return true }
            if isNeighborhoodWorship(spot.name, stationName: stationName) { return false }
            return true
        }
    }
}
