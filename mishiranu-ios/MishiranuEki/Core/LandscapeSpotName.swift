import Foundation

/// 川・山などの総称だけだと「駅から見渡せる」ように読めるので、立ち寄り先の名前に直す。
enum LandscapeSpotName {
    /// 表示・コース用の名前。総称だけなら「〜の堤防」などに寄せる。
    static func clarified(_ raw: String) -> String {
        let name = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return name }
        if hasViewpointHint(name) { return name }
        if isBareRiver(name) { return "\(name)の堤防" }
        if isBareMountain(name) { return "\(name)の眺望" }
        return name
    }

    /// 立ち寄り先だと分かる一文（駅ホームから見える、とは書かない）。
    static func walkBlurb(for rawName: String, walkMinutes: Int?) -> String {
        let name = clarified(rawName)
        let walk = walkMinutes.map { "徒歩約\($0)分で寄れる。" } ?? "駅から歩いて寄れる。"
        if name.contains("堤防") || isBareRiver(rawName) {
            return "\(walk)堤防へ出ると川面が開ける。駅のホームから見渡す景色ではない。"
        }
        if name.contains("眺望") || isBareMountain(rawName) {
            return "\(walk)展望の場所へ向かう寄り道。駅から常に見える、という意味ではない。"
        }
        return "\(walk)\(name)へ立ち寄る。"
    }

    static func shouldRewriteBlurb(_ blurb: String, name: String) -> Bool {
        let t = blurb.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty { return true }
        if SpotCopy.isGeneric(t) { return true }
        // 「見渡す／見える／駅前の顔」など、駅から眺める読みを避ける
        if t.contains("見渡") || t.contains("一望") || t.contains("眼下") { return true }
        if t.contains("駅前の顔"), isBareRiver(name) || name.contains("堤防") { return true }
        if isBareRiver(name) || name.hasSuffix("の堤防") { return true }
        return false
    }

    static func apply(to spot: Spot) -> Spot {
        let nextName = clarified(spot.name)
        let nextBlurb: String
        if shouldRewriteBlurb(spot.blurb, name: spot.name) {
            nextBlurb = walkBlurb(for: spot.name, walkMinutes: spot.walkMinutes)
        } else {
            nextBlurb = spot.blurb
        }
        guard nextName != spot.name || nextBlurb != spot.blurb else { return spot }
        return Spot(
            id: spot.id,
            name: nextName,
            genre: spot.genre,
            guide: spot.guide,
            mealTier: spot.mealTier,
            mealTimes: spot.mealTimes,
            soloOk: spot.soloOk,
            budgetYen: spot.budgetYen,
            hours: spot.hours,
            blurb: nextBlurb,
            detail: spot.detail,
            walkMinutes: spot.walkMinutes,
            secretWorthy: spot.secretWorthy,
            majorWorthy: spot.majorWorthy,
            lat: spot.lat,
            lng: spot.lng,
            coordTrust: spot.coordTrust
        )
    }

    static func apply(to station: Station) -> Station {
        let spots = station.spots.map(apply(to:))
        let notes = station.sightseeingNotes.map { note in
            let title = clarified(note.title)
            guard title != note.title else { return note }
            return HistoryNote(title: title, body: note.body)
        }
        guard spots != station.spots || notes != station.sightseeingNotes else { return station }
        return Station(
            id: station.id, name: station.name, nameReading: station.nameReading,
            line: station.line, prefecture: station.prefecture, region: station.region,
            mood: station.mood, radiiKm: station.radiiKm, stationIntro: station.stationIntro,
            areaAbout: station.areaAbout, walkGuide: station.walkGuide,
            historyNotes: station.historyNotes, sightseeingNotes: notes,
            storyNotes: station.storyNotes,
            bikeRental: station.bikeRental, tourTitle: station.tourTitle,
            catchCopy: station.catchCopy, emptyCopy: station.emptyCopy,
            railHint: station.railHint,
            lat: station.lat, lng: station.lng, spots: spots,
            atmosphereCorridors: station.atmosphereCorridors
        )
    }

    private static func hasViewpointHint(_ name: String) -> Bool {
        let keys = ["堤防", "合流", "公園", "橋", "岸", "河原", "緑地", "広場", "展望", "デッキ", "遊歩道", "デルタ", "三角州"]
        return keys.contains { name.contains($0) }
    }

    private static func isBareRiver(_ name: String) -> Bool {
        let t = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard t.hasSuffix("川") || t.hasSuffix("河") else { return false }
        if hasViewpointHint(t) { return false }
        // 「鴨川デルタ」は別扱い。短い「淀川」「桂川」など。
        return t.count <= 5
    }

    private static func isBareMountain(_ name: String) -> Bool {
        let t = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard t.hasSuffix("山") || t.hasSuffix("岳") else { return false }
        if hasViewpointHint(t) { return false }
        return t.count <= 5
    }
}
