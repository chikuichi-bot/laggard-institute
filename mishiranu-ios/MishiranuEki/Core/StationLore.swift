import Foundation

/// 駅の歴史文から、降りた瞬間・歩く途中に渡す「一片」を拾う。
/// 図鑑として全部見せず、名前が出てくる一文だけを差し出す。
enum StationLore {
    /// 到着の最初の一文。型は同じでも、駅の言葉の温度で選ぶ。
    static func arrivalFragment(for station: Station, on date: Date = Date()) -> (title: String, line: String)? {
        let bare = SavedStationStore.bareName(station.name)
        let face = station.spots.first {
            ($0.majorWorthy || $0.guide == .sight)
                && !FirstVisitFaces.isNeighborhoodWorship($0.name, stationName: station.name)
                && !$0.id.hasPrefix("reach-")
        }?.name
        let day = Calendar.current.ordinality(of: .day, in: .era, for: date) ?? 0
        let seed = station.id.unicodeScalars.reduce(0) { $0 + Int($1.value) } + day
        if let own = warmestSentence(in: station, face: face, bare: bare, seed: seed) {
            return (temperatureTitle(station), own)
        }
        let copy = station.catchCopy.trimmingCharacters(in: .whitespacesAndNewlines)
        let clause = temperatureClause(station)
        if copy.count >= 8, !copy.contains("予定のない寄り道") {
            return (temperatureTitle(station), "\(bare)は、\(clause)。\(copy)")
        }
        if let face {
            return (temperatureTitle(station), "\(bare)は、\(clause)。最初に向かうのは\(face)。")
        }
        return (temperatureTitle(station), "\(bare)は、\(clause)。")
    }

    /// 駅自身の文から、感覚のある一文を選ぶ。案内口調は落とす。
    private static func warmestSentence(in station: Station, face: String?, bare: String, seed: Int) -> String? {
        var pool: [String] = []
        pool.append(contentsOf: sentences(station.catchCopy))
        pool.append(contentsOf: station.historyNotes.flatMap { sentences($0.body) })
        pool.append(contentsOf: sentences(station.areaAbout))
        pool.append(contentsOf: sentences(station.stationIntro))
        pool.append(contentsOf: station.sightseeingNotes.flatMap { sentences($0.body) })
        let scored: [(String, Int)] = pool.map { line in
            var score = 0
            if let face, line.contains(face) { score += 18 }
            if let face {
                let key = String(face.prefix(4))
                if key.count >= 2, line.contains(key) { score += 10 }
            }
            if line.contains(bare) { score += 8 }
            let sensory = ["音", "匂い", "におい", "光", "風", "川", "湯", "森", "潮", "石", "雨", "影", "静"]
            if sensory.contains(where: { line.contains($0) }) { score += 16 }
            let dry = ["要確認", "徒歩", "あります", "ご確認", "案内します", "おすすめ"]
            if dry.contains(where: { line.contains($0) }) { score -= 24 }
            return (line, score)
        }.filter { $0.1 >= 12 && $0.0.count >= 12 && $0.0.count <= 80 }
        guard !scored.isEmpty else { return nil }
        let best = scored.map(\.1).max() ?? 0
        let ties = scored.filter { $0.1 == best }.map(\.0)
        return ties[seed % ties.count]
    }

    private static func temperatureTitle(_ station: Station) -> String {
        switch temperatureKind(station) {
        case .water: return "川の端"
        case .tide: return "潮の手前"
        case .shrine: return "社の前"
        case .food: return "食べもののほう"
        case .castle: return "城の影"
        case .town: return "町の入口"
        }
    }

    private static func temperatureClause(_ station: Station) -> String {
        switch temperatureKind(station) {
        case .water: return "川の音から入る"
        case .tide: return "潮のにおいから入る"
        case .shrine: return "社の静けさから入る"
        case .food: return "食べものから入る"
        case .castle: return "城の影から入る"
        case .town: return "町の通りから入る"
        }
    }

    private enum Temperature { case water, tide, shrine, food, castle, town }

