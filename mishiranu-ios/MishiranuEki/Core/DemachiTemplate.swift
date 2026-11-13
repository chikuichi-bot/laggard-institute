import Foundation

/// 出町柳雛形 — 役割は全駅共通。固有名は出町だけ。
enum DemachiTemplate {
    /// 出町柳の顔の固有名。他駅では「構成の見本」であって、この名前を出さない。
    /// 短い語（枡形・下鴨・デルタ）も他駅では出町の顔扱い（シーダーが起こしてしまう）。
    private static let exclusiveNeedles = [
        "鴨川デルタ", "デルタ", "三角州", "河川敷",
        "下鴨神社", "賀茂御祖", "糺の森", "下鴨",
        "枡形商店街", "桝形商店街", "出町枡形", "出町桝形", "枡形", "桝形",
        "出町ふたば", "満寿形屋", "加茂みたらし", "百万遍",
        "同志社大学", "京都大学",
    ]

    /// 出町柳の確定ピン。駅座標がここにあると、周辺検索が出町の店になる。
    private static let exclusivePins: [(lat: Double, lng: Double)] = [
        (35.0301227, 135.7717415), // 鴨川デルタ
        (35.030249, 135.769436),   // 枡形
        (35.0387, 135.7727),       // 下鴨
        (35.0301072, 135.7696274), // ふたば
        (35.0272, 135.7808),       // 京大
        (35.029714, 135.760715),   // 同志社
    ]

    /// ショート候補が駅から遠すぎない上限（出町座標の誤流用）。
    static let firstVisitMaxKm: Double = 3.2

    static func isDemachiStationName(_ name: String) -> Bool {
        let bare = SavedStationStore.bareName(name)
        return bare.contains("出町柳") || bare == "出町"
    }

    static func isDemachiExclusivePlaceName(_ placeName: String) -> Bool {
        exclusiveNeedles.contains { placeName.contains($0) }
    }

    /// 出町の確定ピンのそば（他駅のコースに混ざった座標）。
    static func isOnDemachiPin(lat: Double, lng: Double) -> Bool {
        exclusivePins.contains { pin in
            Geo.haversineKm(lat1: lat, lng1: lng, lat2: pin.lat, lng2: pin.lng) < 0.45
        }
    }

    /// 他駅に出町の固有名が混ざっていないか。
    static func isForeignDemachiPlace(_ placeName: String, stationName: String) -> Bool {
        if isDemachiStationName(stationName) { return false }
        return isDemachiExclusivePlaceName(placeName)
    }

    static func spotNearStation(_ spot: Spot, station: Station) -> Bool {
        if isForeignDemachiPlace(spot.name, stationName: station.name) { return false }
        if !isDemachiStationName(station.name), isOnDemachiPin(lat: spot.lat, lng: spot.lng) {
            return false
        }
        guard spot.lat != 0 || spot.lng != 0 else {
            return spot.walkMinutes <= 40
        }
        let km = Geo.haversineKm(
            lat1: station.lat, lng1: station.lng,
            lat2: spot.lat, lng2: spot.lng
        )
        return km <= firstVisitMaxKm
    }

    /// 保存済み駅に出町の固有名や遠すぎる座標が混ざっていたら落とす。
    static func scrubContamination(on station: Station) -> Station {
        guard !isDemachiStationName(station.name) else { return station }
        let spots = station.spots.filter { spot in
            if WalkInMealFilter.isNonWalkIn(spot) { return false }
            if isForeignDemachiPlace(spot.name, stationName: station.name) { return false }
            if isForeignDemachiPlace(spot.blurb, stationName: station.name) { return false }
            if isForeignDemachiPlace(spot.detail ?? "", stationName: station.name) { return false }
            if sentenceHasExclusivePlace(spot.blurb) || sentenceHasExclusivePlace(spot.detail ?? "") {
                return false
            }
            if isOnDemachiPin(lat: spot.lat, lng: spot.lng) { return false }
            let km = Geo.haversineKm(
                lat1: station.lat, lng1: station.lng,
                lat2: spot.lat, lng2: spot.lng
            )
            // 出町〜八瀬は約5km。遠すぎる顔は出町コピーの温床なので 3.2km で切る。
            return km <= firstVisitMaxKm
        }
        let sightseeing = station.sightseeingNotes.filter {
            !isForeignDemachiPlace($0.title, stationName: station.name)
                && !sentenceHasExclusivePlace($0.title)
                && !sentenceHasExclusivePlace($0.body)
        }
        let history = station.historyNotes.filter {
            !isForeignDemachiPlace($0.title, stationName: station.name)
                && !sentenceHasExclusivePlace($0.title)
        }.map {
            HistoryNote(
                title: $0.title,
                body: stripExclusiveSentences($0.body) ?? ""
            )
        }.filter { !$0.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        return Station(
            id: station.id,
            name: station.name,
            nameReading: station.nameReading,
            line: station.line,
            prefecture: station.prefecture,
            region: station.region,
            mood: station.mood,
            radiiKm: station.radiiKm,
            stationIntro: stripExclusiveSentences(station.stationIntro),
            areaAbout: stripExclusiveSentences(station.areaAbout),
            walkGuide: stripExclusiveSentences(station.walkGuide),
            historyNotes: history,
            sightseeingNotes: sightseeing,
            storyNotes: station.storyNotes.filter {
                !isForeignDemachiPlace($0.title, stationName: station.name)
                    && !sentenceHasExclusivePlace($0.body)
            },
            bikeRental: station.bikeRental,
            tourTitle: stripExclusiveSentences(station.tourTitle) ?? station.tourTitle,
            catchCopy: stripExclusiveSentences(station.catchCopy) ?? station.catchCopy,
            emptyCopy: station.emptyCopy,
            railHint: station.railHint,
            lat: station.lat,
            lng: station.lng,
            spots: spots
        )
    }

    /// コース立ち寄りから出町の顔を最後にもう一度落とす。
    static func filterWalkSpots(_ spots: [Spot], station: Station) -> [Spot] {
        guard !isDemachiStationName(station.name) else { return spots }
        return spots.filter { spotNearStation($0, station: station) }
    }

    static func sentenceHasExclusivePlace(_ text: String) -> Bool {
        exclusiveNeedles.contains { text.contains($0) }
    }

    /// 出町の顔の文だけ落とす。貴船などその駅の文は残す。
    static func stripExclusiveSentences(_ text: String?) -> String? {
        guard let text, !text.isEmpty else { return text }
        let parts = text.components(separatedBy: "。")
        let kept = parts.filter { part in
            let t = part.trimmingCharacters(in: .whitespacesAndNewlines)
            if t.isEmpty { return true }
            return !sentenceHasExclusivePlace(t)
        }
        let joined = kept.joined(separator: "。")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if joined.isEmpty { return nil }
        if text.hasSuffix("。"), !joined.hasSuffix("。"), joined.contains("。") || kept.count > 1 {
            return joined.hasSuffix("。") ? joined : joined + "。"
        }
        return joined
    }
}
