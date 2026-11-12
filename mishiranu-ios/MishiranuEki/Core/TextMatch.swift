import Foundation

/// 会話の自由入力を選択肢に読み替える。
enum TextMatch {
    private static func has(_ text: String, _ pattern: String) -> Bool {
        text.range(of: pattern, options: .regularExpression) != nil
    }

    static func station(_ text: String, in stations: [Station]) -> Station? {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return nil }
        let bare = t.hasSuffix("駅") ? String(t.dropLast()) : t
        if let byName = stations.first(where: { t.contains($0.name) || (!bare.isEmpty && $0.name.contains(bare)) }) {
            return byName
        }
        return stations.first { s in
            if t.contains(s.prefecture) || t.contains(s.line) { return true }
            return s.line
                .split(whereSeparator: { $0 == "/" || $0 == "・" })
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .contains { !$0.isEmpty && t.contains($0) }
        }
    }

    /// 空クエリは保存済みだけ（ごちゃつかせない）。文字入力で全国カタログを絞る。
    static func filterStations(
        _ query: String,
        in stations: [Station],
        savedIds: Set<String> = [],
        limit: Int = 8
    ) -> [Station] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let bare = q.hasSuffix("駅") ? String(q.dropLast()) : q
        let pool: [Station]
        if q.isEmpty {
            pool = stations.filter { savedIds.contains($0.id) }
        } else {
            // 「淀駅」入力でも name「淀」に当たるように、駅の有無を揃えて見る。
            pool = stations.filter {
                let nameBare = $0.name.hasSuffix("駅") ? String($0.name.dropLast()) : $0.name
                return $0.name.contains(q)
                    || $0.name.contains(bare)
                    || nameBare.contains(bare)
                    || bare.contains(nameBare)
                    || $0.prefecture.contains(q)
                    || $0.line.contains(q)
                    || $0.tourTitle.contains(q)
                    || (!bare.isEmpty && ($0.prefecture.contains(bare) || $0.line.contains(bare)))
            }
        }
        return Array(pool.prefix(limit))
    }

    static func stay(_ text: String) -> StayOption? {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if has(t, "半日|午後いっぱい|半にち") { return .halfDay }
        if has(t, "3\\s*時間|三時間|さんじかん|半日未満|ゆっくり") { return .threeHours }
        if has(t, "1\\s*時間|一時間|ひと時間|ちょっと|短め|すぐ") { return .oneHour }
        return StayOption.allCases.first { t.contains($0.label) }
    }

    static func dayPart(_ text: String) -> DayPart? {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if has(t, "朝|あさ|午前早く|モーニング|朝食") { return .morning }
        if has(t, "昼まえ|午前|ランチ前|午前中") { return .midday }
        if has(t, "昼すぎ|午後|ひるすぎ|ランチ後") { return .afternoon }
        if has(t, "夕方|夕暮れ|ゆうがた|薄暮") { return .evening }
        if has(t, "夜|よる|夕食|ディナー|夜分") { return .night }
        if let r = t.range(of: "[0-9０-９]{1,2}\\s*時", options: .regularExpression) {
            let digits = t[r].compactMap { $0.wholeNumberValue }
            if !digits.isEmpty {
                return DayPart.from(hour: digits.reduce(0) { $0 * 10 + $1 })
            }
        }
        return nil
    }

    static func solo(_ text: String) -> SoloPref? {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if has(t, "一人|ひとり|ソロ|おひとり") { return .solo }
        if has(t, "みんな|複数|二人|ふたり|グループ|連れ|同伴") { return .together }
        if has(t, "どちら|気にし|問わ|なんでも|おまかせ|関係な") { return .either }
        return nil
    }

    static func budget(_ text: String) -> BudgetPref? {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if has(t, "奮発|高級|高め|フォーマル|会席|贅沢|ぜいたく|3\\s*000|3000|五千|万円") { return .upscale }
        if has(t, "気軽|安め|安い|庶民|ランチ|軽く|千円|1500|〜¥|~¥|カジュアル") { return .casual }
        if has(t, "どちら|なんでも|おまかせ|問わ|気にし") { return .either }
        return BudgetPref.allCases.first { t.contains($0.label) }
    }

    static func skipsCourse(_ text: String) -> Bool {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return has(t, "コース\\s*(は)?\\s*(作らない|なし|要らない|いらない)")
            || has(t, "まわり方\\s*(は)?\\s*(決めない|作らない|なし|要らない|いらない)")
            || has(t, "自由に歩く")
            || has(t, "^(なし|作らない|スキップ|フリー|自由に|行程なし)$")
    }
}
