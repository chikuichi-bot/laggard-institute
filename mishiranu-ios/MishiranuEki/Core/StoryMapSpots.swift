import Foundation

/// 物語のゆかり（storyNotes）から地図・歩く用のスポットを起こす。
/// 同じ場所に観光・ご飯などがあるときは別ピンにせず合体する。
enum StoryMapSpots {
    /// タイトル「『作品』と場所」から場所名を取る。取れなければ nil。
    static func placeName(fromStoryTitle title: String) -> String? {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if let range = trimmed.range(of: "と") {
            let after = String(trimmed[range.upperBound...])
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if let polished = polishPlace(after) { return polished }
        }
        // 『作品名』だけのときは場所にしない
        if trimmed.hasPrefix("『") { return nil }
        return polishPlace(trimmed)
    }

    private static func polishPlace(_ raw: String) -> String? {
        var s = raw
            .replacingOccurrences(of: "など", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard s.count >= 2 else { return nil }
        if s == "枡形" || s == "桝形" { s = "枡形商店街" }
        // 抽象すぎる語は地図にしない
        let weak = ["川", "海", "町", "入口", "顔", "層", "空気", "朝ドラの海", "出町の川"]
        if weak.contains(s) { return nil }
        if s.hasSuffix("の川") || s.hasSuffix("の海") { return nil }
        let placeish =
            LandMentionSeeder.placeSuffixes.contains { s.contains($0) }
            || s.contains("天満宮")
            || s.contains("鉄橋")
            || s.contains("ふたば")
            || s.contains("走井餅")
            || s.contains("飛行神社")
            || s.contains("デルタ")
            || s.hasSuffix("駅")
        guard placeish else { return nil }
        return s
    }

    /// 地図ピンの色用。他カテゴリを主にし、物語は最下位（単独なら観光に落とす）。
    static func preferredGuide(_ a: GuideKind, _ b: GuideKind) -> GuideKind {
        func rank(_ g: GuideKind) -> Int {
            switch g {
            case .meal: return 60
            case .souvenir: return 50
            case .sight: return 40
            case .rest: return 30
            case .tip: return 20
            case .story: return 0
            }
        }
        let pick = rank(a) >= rank(b) ? a : b
        // 地図では物語を全面に出さない
        return pick == .story ? .sight : pick
    }

    /// 地図用の補足一行（カテゴリ文のあとに足す）。
    static func storySupplement(body: String, title: String? = nil) -> String {
        let t = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else {
            if let title, !title.isEmpty { return "〔物語〕\(title)" }
            return ""
        }
        if let title, !title.isEmpty, !t.contains(title) {
            return "〔物語〕\(title) — \(t)"
        }
        return "〔物語〕\(t)"
    }

    /// 満寿形屋と枡形商店街は別の場所（食堂と通り）。
    static func areDistinctMasugataPlaces(_ a: String, _ b: String) -> Bool {
        func isRestaurant(_ n: String) -> Bool {
            n.contains("満寿形")
        }
        func isArcade(_ n: String) -> Bool {
            (n.contains("枡形") || n.contains("桝形")) && !n.contains("満寿")
        }
        return (isRestaurant(a) && isArcade(b)) || (isRestaurant(b) && isArcade(a))
    }

    /// ご飯／土産と観光・休みは、屋号が違うなら別店舗として扱う。
    static func areConflictingEstablishments(_ a: Spot, _ b: Spot) -> Bool {
        if areDistinctMasugataPlaces(a.name, b.name) { return true }
        let shop: Set<GuideKind> = [.meal, .souvenir]
        let place: Set<GuideKind> = [.sight, .rest, .tip]
        let shopVsPlace =
            (shop.contains(a.guide) && place.contains(b.guide))
            || (shop.contains(b.guide) && place.contains(a.guide))
        guard shopVsPlace else { return false }
        // ほぼ同名だけ合体可。それ以外は別ピン
        return NameMatch.score(a.name, b.name) < 92 && !samePlace(name: a.name, b.name)
    }

    static func samePlace(name a: String, _ b: String) -> Bool {
        if areDistinctMasugataPlaces(a, b) { return false }
        if a == b { return true }
        if NameMatch.score(a, b) >= 80 { return true }
        if a.contains(b) || b.contains(a) { return true }
        return false
    }

    static func samePlace(_ a: Spot, _ b: Spot) -> Bool {
        if a.id == b.id { return true }
        if areDistinctMasugataPlaces(a.name, b.name) { return false }
        if areConflictingEstablishments(a, b) { return false }
        if samePlace(name: a.name, b.name) { return true }
        // 物語と他種が近い座標に重なるとき（約50m）— ただし店と通りは混ぜない
        let storyInvolved = a.guide == .story || b.guide == .story
        guard storyInvolved, a.lat != 0 || a.lng != 0, b.lat != 0 || b.lng != 0 else {
            return false
        }
        let km = Geo.haversineKm(lat1: a.lat, lng1: a.lng, lat2: b.lat, lng2: b.lng)
        return km <= 0.05 && NameMatch.score(a.name, b.name) >= 55
    }

    static func merge(
        _ base: Spot,
        with other: Spot,
        storyBody: String? = nil,
        storyTitle: String? = nil,
        stationName: String
    ) -> Spot {
        let guide = preferredGuide(base.guide, other.guide)
        let trust = preferredTrust(base.coordTrust, other.coordTrust)
        let (lat, lng): (Double, Double) = {
            if trust == base.coordTrust, base.lat != 0 || base.lng != 0 {
                return (base.lat, base.lng)
            }
            if trust == other.coordTrust, other.lat != 0 || other.lng != 0 {
                return (other.lat, other.lng)
            }
            if base.lat != 0 || base.lng != 0 { return (base.lat, base.lng) }
            return (other.lat, other.lng)
        }()
        let name: String = {
            // 短い正式名寄り（「下鴨神社」＞長い注釈）
            if base.name.count <= other.name.count { return base.name }
            return other.name
        }()
        // カテゴリの定番文を主、物語は末尾の〔物語〕だけ
        let primaryGuide = guide == .story ? GuideKind.sight : guide
        let categoryBlurb = SpotCopy.compose(
            name: name,
            guide: primaryGuide,
            address: SpotCopy.nonStoryDetail(base.detail) ?? SpotCopy.nonStoryDetail(other.detail)
        )
        let blurb = withStoryAtEnd(
            primary: categoryBlurb,
            storyBody: storyBody,
            storyTitle: storyTitle,
            extras: [base.blurb, other.blurb]
        )
        let detail: String? = {
            if let storyBody {
                return storySupplement(body: storyBody, title: storyTitle)
            }
            return SpotCopy.nonStoryDetail(base.detail) ?? SpotCopy.nonStoryDetail(other.detail)
        }()
        let merged = Spot(
            id: base.id,
            name: name,
            genre: guide == .meal || guide == .souvenir
                ? (base.genre == "gourmet" || other.genre == "gourmet" ? "gourmet" : base.genre)
                : "history",
            guide: guide,
            mealTier: base.guide == .meal ? base.mealTier : (other.guide == .meal ? other.mealTier : base.mealTier),
            mealTimes: {
                if base.guide == .meal, !base.mealTimes.isEmpty { return base.mealTimes }
                if other.guide == .meal, !other.mealTimes.isEmpty { return other.mealTimes }
                return base.mealTimes
            }(),
            soloOk: base.soloOk && other.soloOk,
            budgetYen: base.guide == .meal ? base.budgetYen : (other.guide == .meal ? other.budgetYen : base.budgetYen),
            hours: {
                let a = base.hours?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                let b = other.hours?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                if !a.isEmpty, a != "—" { return base.hours }
                if !b.isEmpty, b != "—" { return other.hours }
                return base.hours
            }(),
            blurb: blurb,
            detail: detail,
            walkMinutes: min(base.walkMinutes, other.walkMinutes),
            secretWorthy: base.secretWorthy || other.secretWorthy,
            majorWorthy: true,
            lat: lat,
            lng: lng,
            coordTrust: trust
        )
        return LandmarkRegistry.apply(merged, stationName: stationName)
    }

    private static func preferredTrust(_ a: CoordTrust, _ b: CoordTrust) -> CoordTrust {
        func rank(_ t: CoordTrust) -> Int {
            switch t {
            case .lock: return 3
            case .apple: return 2
            case .unverified: return 1
            }
        }
        return rank(a) >= rank(b) ? a : b
    }

    /// 主文のあとに〔物語〕を1回だけ足す。物語本文が主文に混ざっていたら捨てる。
    private static func withStoryAtEnd(
        primary: String,
        storyBody: String?,
        storyTitle: String?,
        extras: [String] = []
    ) -> String {
        var storyBits: [String] = []
        if let storyBody {
            let supp = storySupplement(body: storyBody, title: storyTitle)
            if !supp.isEmpty { storyBits.append(supp) }
        }
        for raw in extras {
            // 既存から〔物語〕だけ回収
            var rest = raw
            let marker = "〔物語〕"
            while let range = rest.range(of: marker) {
                rest = String(rest[range.lowerBound...])
                if let next = rest.range(
                    of: marker,
                    range: rest.index(after: rest.startIndex)..<rest.endIndex
                ) {
                    let chunk = String(rest[..<next.lowerBound])
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                    if !chunk.isEmpty { storyBits.append(chunk.hasPrefix(marker) ? chunk : "\(marker)\(chunk)") }
                    rest = String(rest[next.lowerBound...])
                } else {
                    let chunk = rest.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !chunk.isEmpty { storyBits.append(chunk.hasPrefix(marker) ? chunk : "\(marker)\(chunk)") }
                    break
                }
            }
        }
        var out = [primary.trimmingCharacters(in: .whitespacesAndNewlines)].filter { !$0.isEmpty }
        for bit in storyBits {
            let t = bit.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !t.isEmpty else { continue }
            if out.contains(where: {
                $0 == t || $0.contains(t.replacingOccurrences(of: "〔物語〕", with: ""))
            }) { continue }
            out.append(t.hasPrefix("〔物語〕") ? t : "〔物語〕\(t)")
        }
        // 補足は1本に（長い重複を避ける）
        if out.count > 2 {
            let head = out[0]
            let stories = Array(out.dropFirst())
            let best = stories.max(by: { $0.count < $1.count }) ?? stories[0]
            return "\(head) \(best)"
        }
        return out.joined(separator: " ")
    }

    /// 物語ピンと他種が同場所なら1本に畳む。
    static func collapseOverlaps(_ spots: [Spot], stationName: String) -> [Spot] {
        var result: [Spot] = []
        for spot in spots {
            if let idx = result.firstIndex(where: { samePlace($0, spot) }) {
                let kept = result[idx]
                if kept.guide == .story || spot.guide == .story || samePlace(name: kept.name, spot.name) {
                    result[idx] = merge(kept, with: spot, stationName: stationName)
                } else {
                    result.append(spot)
                }
            } else {
                result.append(spot)
            }
        }
        return result
    }

    static func ensure(on station: Station) -> Station {
        let notes = station.storyNotes
        guard !notes.isEmpty else {
            let collapsed = collapseOverlaps(station.spots, stationName: station.name)
                .map { demoteStoryOnMap($0) }
            guard collapsed.count != station.spots.count
                || collapsed.map(\.guide) != station.spots.map(\.guide)
                || collapsed.map(\.blurb) != station.spots.map(\.blurb)
            else { return station }
            return rebuilt(station, spots: collapsed)
        }

        var spots = station.spots
        var added = 0
        for note in notes {
            if DemachiTemplate.isForeignDemachiPlace(note.title, stationName: station.name) {
                continue
            }
            guard let place = placeName(fromStoryTitle: note.title) else { continue }
            if DemachiTemplate.isForeignDemachiPlace(place, stationName: station.name) {
                continue
            }
            if let idx = spots.firstIndex(where: { samePlace(name: $0.name, place) }) {
                let cur = spots[idx]
                let storySeed = Spot(
                    id: cur.id,
                    name: cur.name,
                    genre: "history",
                    guide: .story,
                    mealTier: cur.mealTier,
                    mealTimes: cur.mealTimes,
                    soloOk: cur.soloOk,
                    budgetYen: cur.budgetYen,
                    hours: cur.hours,
                    blurb: note.body,
                    detail: "物語のゆかり。\(note.title)",
                    walkMinutes: cur.walkMinutes,
                    secretWorthy: cur.secretWorthy,
                    majorWorthy: true,
                    lat: cur.lat,
                    lng: cur.lng,
                    coordTrust: cur.coordTrust
                )
                spots[idx] = merge(
                    cur,
                    with: storySeed,
                    storyBody: note.body,
                    storyTitle: note.title,
                    stationName: station.name
                )
                continue
            }

            // 地図では観光ピン。主文はカテゴリ定番、物語は末尾補足
            let primary = SpotCopy.compose(name: place, guide: .sight, address: nil)
            let seed = Spot(
                id: "story-\(NameMatch.normalize(place).prefix(24))",
                name: place,
                genre: "history",
                guide: .sight,
                mealTier: .casual,
                mealTimes: [],
                soloOk: true,
                budgetYen: "—",
                hours: "終日（屋外）",
                blurb: withStoryAtEnd(
                    primary: primary,
                    storyBody: note.body,
                    storyTitle: note.title
                ),
                detail: storySupplement(body: note.body, title: note.title),
                walkMinutes: 8 + added * 2,
                secretWorthy: false,
                majorWorthy: true,
                lat: station.lat + Double(added + 1) * 0.00035,
                lng: station.lng - Double(added + 1) * 0.00028,
                coordTrust: .unverified
            )
            let locked = LandmarkRegistry.apply(seed, stationName: station.name)
            guard DemachiTemplate.spotNearStation(locked, station: station) else { continue }
            // 追加直前にもう一度同場所チェック（ロック後の名前寄せ）
            if let idx = spots.firstIndex(where: { samePlace($0, locked) }) {
                spots[idx] = merge(
                    spots[idx],
                    with: locked,
                    storyBody: note.body,
                    storyTitle: note.title,
                    stationName: station.name
                )
            } else {
                spots.append(locked)
                added += 1
            }
            if added >= 4 { break }
        }

        spots = collapseOverlaps(spots, stationName: station.name)
        spots = spots.map { demoteStoryOnMap($0) }
        guard spots.count != station.spots.count
            || spots.map(\.guide) != station.spots.map(\.guide)
            || spots.map(\.blurb) != station.spots.map(\.blurb)
        else { return station }

        return rebuilt(station, spots: spots)
    }

    /// 残った guide=story も地図では観光にし、主文＋〔物語〕補足へ。
    private static func demoteStoryOnMap(_ spot: Spot) -> Spot {
        guard spot.guide == .story else { return spot }
        let primary = SpotCopy.compose(name: spot.name, guide: .sight, address: nil)
        let blurb = withStoryAtEnd(
            primary: primary,
            storyBody: spot.blurb.replacingOccurrences(of: "〔物語〕", with: ""),
            storyTitle: nil,
            extras: [spot.detail ?? ""]
        )
        return Spot(
            id: spot.id,
            name: spot.name,
            genre: spot.genre == "gourmet" ? spot.genre : "history",
            guide: .sight,
            mealTier: spot.mealTier,
            mealTimes: spot.mealTimes,
            soloOk: spot.soloOk,
            budgetYen: spot.budgetYen,
            hours: spot.hours,
            blurb: blurb,
            detail: SpotCopy.storySupplementLines(for: spot).first
                ?? storySupplement(body: spot.blurb),
            walkMinutes: spot.walkMinutes,
            secretWorthy: spot.secretWorthy,
            majorWorthy: spot.majorWorthy,
            lat: spot.lat,
            lng: spot.lng,
            coordTrust: spot.coordTrust
        )
    }

    private static func rebuilt(_ station: Station, spots: [Spot]) -> Station {
        Station(
            id: station.id,
            name: station.name,
            nameReading: station.nameReading,
            line: station.line,
            prefecture: station.prefecture,
            region: station.region,
            mood: station.mood,
            radiiKm: station.radiiKm,
            stationIntro: station.stationIntro,
            areaAbout: station.areaAbout,
            walkGuide: station.walkGuide,
            historyNotes: station.historyNotes,
            sightseeingNotes: station.sightseeingNotes,
            storyNotes: station.storyNotes,
            bikeRental: station.bikeRental,
            tourTitle: station.tourTitle,
            catchCopy: station.catchCopy,
            emptyCopy: station.emptyCopy,
            railHint: station.railHint,
            lat: station.lat,
            lng: station.lng,
            spots: spots
        )
    }
}
