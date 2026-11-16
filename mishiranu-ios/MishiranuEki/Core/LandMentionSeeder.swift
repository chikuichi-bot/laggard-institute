import CoreLocation
import Foundation

/// 土地ページの文章に出てくる場所を拾い、歩くコースの素材にする。
/// 出町の枡形に限らず、どの駅でも同じ規則で動く。
enum LandMentionSeeder {
    /// 長い接尾辞を先に（「三角州」が「州」より先など）。
    static let placeSuffixes = [
        "商店街", "商店会", "三角州", "八幡宮", "天満宮", "美術館", "博物館",
        "朝市", "市場", "参道", "並木", "公園", "デルタ", "河原", "鉄橋", "堤防",
        "桟橋", "灯台", "城跡", "茶屋", "本舗", "神宮", "神社", "大社", "大学",
        "の森", "ケーブル", "ロープウェイ", "橋", "寺", "院", "城", "港", "山",
    ]

    /// 「枡形」だけ書かれても商店街として拾う短い地名。
    private static let arcadeStems = ["枡形", "桝形"]

    /// 土地文から場所名を拾い、欠けていればスポットを足す。
    static func ensure(on station: Station) -> Station {
        let corpus = StationLore.landWalkCorpus(station)
        guard !corpus.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return station
        }
        let phrases = extractMentions(from: corpus).map(\.phrase)
        guard !phrases.isEmpty else { return station }