    private static func temperatureKind(_ station: Station) -> Temperature {
        let blob = [
            station.name, station.catchCopy, station.areaAbout ?? "",
            station.stationIntro ?? "",
        ].joined() + station.spots.prefix(6).map(\.name).joined()
        if blob.contains("デルタ") || blob.contains("川") || blob.contains("河") || blob.contains("橋") {
            return .water
        }
        if blob.contains("港") || blob.contains("海") || blob.contains("潮") || blob.contains("浜") {
            return .tide
        }
        if blob.contains("城") { return .castle }
        if blob.contains("神社") || blob.contains("神宮") || blob.contains("大社") || blob.contains("寺") {
            return .shrine
        }
        if blob.contains("市場") || blob.contains("食堂") || blob.contains("パン") { return .food }
        return .town
    }

    /// 土地ページ本文（紹介・界隈・歴史・観光メモ）を一塊にした検索用テキスト。
    static func landCorpus(_ station: Station) -> String {
        ([
            station.stationIntro,
            station.areaAbout,
            station.walkGuide,
            station.catchCopy,
        ].compactMap { $0 }
            + station.historyNotes.flatMap { [$0.title, $0.body] }
            + station.sightseeingNotes.flatMap { [$0.title, $0.body] }
            + station.storyNotes.flatMap { [$0.title, $0.body] }
        ).joined(separator: "\n")
    }

    /// 歩くコース用。回り方の文を先に置き、土地文の流れ＝歩く順にする。
    static func landWalkCorpus(_ station: Station) -> String {
        ([
            station.walkGuide,
            station.stationIntro,
            station.areaAbout,
            station.catchCopy,
        ].compactMap { $0 }
            + station.sightseeingNotes.flatMap { [$0.title, $0.body] }
            + station.storyNotes.flatMap { [$0.title, $0.body] }
            + station.historyNotes.flatMap { [$0.title, $0.body] }
        ).joined(separator: "\n")
    }

    /// 土地紹介で触れた場所／土地の顔。案内・歩く・地図の正本にする。
    static func introducedVisitSpots(in station: Station) -> [Spot] {
        let sealed = CourseBuilder.snapLandmarkPins(
            LandMentionSeeder.ensure(
                on: CourseBuilder.normalizeEdibleSouvenirs(station)
            )
        )
        let corpus = landCorpus(sealed)
        var picks: [Spot] = []
        var seen = Set<String>()
        for spot in sealed.spots {
            if spot.name.hasSuffix("駅") { continue }
            if PlaceNoise.isNoise(spot.name) { continue }
            if FirstVisitFaces.isNeighborhoodWorship(spot.name, stationName: sealed.name) {
                continue
            }
            let key = NameMatch.normalize(spot.name)
            guard !key.isEmpty, seen.insert(key).inserted else { continue }
            let locked = LandmarkRegistry.isLocked(spot, stationName: sealed.name)
            let namedInLand = nameKeys(spot.name).contains { key in
                key.count >= 2 && corpus.contains(key)
            }
            // 案内・地図: 名所印・土地文に加え、ご飯／土産／休む／ちょい寄りも落とさない
            let usefulGuide =
                spot.guide == .meal || spot.guide == .souvenir
                || spot.guide == .rest || spot.guide == .tip
                || spot.guide == .story
            if locked || spot.majorWorthy || namedInLand || usefulGuide {
                picks.append(spot)
            }
        }
        // 土地文に名前が無いときでも、顔（major）は必ず訪れる側に残す
        if picks.isEmpty {
            picks = sealed.spots.filter {
                $0.majorWorthy
                    && !$0.name.hasSuffix("駅")
                    && !FirstVisitFaces.isNeighborhoodWorship($0.name, stationName: sealed.name)
                    && !PlaceNoise.isNoise($0.name)
            }
        }
        // 案内・地図の一覧は駅から近い順（名所印より距離を優先）
        return picks.sorted { lhs, rhs in
            let dL = Geo.haversineKm(
                lat1: sealed.lat, lng1: sealed.lng, lat2: lhs.lat, lng2: lhs.lng
            )
            let dR = Geo.haversineKm(
                lat1: sealed.lat, lng1: sealed.lng, lat2: rhs.lat, lng2: rhs.lng
            )
            if abs(dL - dR) > 0.03 { return dL < dR }
            if lhs.walkMinutes != rhs.walkMinutes { return lhs.walkMinutes < rhs.walkMinutes }
            if lhs.majorWorthy != rhs.majorWorthy { return lhs.majorWorthy && !rhs.majorWorthy }
            return lhs.name < rhs.name
        }
    }

    /// 土地ページの文章から、登場順に歩く場所を組み立てる（正本）。
    /// 文が先・スポットが後。ご飯は文に出てきたときだけ。
    static func landNarrativeSpots(in station: Station) -> [Spot] {
        let sealed = CourseBuilder.snapLandmarkPins(
            LandMentionSeeder.ensure(
                on: CourseBuilder.normalizeEdibleSouvenirs(station)
            )
        )
        let corpus = landWalkCorpus(sealed)
        guard !corpus.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return [] }

        var ranked: [(offset: Int, spot: Spot)] = []
        var claimed = Set<String>()

        // 1) 文章から抜き出した場所名 → 既存スポット or シード
        for mention in LandMentionSeeder.extractMentions(from: corpus) {
            if PlaceNoise.isNoise(mention.phrase) { continue }
            if DemachiTemplate.isForeignDemachiPlace(mention.phrase, stationName: sealed.name) {
                continue
            }
            guard let spot = resolveSpot(mention.phrase, in: sealed.spots, claimed: &claimed)
            else { continue }
            if DemachiTemplate.isForeignDemachiPlace(spot.name, stationName: sealed.name) {
                continue
            }
            ranked.append((mention.offset, withLandVoice(spot, corpus: corpus)))
        }

        // 2) スポット名が本文に出ているもの（ふたば等・接尾辞無し）を足す
        for spot in sealed.spots {
            if spot.name.hasSuffix("駅") { continue }
            if PlaceNoise.isNoise(spot.name) { continue }
            if FirstVisitFaces.isNeighborhoodWorship(spot.name, stationName: sealed.name) {
                continue
            }
            let idKey = NameMatch.normalize(spot.name)
            guard !idKey.isEmpty, !claimed.contains(idKey) else { continue }
            let offsets = nameKeys(spot.name).compactMap { token -> Int? in
                guard token.count >= 2, let range = corpus.range(of: token) else { return nil }
                return corpus.distance(from: corpus.startIndex, to: range.lowerBound)
            }
            guard let first = offsets.min() else { continue }
            claimed.insert(idKey)
            ranked.append((first, withLandVoice(spot, corpus: corpus)))
        }