        var spots = station.spots
        for phrase in phrases {
            if PlaceNoise.isNoise(phrase) { continue }
            // 出町の固有名は雛形の見本。他駅の文章に混ざっていてもスポットにしない。
            if DemachiTemplate.isForeignDemachiPlace(phrase, stationName: station.name) { continue }
            if let idx = spots.firstIndex(where: { mentions($0.name, phrase: phrase) }) {
                // 既存でも大学など正本ピンがあれば座標を上書き（デルタ寄せを残さない）
                if let pin = knownPin(phrase: phrase, station: station) {
                    let cur = spots[idx]
                    spots[idx] = Spot(
                        id: cur.id, name: cur.name, genre: cur.genre, guide: cur.guide,
                        mealTier: cur.mealTier, mealTimes: cur.mealTimes, soloOk: cur.soloOk,
                        budgetYen: cur.budgetYen, hours: cur.hours, blurb: cur.blurb,
                        detail: cur.detail, walkMinutes: pin.walkMinutes,
                        secretWorthy: cur.secretWorthy, majorWorthy: cur.majorWorthy,
                        lat: pin.lat, lng: pin.lng, coordTrust: .lock
                    )
                }
                continue
            }
            spots.append(makeSpot(phrase: phrase, station: station, corpus: corpus))
        }
        return station.relocated(
            center: CLLocationCoordinate2D(latitude: station.lat, longitude: station.lng),
            spots: spots
        )
    }

    private struct KnownPin {
        let lat: Double
        let lng: Double
        let walkMinutes: Int
    }

    /// 出町柳など、仮オフセットでは置けない顔の正本座標。
    private static func knownPin(phrase: String, station: Station) -> KnownPin? {
        guard station.name.contains("出町柳") else { return nil }
        if phrase.contains("京都大学") || phrase == "京大" {
            return KnownPin(lat: 35.0272, lng: 135.7808, walkMinutes: 14)
        }
        if phrase.contains("同志社大学") || phrase == "同志社" {
            return KnownPin(lat: 35.029714, lng: 135.760715, walkMinutes: 15)
        }
        if phrase.contains("枡形") || phrase.contains("桝形") {
            return KnownPin(
                lat: LandmarkRegistry.demachiMasugataya.latitude,
                lng: LandmarkRegistry.demachiMasugataya.longitude,
                walkMinutes: 3
            )
        }
        if phrase.contains("デルタ") || phrase.contains("三角州") {
            return KnownPin(
                lat: LandmarkRegistry.demachiDelta.latitude,
                lng: LandmarkRegistry.demachiDelta.longitude,
                walkMinutes: 2
            )
        }
        return nil
    }

    /// 本文登場順の (位置, 場所名)。歩くコースの骨。
    static func extractMentions(from corpus: String) -> [(offset: Int, phrase: String)] {
        var found: [(offset: Int, phrase: String)] = []
        var seen = Set<String>()

        let suffixAlt = placeSuffixes.joined(separator: "|")
        // 助詞を含む文節を飲み込まないよう、直前は漢字・カタカナ中心。
        let pattern = "([一-龥ァ-ヶーA-Za-z0-9]{1,12})(\(suffixAlt))"
        if let regex = try? NSRegularExpression(pattern: pattern, options: []) {
            let range = NSRange(corpus.startIndex..<corpus.endIndex, in: corpus)
            regex.enumerateMatches(in: corpus, options: [], range: range) { match, _, _ in
                guard let match,
                      match.numberOfRanges >= 3,
                      let full = Range(match.range, in: corpus),
                      let beforeR = Range(match.range(at: 1), in: corpus),
                      let suffixR = Range(match.range(at: 2), in: corpus)
                else { return }
                let before = String(corpus[beforeR])
                let suffix = String(corpus[suffixR])
                let polished = polishPlaceName(before: before, suffix: suffix)
                guard isPlausiblePlace(polished) else { return }
                let key = NameMatch.normalize(polished)
                guard seen.insert(key).inserted else { return }
                // オフセットは磨き後の地名先頭へ寄せる
                let trim = before.count - (polished.count - suffix.count)
                let start = corpus.index(full.lowerBound, offsetBy: max(0, trim))
                let offset = corpus.distance(from: corpus.startIndex, to: start)
                found.append((offset, polished))
            }
        }

        // みたらし茶屋 などひらがな屋号
        let soft = "([ぁ-んァ-ヶ一-龥]{2,8})(茶屋|本舗|屋)"
        if let softRe = try? NSRegularExpression(pattern: soft, options: []) {
            let range = NSRange(corpus.startIndex..<corpus.endIndex, in: corpus)
            softRe.enumerateMatches(in: corpus, options: [], range: range) { match, _, _ in
                guard let match, let full = Range(match.range, in: corpus) else { return }
                let phrase = String(corpus[full])
                guard isPlausiblePlace(phrase) else { return }
                let key = NameMatch.normalize(phrase)
                guard seen.insert(key).inserted else { return }
                let offset = corpus.distance(from: corpus.startIndex, to: full.lowerBound)
                found.append((offset, phrase))
            }
        }

        for stem in arcadeStems {
            guard let range = corpus.range(of: stem) else { continue }
            let phrase = "\(stem)商店街"
            let key = NameMatch.normalize(phrase)
            guard seen.insert(key).inserted else { continue }
            let offset = corpus.distance(from: corpus.startIndex, to: range.lowerBound)
            found.append((offset, phrase))
        }

        return found.sorted { $0.offset < $1.offset }
    }

    /// 「北方下鴨」→「下鴨」のように、接尾辞直前の地名核だけ残す。
    private static func polishPlaceName(before: String, suffix: String) -> String {
        // 末尾の漢字・カタカナ塊（2〜8字）を優先
        let chars = Array(before)
        var end = chars.count
        var start = end
        while start > 0 {
            let ch = chars[start - 1]
            let s = String(ch)
            let ok = s.range(of: "[一-龥ァ-ヶーA-Za-z0-9]", options: .regularExpression) != nil
            if !ok { break }
            start -= 1
            if end - start >= 8 { break }
        }
        let core = String(chars[start..<end])
        if core.count >= 1 { return core + suffix }
        return before + suffix
    }

    private static func isPlausiblePlace(_ phrase: String) -> Bool {
        if phrase.count < 3 || phrase.count > 16 { return false }
        if PlaceNoise.isNoise(phrase) { return false }
        let junk = ["を", "が", "は", "に", "へ", "で", "と", "も", "や", "から", "まで", "たら", "れば", "など", "あれば", "まず", "北方の"]
        if junk.contains(where: { phrase.contains($0) }) { return false }
        return true
    }

    static func mentions(_ spotName: String, phrase: String) -> Bool {
        if NameMatch.score(spotName, phrase) >= 78 { return true }
        if spotName.contains(phrase) || phrase.contains(spotName) { return true }
        let keys = StationLore.nameKeys(spotName)
        return keys.contains {
            phrase.contains($0) || $0.contains(phrase) || NameMatch.score($0, phrase) >= 80
        }
    }

    private static func makeSpot(phrase: String, station: Station, corpus: String) -> Spot {
        let isDelta = phrase.contains("デルタ") || phrase.contains("三角州")
        let isArcade = phrase.contains("商店街") || phrase.contains("市場")
        let isUniversity = phrase.contains("大学") || phrase.contains("キャンパス")
        let guide: GuideKind = {
            if phrase.contains("公園") || phrase.contains("河原") || isDelta
                || phrase.contains("の森") {
                return .rest
            }
            if phrase.contains("茶屋") || phrase.contains("本舗") {
                return .meal
            }
            return .sight
        }()
        let walk: Int = {
            if station.name.contains("出町柳"), isDelta { return 2 }
            if isArcade { return 3 }
            if isUniversity { return 14 }
            return 8
        }()
        let known = knownPin(phrase: phrase, station: station)
        let pin: (Double, Double) = {
            if let known { return (known.lat, known.lng) }
            // 大学など遠い顔は駅に仮ピンを打たない（近い順を壊す）
            if isUniversity {
                return (station.lat + 0.0045, station.lng + 0.0045)
            }
            return (station.lat + 0.00015, station.lng - 0.0002)
        }()
        let walkMinutes = known?.walkMinutes ?? walk
        let landLine = StationLore.sentence(containing: phrase, in: corpus)
        return Spot(
            id: "land-\(NameMatch.normalize(phrase).prefix(28))",
            name: phrase,
            genre: guide == .rest ? "nature" : (guide == .meal ? "gourmet" : "town"),
            guide: guide,
            mealTier: .casual,
            mealTimes: guide == .meal ? [.lunch] : [],
            soloOk: true,
            budgetYen: guide == .meal ? "〜¥1,000" : "—",
            hours: "終日（屋外）",
            blurb: landLine ?? SpotCopy.compose(name: phrase, guide: guide, address: nil),
            detail: "土地の文章で触れられている、この駅の顔。",
            walkMinutes: walkMinutes,
            secretWorthy: false,
            majorWorthy: !isUniversity,
            lat: pin.0,
            lng: pin.1,
            // 正本ピンだけ地図可。駅オフセットの仮座標は地図に出さない。
            coordTrust: known != nil ? .lock : .unverified
        )
    }
}