        return ranked.sorted { $0.offset < $1.offset }.map(\.spot)
    }

    private static func resolveSpot(
        _ phrase: String,
        in spots: [Spot],
        claimed: inout Set<String>
    ) -> Spot? {
        if let hit = spots.first(where: {
            LandMentionSeeder.mentions($0.name, phrase: phrase)
                && !claimed.contains(NameMatch.normalize($0.name))
        }) {
            claimed.insert(NameMatch.normalize(hit.name))
            return hit
        }
        let key = NameMatch.normalize(phrase)
        guard claimed.insert(key).inserted else { return nil }
        return spots.first { NameMatch.normalize($0.name) == key }
    }

    /// 土地文の一文を、歩くときの声にする。
    private static func withLandVoice(_ spot: Spot, corpus: String) -> Spot {
        guard let line = sentence(containingAny: nameKeys(spot.name), in: corpus)
            ?? sentence(containing: spot.name, in: corpus)
        else { return spot }
        if spot.blurb == line { return spot }
        return Spot(
            id: spot.id,
            name: spot.name,
            genre: spot.genre,
            guide: spot.guide,
            mealTier: spot.mealTier,
            mealTimes: spot.mealTimes,
            soloOk: spot.soloOk,
            budgetYen: spot.budgetYen,
            hours: spot.hours,
            blurb: line,
            detail: spot.detail,
            walkMinutes: spot.walkMinutes,
            secretWorthy: spot.secretWorthy,
            majorWorthy: spot.majorWorthy,
            lat: spot.lat,
            lng: spot.lng
        )
    }

    /// その場所の名前が出てくる、土地の記憶の一文。なければ nil（無理に埋めない）。
    static func trace(for spot: Spot, in station: Station) -> String? {
        let keys = nameKeys(spot.name)
        guard !keys.isEmpty else { return nil }
        let pool: [String] =
            sentences(station.walkGuide)
            + sentences(station.stationIntro)
            + sentences(station.areaAbout)
            + station.sightseeingNotes.flatMap { sentences($0.body) }
            + station.historyNotes.flatMap { sentences($0.body) }
        let blurb = spot.blurb
        for key in keys {
            if let hit = pool.first(where: { $0.contains(key) && !blurb.contains($0) }) {
                return hit
            }
        }
        return nil
    }

    /// 「下鴨神社（賀茂御祖神社）」→ ["下鴨神社（賀茂御祖神社）", "下鴨神社", "賀茂御祖神社"]
    /// 「出町枡形商店街」→ 枡形 / 枡形商店街 も土地文照合用に足す。
    static func nameKeys(_ name: String) -> [String] {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        var keys: [String] = [trimmed]
        let parts = trimmed
            .components(separatedBy: CharacterSet(charactersIn: "（）()「」 　・/"))
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { $0.count >= 3 }
        keys.append(contentsOf: parts)
        for suffix in ["本店", "駅前店", "店"] where trimmed.hasSuffix(suffix) {
            let core = String(trimmed.dropLast(suffix.count))
            if core.count >= 3 { keys.append(core) }
        }
        for suffix in LandMentionSeeder.placeSuffixes {
            guard let range = trimmed.range(of: suffix) else { continue }
            let before = String(trimmed[..<range.lowerBound])
            if before.count >= 2 { keys.append(before) }
            if before.count >= 4 { keys.append(String(before.suffix(2))) }
            if before.count >= 2 { keys.append(before + suffix) }
        }
        // 出町ふたば → ふたば（土地文が短い店名だけ書くとき）
        for prefix in ["出町", "下鴨", "河原町", "三条", "四条", "今出川"] {
            if trimmed.hasPrefix(prefix) {
                let rest = String(trimmed.dropFirst(prefix.count))
                if rest.count >= 2 { keys.append(rest) }
            }
        }
        if trimmed.contains("枡形") { keys.append("桝形"); keys.append("枡形") }
        if trimmed.contains("桝形") { keys.append("枡形"); keys.append("桝形") }
        if trimmed.contains("ふたば") { keys.append("ふたば") }
        if trimmed.contains("みたらし") { keys.append("みたらし") }
        var seen = Set<String>()
        return keys.filter { $0.count >= 2 && seen.insert($0).inserted }
    }

    /// キーを含む一文を土地文から取る。
    static func sentence(containing needle: String, in corpus: String) -> String? {
        sentence(containingAny: [needle], in: corpus)
    }

    static func sentence(containingAny needles: [String], in corpus: String) -> String? {
        let usable = needles.filter { $0.count >= 2 }
        guard !usable.isEmpty else { return nil }
        for line in sentences(corpus) {
            if usable.contains(where: { line.contains($0) }) { return line }
        }
        return nil
    }

    static func sentences(_ text: String?) -> [String] {
        guard let text, !text.isEmpty else { return [] }
        var out: [String] = []
        var current = ""
        for ch in text {
            if ch == "\n" {
                // 改行も文区切りに使う（段落の土地文向け）
                let s = current.trimmingCharacters(in: .whitespacesAndNewlines)
                if s.count >= 8 { out.append(s) }
                current = ""
                continue
            }
            current.append(ch)
            if "。！？".contains(ch) {
                let s = current.trimmingCharacters(in: .whitespacesAndNewlines)
                if s.count >= 8 { out.append(s) }
                current = ""
            }
        }
        let rest = current.trimmingCharacters(in: .whitespacesAndNewlines)
        if rest.count >= 8 { out.append(rest) }
        return out
    }
}
