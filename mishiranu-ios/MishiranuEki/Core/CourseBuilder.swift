import CoreLocation
import Foundation

/// 土地の顔（majorWorthy）。名所・景色と名物店の合計。
enum MajorFaces {
    static let total = 5
    /// 名所・景色の目安
    static let sightTarget = 3
    /// 名物店の目安
    static let foodTarget = 2
}

struct CourseStop: Hashable, Identifiable {
    let spot: Spot
    let walkMinutes: Int
    let dwellMinutes: Int
    /// コース内の目安時刻（例: 14:20）
    let clockLabel: String

    var id: String { spot.id }
}

struct WalkCourse: Hashable, Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let vibe: String
    let totalMinutes: Int
    let stops: [CourseStop]
    /// 最後の立ち寄りから駅へ戻る徒歩分（終点＝駅）。
    let returnWalkMinutes: Int
    /// 駅に戻る目安時刻。
    let returnClockLabel: String

    init(
        id: String,
        title: String,
        subtitle: String,
        vibe: String,
        totalMinutes: Int,
        stops: [CourseStop],
        returnWalkMinutes: Int = 0,
        returnClockLabel: String = ""
    ) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.vibe = vibe
        self.totalMinutes = totalMinutes
        self.stops = stops
        self.returnWalkMinutes = returnWalkMinutes
        self.returnClockLabel = returnClockLabel
    }
}

/// 難易度ではなく、まわり方の切り口。
private enum CourseStyle {
    case walk, food, farther
}

private struct CourseTemplate {
    let id: String
    let title: String
    let subtitle: String
    let vibe: String
    let prefer: [GuideKind]
    let style: CourseStyle
}

private let courseTemplates: [CourseTemplate] = [
    CourseTemplate(
        id: "walk",
        title: "散歩中心",
        subtitle: "景色と休みを多めに",
        vibe: "急がず、土地の気配を拾う",
        prefer: [.sight, .rest, .tip],
        style: .walk
    ),
    CourseTemplate(
        id: "food",
        title: "食べ物中心",
        subtitle: "ご飯と土産を軸に",
        vibe: "空腹と手土産のあいだを歩く",
        prefer: [.meal, .souvenir, .rest],
        style: .food
    ),
    CourseTemplate(
        id: "farther",
        title: "少し先まで",
        subtitle: "徒歩圏の端まで伸ばす",
        vibe: "駅前を抜けて、ひとつ奥へ",
        prefer: [.tip, .sight, .meal],
        style: .farther
    ),
]

enum CourseBuilder {
    static func mealPrefScore(_ spot: Spot, prefs: MealPrefs?) -> Double {
        guard let prefs, spot.guide == .meal else { return 0 }
        var score = 0.0
        switch prefs.solo {
        case .solo: score += spot.soloOk ? 14 : -18
        case .together: score += spot.soloOk ? 2 : 8
        case .either: break
        }
        switch prefs.budget {
        case .casual: score += spot.mealTier == .casual ? 12 : -10
        case .upscale: score += spot.mealTier == .upscale ? 12 : -10
        case .either: break
        }
        return score
    }

    static func mealFits(_ spot: Spot, dayPart: DayPart) -> Bool {
        guard spot.guide == .meal else { return true }
        let times = spot.mealTimes.isEmpty ? [MealTime.lunch] : spot.mealTimes
        let allowed = Set(dayPart.mealTimes)
        return times.contains { allowed.contains($0) }
    }

    /// コース用: 朝でもランチ店を候補に入れる（朝専用店が少ないと3コースが観光地だけになる）
    static func mealFitsForCourse(_ spot: Spot, dayPart: DayPart) -> Bool {
        guard spot.guide == .meal else { return true }
        if dayPart == .morning {
            let times = spot.mealTimes.isEmpty ? [MealTime.lunch] : spot.mealTimes
            return times.contains { $0 == .morning || $0 == .lunch }
        }
        return mealFits(spot, dayPart: dayPart)
    }

    static func dwellMinutes(_ guide: GuideKind, stay: StayOption = .threeHours) -> Int {
        let base: Int
        switch guide {
        case .meal: base = 25
        case .rest: base = 15
        default: base = 12
        }
        switch stay {
        case .oneHour: return max(8, Int((Double(base) * 0.55).rounded()))
        case .threeHours: return base
        case .halfDay: return Int((Double(base) * 1.2).rounded())
        }
    }

    private static func scoreSpot(
        _ spot: Spot,
        prefer: [GuideKind],
        dayPart: DayPart,
        used: Set<String>,
        prefs: MealPrefs?,
        style: CourseStyle,
        forceGuide: GuideKind?
    ) -> Double {
        if used.contains(spot.id) { return -1 }
        if !mealFitsForCourse(spot, dayPart: dayPart) { return -1 }
        if isFoodGuide(spot.guide), !HoursOpen.isLikelyOpen(spot, dayPart: dayPart) { return -1 }
        if let forceGuide, spot.guide != forceGuide { return -1 }
        var score: Double
        if let preferIdx = prefer.firstIndex(of: spot.guide) {
            score = 50 - Double(preferIdx) * 10
        } else {
            score = 4
        }
        switch style {
        case .walk:
            // 散歩中心: 土地の顔・景色を先に
            if spot.majorWorthy { score += 72 }
            score += landmarkFameScore(spot) * 0.4
            if spot.guide == .sight { score += 14 }
            if spot.guide == .rest { score += 12 }
            if spot.guide == .souvenir { score += 6 }
            if spot.secretWorthy { score -= 4 }
            if !spot.majorWorthy, spot.guide == .meal { score -= 30 }
            if isGenericNeighborhoodCafe(spot) { score -= 35 }
            score += max(0, 12 - Double(spot.walkMinutes) * 0.35)
        case .food:
            if spot.guide == .meal { score += 14 }
            if spot.guide == .meal { score += mealStapleScore(spot) * 0.55 }
            if spot.guide == .souvenir { score += 12 }
            if spot.guide == .rest || spot.guide == .tip { score += 6 }
            if spot.secretWorthy { score += 2 }
            if isGenericNeighborhoodCafe(spot) { score -= 28 }
            let walk = Double(spot.walkMinutes)
            score += max(0, 14 - abs(walk - 10) * 0.7)
        case .farther:
            if spot.secretWorthy { score += 14 }
            if spot.guide == .tip || spot.guide == .rest { score += 10 }
            if spot.guide == .sight { score += 6 }
            if spot.guide == .meal && spot.mealTier == .upscale { score += 6 }
            score += Double(spot.walkMinutes) * 0.95
        }
        score += mealPrefScore(spot, prefs: prefs)
        return score
    }

    static func formatClock(hour: Int, minute: Int) -> String {
        let h = ((hour % 24) + 24) % 24
        let m = max(0, min(59, minute))
        return String(format: "%d:%02d", h, m)
    }

    private static func appendStop(
        _ pick: Spot,
        stops: inout [CourseStop],
        used: inout Set<String>,
        elapsed: inout Int,
        cursorHour: inout Int,
        cursorMinute: inout Int,
        stay: StayOption
    ) {
        let dwell = dwellMinutes(pick.guide, stay: stay)
        let walk = pick.walkMinutes
        cursorMinute += walk
        cursorHour += cursorMinute / 60
        cursorMinute %= 60
        let clockLabel = formatClock(hour: cursorHour, minute: cursorMinute)
        stops.append(CourseStop(spot: pick, walkMinutes: walk, dwellMinutes: dwell, clockLabel: clockLabel))
        used.insert(pick.id)
        elapsed += walk + dwell
        cursorMinute += dwell
        cursorHour += cursorMinute / 60
        cursorMinute %= 60
    }

    private static func isFoodGuide(_ guide: GuideKind) -> Bool {
        guide == .meal || guide == .souvenir
    }

    private static func bestCandidate(
        pool: [Spot],
        prefer: [GuideKind],
        dayPart: DayPart,
        used: Set<String>,
        prefs: MealPrefs?,
        style: CourseStyle,
        elapsed: Int,
        budgetMinutes: Int,
        stay: StayOption,
        forceGuide: GuideKind?
    ) -> Spot? {
        var best: Spot?
        var bestScore = -1.0
        for spot in pool {
            let cost = spot.walkMinutes + dwellMinutes(spot.guide, stay: stay)
            if elapsed + cost > budgetMinutes + 8 { continue }
            let score = scoreSpot(
                spot,
                prefer: prefer,
                dayPart: dayPart,
                used: used,
                prefs: prefs,
                style: style,
                forceGuide: forceGuide
            )
            if score > bestScore {
                bestScore = score
                best = spot
            }
        }
        return bestScore >= 0 ? best : nil
    }

    private static func pickStops(
        pool: [Spot],
        prefer initialPrefer: [GuideKind],
        dayPart: DayPart,
        stay: StayOption,
        startHour: Int,
        prefs: MealPrefs?,
        style: CourseStyle,
        avoid: Set<String>
    ) -> [CourseStop] {
        var prefer = initialPrefer
        var used = avoid
        var stops: [CourseStop] = []
        var elapsed = 0
        var cursorHour = startHour
        var cursorMinute = 0
        let maxStops = stay.maxCourseStops
        let budgetMinutes = stay.budgetMinutes

        // 散歩中心: 土地の顔（major）を有名度順に先に入れる（滞在が短いほど少なく）
        if style == .walk {
            let faces = pool
                .filter(\.majorWorthy)
                .sorted { landmarkFameScore($0) > landmarkFameScore($1) }
            for face in faces where stops.count < maxStops {
                let cost = face.walkMinutes + dwellMinutes(face.guide, stay: stay)
                if used.contains(face.id) { continue }
                if elapsed + cost > budgetMinutes + 8 { continue }
                if !mealFitsForCourse(face, dayPart: dayPart) { continue }
                if isFoodGuide(face.guide), !HoursOpen.isLikelyOpen(face, dayPart: dayPart) { continue }
                appendStop(
                    face,
                    stops: &stops,
                    used: &used,
                    elapsed: &elapsed,
                    cursorHour: &cursorHour,
                    cursorMinute: &cursorMinute,
                    stay: stay
                )
            }
        }

        // 先頭はテンプレの第一希望から取る（3コースが同じ場所で始まらないように）
        if stops.isEmpty, let primary = prefer.first,
           let first = bestCandidate(
            pool: pool,
            prefer: prefer,
            dayPart: dayPart,
            used: used,
            prefs: prefs,
            style: style,
            elapsed: elapsed,
            budgetMinutes: budgetMinutes,
            stay: stay,
            forceGuide: primary
           ) {
            appendStop(
                first,
                stops: &stops,
                used: &used,
                elapsed: &elapsed,
                cursorHour: &cursorHour,
                cursorMinute: &cursorMinute,
                stay: stay
            )
            prefer = Array(prefer.dropFirst()) + [prefer[0]]
        }

        while stops.count < maxStops {
            guard let pick = bestCandidate(
                pool: pool,
                prefer: prefer,
                dayPart: dayPart,
                used: used,
                prefs: prefs,
                style: style,
                elapsed: elapsed,
                budgetMinutes: budgetMinutes,
                stay: stay,
                forceGuide: nil
            ) else { break }

            appendStop(
                pick,
                stops: &stops,
                used: &used,
                elapsed: &elapsed,
                cursorHour: &cursorHour,
                cursorMinute: &cursorMinute,
                stay: stay
            )
            prefer = Array(prefer.dropFirst()) + [prefer[0]]
        }
        // 半日だけ、徒歩圏の外の1件を最後に足す（1時間・3時間には入っていない）
        if stay == .halfDay,
           let extra = pool.first(where: { $0.id.hasPrefix("reach-") }),
           !used.contains(extra.id) {
            if stops.count >= maxStops, !stops.isEmpty {
                stops.removeLast()
            }
            appendStop(
                extra,
                stops: &stops,
                used: &used,
                elapsed: &elapsed,
                cursorHour: &cursorHour,
                cursorMinute: &cursorMinute,
                stay: stay
            )
        }
        return stops
    }

    private static func isLandmarkName(_ name: String) -> Bool {
        if FirstVisitFaces.isNeighborhoodWorship(name) { return false }
        return FirstVisitFaces.isGuidebookWorship(name)
            || FirstVisitFaces.isOrdinaryPublicFace(name)
            || name.contains("城") || name.contains("宮")
    }

    /// 近所の多目的カフェなど、土地の顔にしない店。
    private static func isGenericNeighborhoodCafe(_ spot: Spot) -> Bool {
        let n = spot.name + spot.blurb
        if spot.guide != .meal && spot.guide != .rest { return false }
        if isIconicShop(spot) || isEdibleOmiyage(spot) { return false }
        let soft = ["多目的", "つながる", "知る、感じる", "コワーキング", "レンタルスペース", "シェアキッチン"]
        return soft.contains { n.contains($0) }
    }

    /// 腰を下ろす喫茶・カフェ（ご飯の定食屋ではない）。休むところへ。
    static func isSitDownCafe(_ name: String) -> Bool {
        let n = name
        let soft = ["多目的", "つながる", "知る、感じる", "コワーキング", "レンタルスペース", "シェアキッチン"]
        if soft.contains(where: { n.contains($0) }) { return false }
        let mealOnly = ["食堂", "定食", "レストラン", "ラーメン", "うどん", "そば", "寿司", "すし", "焼肉", "居酒屋"]
        if mealOnly.contains(where: { n.contains($0) }) { return false }
        return n.contains("喫茶") || n.contains("純喫茶") || n.contains("茶房")
            || n.contains("カフェ") || n.contains("珈琲") || n.contains("コーヒー")
            || n.contains("喫茶店")
    }

    /// 散歩中心向けの「ベタさ」。近いだけの小社より、土地の顔になる名所を上げる。
    private static func landmarkFameScore(_ spot: Spot) -> Double {
        let n = spot.name
        let blob = n + spot.blurb + (spot.detail ?? "")
        var score = 0.0
        if spot.majorWorthy { score += 40 }
        if spot.guide == .sight { score += 8 }
        // ガイドブック級の社寺・普通の公共の顔
        if FirstVisitFaces.isGuidebookWorship(n) { score += 55 }
        // 鴨川デルタは出町柳で必ず行く顔（城跡・参道より先）
        if n.contains("デルタ") || n.contains("三角州") { score += 70 }
        if FirstVisitFaces.isOrdinaryPublicFace(n) || n.contains("合流") { score += 45 }
        if n.contains("城") || n.contains("金閣") || n.contains("清水") || n.contains("浅草") { score += 35 }
        if blob.contains("世界遺産") || blob.contains("観光の") { score += 20 }
        if n.contains("城跡") || n.contains("復元") || n.contains("参道") || n.contains("楼門") {
            score -= 20
        }
        if blob.contains("名物") || blob.contains("銘菓") || blob.contains("顔") { score += 16 }
        if isIconicShop(spot) || (isEdibleOmiyage(spot) && spot.guide == .souvenir) { score += 38 }
        // 近所の寺・小社・脇社・近所カフェは出さない
        if FirstVisitFaces.isNeighborhoodWorship(n) { score -= 80 }
        if n.contains("幸神社") || n.contains("境内社") || n.contains("摂社") { score -= 60 }
        if isGenericNeighborhoodCafe(spot) { score -= 50 }
        // 近さは弱い補正（有名度のあとに）
        score += max(0, 8 - Double(spot.walkMinutes) * 0.2)
        return score
    }

    /// 出町ふたばそのもの。注釈の「ふたば以外」は含めない。
    private static func isFutabaShop(_ name: String) -> Bool {
        !LandmarkRegistry.isEditorialName(name)
            && LandmarkRegistry.placeTitle(name).contains("ふたば")
    }

    /// 手土産になる名物菓子（お土産タブ／定番名物枠）
    static func isEdibleOmiyage(_ spot: Spot) -> Bool {
        if LandmarkRegistry.isEditorialName(spot.name) { return false }
        // 店名だけで判定する。blurb の「銘菓」「饅頭」まで拾うと定食屋が土産に化け、ご飯が3件に減る
        let n = spot.name
        return n.contains("ふたば") || n.contains("みたらし") || n.contains("だんご")
            || n.contains("団子") || n.contains("豆餅") || n.contains("阿闍梨")
            || n.contains("最中") || n.contains("羊羹") || n.contains("もみじ饅頭")
            || n.contains("赤福") || n.contains("サブレ") || n.contains("銘菓")
            || n.contains("饅頭") || n.contains("大福") || n.contains("カステラ")
            || n.contains("餅") || n.contains("もなか") || n.contains("走井")
            || n.contains("みやげ") || n.contains("お土産") || n.contains("土産")
    }

    private static func isIconicShop(_ spot: Spot) -> Bool {
        if LandmarkRegistry.isEditorialName(spot.name) { return false }
        // 土地を代表する一軒（出町柳ならふたば）。みたらしは土産リストには出すが定番枠の主ではない
        let blob = LandmarkRegistry.placeTitle(spot.name) + spot.blurb
        if blob.contains("ふたば") || blob.contains("最中") || blob.contains("羊羹")
            || blob.contains("赤福") || blob.contains("もみじ饅頭") {
            return true
        }
        return false
    }

    /// ご飯タブ向け: 「お米自慢 おにぎり屋さん」型の屋号＋業態を優先。
    static func mealStapleScore(_ spot: Spot) -> Double {
        MealStapleCatcher.stapleScore(spot)
    }

    /// 寺・神社。店名に「寺」が入るだけの食堂（銀閣寺本店など）は含めない。
    static func isWorshipPlace(_ spot: Spot) -> Bool {
        let n = spot.name
        if n.contains("茶屋") || n.contains("茶房") || n.contains("食堂") || n.hasSuffix("本店") || n.hasSuffix("店") {
            return false
        }
        return n.hasSuffix("寺") || n.hasSuffix("神社") || n.hasSuffix("神宮")
            || n.hasSuffix("大社") || n.hasSuffix("寺院")
    }

    /// 正本レジストリで誤ピンを上書き（表示・コース・保存の直前に必ず通す）
    /// 近所の無名寺もここで落とし、保存済みデータにも後から効く。
    /// ロック以外で駅直上に置かれた AI 仮座標は地図に出さない（Apple refine 待ち）。
    static func snapLandmarkPins(_ station: Station) -> Station {
        let faces = FirstVisitFaces.filterSpots(station.spots, stationName: station.name)
            .filter { !LandmarkRegistry.isEditorialName($0.name) }
        let scrubbed = faces.filter { spot in
            if LandmarkRegistry.isLocked(spot, stationName: station.name) { return true }
            if spot.coordTrust == .lock { return true }
            let km = Geo.haversineKm(
                lat1: station.lat, lng1: station.lng,
                lat2: spot.lat, lng2: spot.lng
            )
            // 駅から 80m 以内＝AI 欠落フォールバックや適当寄せ。誤ピンの温床なので外す。
            return km >= 0.08
        }
        let filtered = station.relocated(
            center: CLLocationCoordinate2D(latitude: station.lat, longitude: station.lng),
            spots: scrubbed
        )
        return LandmarkRegistry.apply(to: filtered)
    }

    /// 名物菓子を souvenir に寄せる（ご飯だけに閉じない）。喫茶は休むところへ。
    static func normalizeEdibleSouvenirs(_ station: Station) -> Station {
        var spots = station.spots.map { spot -> Spot in
            if isSitDownCafe(spot.name), spot.guide == .meal || spot.guide == .tip {
                let blurb = spot.blurb.contains("食事") || spot.blurb.contains("観光の目印")
                    ? SpotCopy.compose(name: spot.name, guide: .rest, address: spot.detail)
                    : spot.blurb
                return Spot(
                    id: spot.id, name: spot.name, genre: "nature", guide: .rest,
                    mealTier: spot.mealTier, mealTimes: spot.mealTimes, soloOk: spot.soloOk,
                    budgetYen: spot.budgetYen, hours: spot.hours, blurb: blurb,
                    detail: spot.detail, walkMinutes: spot.walkMinutes,
                    secretWorthy: spot.secretWorthy, majorWorthy: false,
                    lat: spot.lat, lng: spot.lng
                )
            }
            if isWorshipPlace(spot), spot.guide == .souvenir || spot.guide == .meal {
                return Spot(
                    id: spot.id, name: spot.name, genre: spot.genre, guide: .sight,
                    mealTier: spot.mealTier, mealTimes: spot.mealTimes, soloOk: spot.soloOk,
                    budgetYen: spot.budgetYen, hours: spot.hours, blurb: spot.blurb,
                    detail: spot.detail, walkMinutes: spot.walkMinutes,
                    secretWorthy: spot.secretWorthy, majorWorthy: spot.majorWorthy,
                    lat: spot.lat, lng: spot.lng
                )
            }
            // 弱い「おにぎり屋」等をロック正式名へ（お米自慢 おにぎり屋さん）
            if spot.guide == .meal,
               let canonical = LandmarkRegistry.canonicalizeMealName(spot.name, stationName: station.name),
               canonical != spot.name {
                return Spot(
                    id: spot.id, name: canonical, genre: spot.genre, guide: .meal,
                    mealTier: spot.mealTier, mealTimes: spot.mealTimes, soloOk: spot.soloOk,
                    budgetYen: spot.budgetYen, hours: spot.hours, blurb: spot.blurb,
                    detail: spot.detail, walkMinutes: spot.walkMinutes,
                    secretWorthy: spot.secretWorthy, majorWorthy: spot.majorWorthy,
                    lat: spot.lat, lng: spot.lng
                )
            }
            guard isEdibleOmiyage(spot), spot.guide == .meal else { return spot }
            return Spot(
                id: spot.id, name: spot.name, genre: spot.genre, guide: .souvenir,
                mealTier: spot.mealTier, mealTimes: spot.mealTimes, soloOk: spot.soloOk,
                budgetYen: spot.budgetYen, hours: spot.hours, blurb: spot.blurb,
                detail: spot.detail, walkMinutes: spot.walkMinutes,
                secretWorthy: spot.secretWorthy, majorWorthy: spot.majorWorthy,
                lat: spot.lat, lng: spot.lng
            )
        }
        spots = MealStapleCatcher.keepMajorMealsOnly(spots, stationName: station.name)
        // 出町柳: ふたば・みたらしが無ければ土産として足す
        if station.name.contains("出町柳") {
            if !spots.contains(where: { isFutabaShop($0.name) }) {
                spots.append(
                    Spot(
                        id: "ai-major-futaba",
                        name: "出町ふたば",
                        genre: "gourmet",
                        guide: .souvenir,
                        mealTier: .casual,
                        mealTimes: [.morning, .lunch],
                        soloOk: true,
                        budgetYen: "〜¥800",
                        hours: "8:30〜17:30（売切次第終了）",
                        blurb: "出町の顔・豆餅。手土産の定番で、並んでも買う人が絶えない。",
                        detail: "河合橋のたもと近く。朝から昼にかけて行列ができやすい。",
                        walkMinutes: 3,
                        secretWorthy: false,
                        majorWorthy: true,
                        lat: LandmarkRegistry.demachiFutaba.latitude,
                        lng: LandmarkRegistry.demachiFutaba.longitude
                    )
                )
            }
            if !spots.contains(where: {
                LandmarkRegistry.matchesLockedBranch($0.name, canonical: "進々堂 京大北門前")
            }) {
                spots.append(
                    Spot(
                        id: "ai-meal-shinshindo",
                        name: "進々堂 京大北門前",
                        genre: "gourmet",
                        guide: .meal,
                        mealTier: .casual,
                        mealTimes: [.morning, .lunch],
                        soloOk: true,
                        budgetYen: "〜¥1,200",
                        hours: "8:00〜18:00頃",
                        blurb: "京大北門前のパン屋。食パンとコーヒーが、このあたりの朝の定番。",
                        detail: "出町柳から北門まで歩いて十数分。一人でも入りやすい。",
                        walkMinutes: 12,
                        secretWorthy: false,
                        majorWorthy: false,
                        lat: LandmarkRegistry.demachiShinshindo.latitude,
                        lng: LandmarkRegistry.demachiShinshindo.longitude
                    )
                )
            }
            // おにぎりはお米自慢のみ。利次郎など二番手は入れない。
            spots.removeAll {
                $0.guide == .meal
                    && ($0.name.contains("おにぎり") || $0.name.contains("おむすび"))
                    && !$0.name.contains("お米自慢")
            }
            if !spots.contains(where: { $0.name.contains("お米自慢") }) {
                spots.append(
                    Spot(
                        id: "ai-meal-onigiri",
                        name: "お米自慢 おにぎり屋さん",
                        genre: "gourmet",
                        guide: .meal,
                        mealTier: .casual,
                        mealTimes: [.morning, .lunch],
                        soloOk: true,
                        budgetYen: "〜¥600",
                        hours: "7:00〜18:30",
                        blurb: "駅すぐのテイクアウトおにぎり。朝から並ぶ、出町の日常めし。",
                        detail: "川端通・田中上柳町。デルタへ持っていくのにちょうどいい。",
                        walkMinutes: 2,
                        secretWorthy: false,
                        majorWorthy: false,
                        lat: 35.0303809,
                        lng: 135.7737394
                    )
                )
            }
            if !spots.contains(where: { $0.name.contains("満寿形") || $0.name.contains("ますがた") }) {
                spots.append(
                    Spot(
                        id: "ai-meal-masugataya",
                        name: "満寿形屋",
                        genre: "gourmet",
                        guide: .meal,
                        mealTier: .casual,
                        mealTimes: [.lunch],
                        soloOk: true,
                        budgetYen: "〜¥1,500",
                        hours: "12:00〜15:00（売切次第終了）",
                        blurb: "枡形商店街のうどんと鯖寿司。出町で腹ごしらえするときの定番食堂。",
                        detail: "京都市上京区桝形通出町西入ル二神町179",
                        walkMinutes: 4,
                        secretWorthy: false,
                        majorWorthy: false,
                        lat: LandmarkRegistry.demachiMasugataya.latitude,
                        lng: LandmarkRegistry.demachiMasugataya.longitude
                    )
                )
            }
            if !spots.contains(where: { $0.name.contains("みたらし") }) {
                spots.append(
                    Spot(
                        id: "ai-omiyage-mitarashi",
                        name: "加茂みたらし茶屋",
                        genre: "gourmet",
                        guide: .souvenir,
                        mealTier: .casual,
                        mealTimes: [.lunch],
                        soloOk: true,
                        budgetYen: "〜¥700",
                        hours: "10:00〜17:00（季節により変動）",
                        blurb: "下鴨神社近くのみたらし団子。香ばしいタレが手土産にも人気。",
                        detail: "京都市左京区下鴨松ノ木町53（下鴨本通の西側・境内ではない）",
                        walkMinutes: 15,
                        secretWorthy: false,
                        majorWorthy: false,
                        lat: LandmarkRegistry.demachiMitarashi.latitude,
                        lng: LandmarkRegistry.demachiMitarashi.longitude
                    )
                )
            }
        }
        return Station(
            id: station.id, name: station.name, nameReading: station.nameReading,
            line: station.line, prefecture: station.prefecture, region: station.region,
            mood: station.mood, radiiKm: station.radiiKm, stationIntro: station.stationIntro,
            areaAbout: station.areaAbout, walkGuide: station.walkGuide,
            historyNotes: station.historyNotes, sightseeingNotes: station.sightseeingNotes,
            bikeRental: station.bikeRental, tourTitle: station.tourTitle,
            catchCopy: station.catchCopy, emptyCopy: station.emptyCopy,
            lat: station.lat, lng: station.lng, spots: spots
        )
    }

    /// major を名所・景色＋名物店の合計5件に整える（目安: 名所3＋名物2）
    static func balanceMajorsSightseeing(_ station: Station) -> Station {
        var base = sealDemachiMustFaces(station)

        let majors = base.spots.filter(\.majorWorthy)
        let landmarks = (majors.filter {
            $0.guide == .sight || $0.guide == .rest || isLandmarkName($0.name)
        }
            + base.spots.filter {
                $0.guide == .sight || $0.guide == .rest || isLandmarkName($0.name)
            })
            .reduce(into: [Spot]()) { acc, s in
                if !acc.contains(where: { $0.id == s.id }) { acc.append(s) }
            }
            .sorted { landmarkFameScore($0) > landmarkFameScore($1) }
        let foods = base.spots.filter { isFoodGuide($0.guide) }
            .sorted { landmarkFameScore($0) > landmarkFameScore($1) }
        let iconicFoods: [Spot] = {
            var list: [Spot] = []
            if let futaba = base.spots.first(where: { isFutabaShop($0.name) }) {
                list.append(futaba)
            }
            for s in foods where list.count < MajorFaces.foodTarget {
                if isGenericNeighborhoodCafe(s) { continue }
                if list.contains(where: { $0.id == s.id }) { continue }
                if isIconicShop(s) || isEdibleOmiyage(s) || s.majorWorthy {
                    list.append(s)
                }
            }
            for s in foods where list.count < MajorFaces.foodTarget {
                if isGenericNeighborhoodCafe(s) { continue }
                if !list.contains(where: { $0.id == s.id }) { list.append(s) }
            }
            return list
        }()

        // 出町柳の名所は「鴨川デルタ＋下鴨」を先に（城跡・参道で埋めない）
        var keep: [Spot] = []
        if base.name.contains("出町柳") {
            if let delta = landmarks.first(where: { $0.name.contains("デルタ") || $0.name.contains("三角州") }) {
                keep.append(delta)
            }
            if let shrine = landmarks.first(where: {
                $0.name.contains("下鴨") || $0.name.contains("賀茂御祖")
            }) {
                if !keep.contains(where: { $0.id == shrine.id }) { keep.append(shrine) }
            }
        }
        for s in landmarks where keep.count < MajorFaces.sightTarget {
            if s.name.contains("幸神社") || isGenericNeighborhoodCafe(s) { continue }
            if s.name.contains("城跡") || s.name.contains("復元") || s.name.contains("参道") || s.name.contains("楼門") {
                continue
            }
            if !keep.contains(where: { $0.id == s.id }) { keep.append(s) }
        }
        // 枝葉でも枠が空いていれば名所を足す
        for s in landmarks where keep.count < MajorFaces.sightTarget {
            if s.name.contains("幸神社") || isGenericNeighborhoodCafe(s) { continue }
            if !keep.contains(where: { $0.id == s.id }) { keep.append(s) }
        }
        for food in iconicFoods where keep.count < MajorFaces.total {
            if !keep.contains(where: { $0.id == food.id }) { keep.append(food) }
        }
        for s in landmarks where keep.count < MajorFaces.total {
            if s.name.contains("幸神社") || isGenericNeighborhoodCafe(s) { continue }
            if !keep.contains(where: { $0.id == s.id }) { keep.append(s) }
        }
        return withMajorFlags(base, ids: Set(keep.prefix(MajorFaces.total).map(\.id)))
    }

    /// 出町柳で初めて必ず行く顔（鴨川デルタ・下鴨）をスポットに確保する。
    private static func sealDemachiMustFaces(_ station: Station) -> Station {
        guard station.name.contains("出町柳") else { return station }
        var spots = station.spots
        if !spots.contains(where: { $0.name.contains("デルタ") || $0.name.contains("三角州") }) {
            spots.append(
                Spot(
                    id: "lock-demachi-delta",
                    name: "鴨川デルタ",
                    genre: "history",
                    guide: .rest,
                    mealTier: .casual,
                    mealTimes: [.lunch],
                    soloOk: true,
                    budgetYen: "—",
                    hours: nil,
                    blurb: SpotCopy.compose(name: "鴨川デルタ", guide: .rest, address: "鴨川と高野川の合流"),
                    detail: "鴨川と高野川の合流（鴨川デルタ）",
                    walkMinutes: 3,
                    secretWorthy: false,
                    majorWorthy: true,
                    lat: LandmarkRegistry.demachiDelta.latitude,
                    lng: LandmarkRegistry.demachiDelta.longitude
                )
            )
        } else {
            spots = spots.map { spot in
                guard spot.name.contains("デルタ") || spot.name.contains("三角州") else { return spot }
                let named = spot.name.contains("鴨川") ? spot.name : "鴨川デルタ"
                return Spot(
                    id: spot.id, name: named, genre: spot.genre,
                    guide: spot.guide == .tip ? .rest : spot.guide,
                    mealTier: spot.mealTier, mealTimes: spot.mealTimes, soloOk: spot.soloOk,
                    budgetYen: spot.budgetYen, hours: spot.hours,
                    blurb: spot.blurb.contains("観光の目印")
                        ? SpotCopy.compose(name: named, guide: .rest, address: spot.detail)
                        : spot.blurb,
                    detail: spot.detail, walkMinutes: min(spot.walkMinutes, 5),
                    secretWorthy: false, majorWorthy: true,
                    lat: LandmarkRegistry.demachiDelta.latitude,
                    lng: LandmarkRegistry.demachiDelta.longitude
                )
            }
        }
        if !spots.contains(where: { $0.name.contains("下鴨") || $0.name.contains("賀茂御祖") }) {
            spots.append(
                Spot(
                    id: "ai-major-shimogamo",
                    name: "下鴨神社（賀茂御祖神社）",
                    genre: "history",
                    guide: .sight,
                    mealTier: .casual,
                    mealTimes: [.lunch],
                    soloOk: true,
                    budgetYen: "—",
                    hours: "6:30〜17:00（季節により変動）",
                    blurb: "世界遺産の社。糺の森を抜けて本殿へ。出町柳の顔になる名所。",
                    detail: "駅から北東へ。デルタを経由すると道がわかりやすい。",
                    walkMinutes: 12,
                    secretWorthy: false,
                    majorWorthy: true,
                    lat: 35.0387,
                    lng: 135.7727
                )
            )
        }
        return Station(
            id: station.id, name: station.name, nameReading: station.nameReading,
            line: station.line, prefecture: station.prefecture, region: station.region,
            mood: station.mood, radiiKm: station.radiiKm, stationIntro: station.stationIntro,
            areaAbout: station.areaAbout, walkGuide: station.walkGuide,
            historyNotes: station.historyNotes, sightseeingNotes: station.sightseeingNotes,
            bikeRental: station.bikeRental, tourTitle: station.tourTitle,
            catchCopy: station.catchCopy, emptyCopy: station.emptyCopy,
            lat: station.lat, lng: station.lng, spots: spots
        )
    }

    private static func withMajorFlags(_ station: Station, ids: Set<String>) -> Station {
        let spots = station.spots.map { spot in
            Spot(
                id: spot.id, name: spot.name, genre: spot.genre, guide: spot.guide,
                mealTier: spot.mealTier, mealTimes: spot.mealTimes, soloOk: spot.soloOk,
                budgetYen: spot.budgetYen, hours: spot.hours, blurb: spot.blurb,
                detail: spot.detail, walkMinutes: spot.walkMinutes,
                secretWorthy: ids.contains(spot.id) ? false : spot.secretWorthy,
                majorWorthy: ids.contains(spot.id),
                lat: spot.lat, lng: spot.lng
            )
        }
        return Station(
            id: station.id, name: station.name, nameReading: station.nameReading,
            line: station.line, prefecture: station.prefecture, region: station.region,
            mood: station.mood, radiiKm: station.radiiKm, stationIntro: station.stationIntro,
            areaAbout: station.areaAbout, walkGuide: station.walkGuide,
            historyNotes: station.historyNotes, sightseeingNotes: station.sightseeingNotes,
            bikeRental: station.bikeRental, tourTitle: station.tourTitle,
            catchCopy: station.catchCopy, emptyCopy: station.emptyCopy,
            lat: station.lat, lng: station.lng, spots: spots
        )
    }

    /// 名物店（ふたば等）が major から落ちていたら押し込む。一般「本店」土産を優先しない。
    static func sealIconicMajors(_ station: Station) -> Station {
        var base = station
        if station.name.contains("出町柳"),
           !station.spots.contains(where: { isFutabaShop($0.name) }) {
            let futaba = Spot(
                id: "ai-major-futaba",
                name: "出町ふたば",
                genre: "gourmet",
                guide: .souvenir,
                mealTier: .casual,
                mealTimes: [.morning, .lunch],
                soloOk: true,
                budgetYen: "〜¥800",
                hours: "8:30〜17:30（売切次第終了）",
                blurb: "出町の顔といえば豆餅。並んでも買う人が絶えない甘味で、手土産にもなる。",
                detail: "河合橋のたもと近く。朝から昼にかけて行列ができやすい。",
                walkMinutes: 3,
                secretWorthy: false,
                majorWorthy: true,
                lat: LandmarkRegistry.demachiFutaba.latitude,
                lng: LandmarkRegistry.demachiFutaba.longitude
            )
            base = Station(
                id: station.id, name: station.name, nameReading: station.nameReading,
                line: station.line, prefecture: station.prefecture, region: station.region,
                mood: station.mood, radiiKm: station.radiiKm, stationIntro: station.stationIntro,
                areaAbout: station.areaAbout, walkGuide: station.walkGuide,
                historyNotes: station.historyNotes, sightseeingNotes: station.sightseeingNotes,
                bikeRental: station.bikeRental, tourTitle: station.tourTitle,
                catchCopy: station.catchCopy, emptyCopy: station.emptyCopy,
                lat: station.lat, lng: station.lng, spots: station.spots + [futaba]
            )
        }
        base = normalizeEdibleSouvenirs(base)

        let shops = base.spots.filter { $0.guide == .meal || $0.guide == .souvenir }
        let demachiFutaba = base.name.contains("出町柳")
            ? base.spots.first(where: { isFutabaShop($0.name) })
            : nil
        let iconic = demachiFutaba
            ?? shops.first(where: isIconicShop)
            ?? shops.first(where: { $0.name.contains(SavedStationStore.bareName(base.name)) && $0.guide == .meal })
        guard let must = iconic else { return base }
        let station = base

        var majors = station.spots.filter(\.majorWorthy)
        if majors.contains(where: { $0.id == must.id }) {
            if majors.count <= MajorFaces.total { return station }
        }

        if let drop = majors.first(where: {
            ($0.guide == .souvenir || $0.guide == .meal)
                && $0.id != must.id
                && !isIconicShop($0)
                && !isLandmarkName($0.name)
        }) ?? majors.first(where: {
            $0.guide == .souvenir && $0.id != must.id && !isIconicShop($0)
        }) {
            majors.removeAll { $0.id == drop.id }
        } else if majors.count >= MajorFaces.total, !majors.contains(where: { $0.id == must.id }) {
            if let far = majors.filter({ !isLandmarkName($0.name) }).max(by: { $0.walkMinutes < $1.walkMinutes }) {
                majors.removeAll { $0.id == far.id }
            }
        }
        if !majors.contains(where: { $0.id == must.id }) {
            majors.append(must)
        }
        var ids = Set(majors.map(\.id))
        // landmark を優先して合計5件に
        var keep: [String] = [must.id]
        for m in majors where isLandmarkName(m.name) && keep.count < MajorFaces.total {
            if !keep.contains(m.id) { keep.append(m.id) }
        }
        for m in majors.sorted(by: { $0.walkMinutes < $1.walkMinutes }) where keep.count < MajorFaces.total {
            if !keep.contains(m.id) { keep.append(m.id) }
        }
        ids = Set(keep)
        return balanceMajorsSightseeing(withMajorFlags(station, ids: ids))
    }

    /// 保存データに major 印が無いとき、名所・近い店を定番候補にする（サーバ再生成前の保険）
    static func ensureLocalMajors(_ station: Station) -> Station {
        // 土地文の商店街・橋などをスポット化、大学など具体名を確保してから顔を整える。
        // シーダー後にロック座標を当て直す（京都大学がデルタに残らないように）。
        let seeded = LandmarkRegistry.apply(
            to: LandMentionSeeder.ensure(on: LandPresentAnchors.ensure(on: station))
        )
        let sealed = balanceMajorsSightseeing(sealIconicMajors(seeded))
        let marked = sealed.spots.filter(\.majorWorthy)
        if marked.count >= MajorFaces.total { return sealed }
        let scored: [(Spot, Double)] = sealed.spots.map { spot in
            var score = 0.0
            if spot.majorWorthy { score += 100 }
            if isIconicShop(spot) { score += 60 }
            switch spot.guide {
            case .sight: score += 42
            case .meal: score += 28
            case .souvenir: score += 18 // 「本店」土産より名所・名物を優先
            case .rest: score += 8
            case .tip: score += 6
            }
            if isLandmarkName(spot.name) { score += 28 }
            if LandmarkRegistry.placeTitle(spot.name).contains("ふたば"),
               !LandmarkRegistry.isEditorialName(spot.name) {
                score += 40
            }
            score += max(0, 22 - Double(spot.walkMinutes))
            if spot.secretWorthy { score -= 35 }
            return (spot, score)
        }
        .sorted { lhs, rhs in
            if lhs.1 != rhs.1 { return lhs.1 > rhs.1 }
            return lhs.0.walkMinutes < rhs.0.walkMinutes
        }
        var picked: [Spot] = []
        if let sight = scored.first(where: { $0.0.guide == .sight })?.0 {
            picked.append(sight)
        }
        if let shop = scored.first(where: {
            ($0.0.guide == .meal || $0.0.guide == .souvenir) && (isIconicShop($0.0) || isFutabaShop($0.0.name))
        })?.0 ?? scored.first(where: { $0.0.guide == .meal })?.0 {
            if !picked.contains(where: { $0.id == shop.id }) { picked.append(shop) }
        }
        for row in scored where picked.count < MajorFaces.total {
            if !picked.contains(where: { $0.id == row.0.id }) {
                picked.append(row.0)
            }
        }
        return balanceMajorsSightseeing(withMajorFlags(sealed, ids: Set(picked.prefix(MajorFaces.total).map(\.id))))
    }

    /// 駅から近い順（実座標の距離 → 徒歩分）。歩くページ・地図の番号の正本。
    private static func sortNearStation(_ spots: [Spot], station: Station) -> [Spot] {
        func meters(_ spot: Spot) -> Double {
            let km = Geo.haversineKm(
                lat1: station.lat, lng1: station.lng,
                lat2: spot.lat, lng2: spot.lng
            )
            // 座標が駅とほぼ同じ（未確定の仮ピン）だけ徒歩分を距離の代理にする。
            // 0.08km だと実座標の鴨川デルタ等まで仮扱いされ、近い順が崩れる。
            if km < 0.02 {
                return Double(max(spot.walkMinutes, 1)) * 80
            }
            return km * 1000
        }
        return spots.sorted { lhs, rhs in
            let dm = meters(lhs) - meters(rhs)
            if abs(dm) > 15 { return dm < 0 }
            if lhs.walkMinutes != rhs.walkMinutes {
                return lhs.walkMinutes < rhs.walkMinutes
            }
            return lhs.name < rhs.name
        }
    }

    /// ショート（手短）とロング（ゆったり）。候補は近い顔から選び、歩き順は道なり最適化。
    static func firstVisitOrdinaryCourses(
        for station: Station,
        dayPart: DayPart,
        stay: StayOption = .halfDay
    ) -> [WalkCourse] {
        // シーダーが出町の文から顔を起こしたあと、もう一度落とす。
        let prepared = DemachiTemplate.scrubContamination(
            on: snapLandmarkPins(
                BikeRentalSeal.ensure(
                    ensureLocalMajors(
                        normalizeEdibleSouvenirs(DemachiTemplate.scrubContamination(on: station))
                    )
                )
            )
        )
        let must = DemachiTemplate.filterWalkSpots(mustVisitWalkSpots(in: prepared), station: prepared)
        var pool = DemachiTemplate.filterWalkSpots(ordinaryWalkPool(in: prepared), station: prepared)
        for spot in must where !pool.contains(where: { sameWalkPlace($0, spot) }) {
            pool.append(spot)
        }
        guard !pool.isEmpty else { return [] }

        let near = sortNearStation(pool, station: prepared)
        // 雛形がある駅はショート＝mustVisit そのもの（出町方式: 土地の顔3点など）。
        // 出町固有名が他駅に混ざって must が空になったら near に落ちる。
        let shortRaw: [Spot] =
            must.count >= 2
            ? must
            : ensureMustVisits(
                Array(near.prefix(min(3, near.count))),
                must: must,
                station: prepared,
                cap: min(3, near.count)
            )
        let shortSet = DemachiTemplate.filterWalkSpots(shortRaw, station: prepared)
        let longCap = min(max(stay.maxCourseStops, 5), max(near.count, shortSet.count), 6)
        let longSet = DemachiTemplate.filterWalkSpots(
            ensureMustVisits(
                Array(near.prefix(longCap)), must: must, station: prepared, cap: longCap
            ),
            station: prepared
        )
        guard !shortSet.isEmpty else { return [] }
        let startHour = dayPart.defaultClockHour
        let bare = SavedStationStore.bareName(prepared.name)

        var out: [WalkCourse] = []
        if let short = buildOrdinaryVariant(
            id: "ordinary-short-\(bare)-\(dayPart.rawValue)",
            title: "ショートで歩く",
            subtitle: "駅まわりを手短に · \(shortSet.count)か所",
            vibe: "土地の顔を、遠回りしない順で",
            spots: shortSet,
            station: prepared,
            dayPart: dayPart,
            stay: stay,
            startHour: startHour
        ) {
            out.append(short)
        }
        // ロングはショートより多いときだけ別コースにする
        if longSet.count > shortSet.count,
           let long = buildOrdinaryVariant(
            id: "ordinary-long-\(bare)-\(dayPart.rawValue)",
            title: "ロングで歩く",
            subtitle: "土地の顔をゆったり · \(longSet.count)か所",
            vibe: "土地の顔から先まで、道なりにゆったり巡る",
            spots: longSet,
            station: prepared,
            dayPart: dayPart,
            stay: stay,
            startHour: startHour
        ) {
            out.append(long)
        } else if out.isEmpty, let only = buildOrdinaryVariant(
            id: "ordinary-short-\(bare)-\(dayPart.rawValue)",
            title: "ショートで歩く",
            subtitle: "駅まわりを手短に",
            vibe: "土地の顔を、遠回りしない順で",
            spots: ensureMustVisits(near, must: must, station: prepared, cap: near.count),
            station: prepared,
            dayPart: dayPart,
            stay: stay,
            startHour: startHour
        ) {
            out.append(only)
        }
        return out
    }

    /// 互換: ショート（無ければロング）を1本返す。
    static func firstVisitOrdinaryCourse(
        for station: Station,
        dayPart: DayPart,
        stay: StayOption = .halfDay
    ) -> WalkCourse? {
        firstVisitOrdinaryCourses(for: station, dayPart: dayPart, stay: stay).first
    }

    private static func ordinaryWalkPool(in station: Station) -> [Spot] {
        // 歩くコースは土地文の名前が正本。地図用の lock/Apple は必須にしない
        // （未確定座標でも道順は出す。地図ピンは MapPinTrust 側で別判定）。
        let near: (Spot) -> Bool = {
            !isGenericNeighborhoodCafe($0)
                && DemachiTemplate.spotNearStation($0, station: station)
        }
        let narrative = StationLore.landNarrativeSpots(in: station).filter(near)
        if narrative.count >= 2 { return narrative }

        let introduced = StationLore.introducedVisitSpots(in: station).filter {
            near($0)
                && ($0.guide == .sight || $0.guide == .rest || $0.guide == .tip
                    || $0.majorWorthy
                    || FirstVisitFaces.isOrdinaryPublicFace($0.name)
                    || FirstVisitFaces.isGuidebookWorship($0.name, stationName: station.name))
        }
        if !introduced.isEmpty { return introduced }

        // 土地文の抽出が薄い駅: 観光・休み・名所印から起こす
        return station.spots.filter {
            near($0)
                && !$0.name.hasSuffix("駅")
                && !PlaceNoise.isNoise($0.name)
                && ($0.guide == .sight || $0.guide == .rest || $0.majorWorthy
                    || FirstVisitFaces.isGuidebookWorship($0.name, stationName: station.name))
        }
    }

    /// 出町柳雛形のショート正本。JSON mustVisit → なければ観光案内の顔。
    private static func mustVisitWalkSpots(in station: Station) -> [Spot] {
        let anchors = LandPresentAnchors.anchors(forStationName: station.name).filter(\.isMustVisit)
        var found: [Spot] = []
        for anchor in anchors {
            if DemachiTemplate.isForeignDemachiPlace(anchor.name, stationName: station.name) {
                continue
            }
            if let hit = station.spots.first(where: { spot in
                spotMatchesAnchorKeys(spot.name, keys: anchor.keys)
                    || anchor.keys.contains { NameMatch.score(spot.name, $0) >= 90 }
            }), DemachiTemplate.spotNearStation(hit, station: station) {
                if !found.contains(where: { sameWalkPlace($0, hit) }) {
                    found.append(LandmarkRegistry.apply(hit, stationName: station.name))
                }
                continue
            }
            // スポットが欠けていてもアンカーから起こす
            guard let lat = anchor.lat, let lng = anchor.lng else { continue }
            let guide: GuideKind = {
                switch anchor.guide {
                case "meal": return .meal
                case "rest": return .rest
                case "souvenir": return .souvenir
                case "tip": return .tip
                default: return .sight
                }
            }()
            let created = Spot(
                id: "anchor-\(NameMatch.normalize(anchor.name).prefix(28))",
                name: anchor.name,
                genre: "town",
                guide: guide,
                mealTier: .casual,
                mealTimes: [],
                soloOk: true,
                budgetYen: "—",
                hours: "終日（屋外）",
                blurb: [anchor.why, anchor.present].compactMap { $0 }.joined(separator: " "),
                detail: anchor.whereLabel,
                walkMinutes: anchor.walkMinutes ?? 8,
                secretWorthy: false,
                majorWorthy: true,
                lat: lat,
                lng: lng,
                coordTrust: .lock
            )
            guard DemachiTemplate.spotNearStation(created, station: station) else { continue }
            found.append(created)
        }
        if found.count >= 2 { return found }

        // 知らない駅: 観光案内メモ（出町雛形で揃えた3点）から起こす
        for note in station.sightseeingNotes {
            if DemachiTemplate.isForeignDemachiPlace(note.title, stationName: station.name) {
                continue
            }
            let title = note.title
                .split(whereSeparator: { "と・/｜|".contains($0) })
                .map(String.init)
                .first { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                ?? note.title
            guard title.count >= 2 else { continue }
            if let hit = station.spots.first(where: {
                spotMatchesAnchorKeys($0.name, keys: [title, note.title])
            }), DemachiTemplate.spotNearStation(hit, station: station),
               !found.contains(where: { sameWalkPlace($0, hit) }) {
                found.append(LandmarkRegistry.apply(hit, stationName: station.name))
            } else if !found.contains(where: {
                NameMatch.score($0.name, title) >= 85 || namesLikelySamePlace($0.name, title)
            }) {
                // スポット未登録でも土地の顔としてコースに載せる（座標は後で Apple 採取）
                found.append(
                    Spot(
                        id: "note-\(NameMatch.normalize(title).prefix(24))",
                        name: title,
                        genre: "town",
                        guide: .sight,
                        mealTier: .casual,
                        mealTimes: [],
                        soloOk: true,
                        budgetYen: "—",
                        hours: "終日（屋外）",
                        blurb: note.body,
                        detail: "土地の案内メモから。",
                        walkMinutes: 8 + found.count * 3,
                        secretWorthy: false,
                        majorWorthy: true,
                        lat: station.lat + Double(found.count) * 0.0004,
                        lng: station.lng - Double(found.count) * 0.0003,
                        coordTrust: .unverified
                    )
                )
            }
            if found.count >= 3 { break }
        }
        return found.filter { DemachiTemplate.spotNearStation($0, station: station) }
    }

    private static func namesLikelySamePlace(_ a: String, _ b: String) -> Bool {
        if a == b { return true }
        if a.contains("枡形") || a.contains("桝形"),
           b.contains("枡形") || b.contains("桝形"),
           !a.contains("満寿"), !b.contains("満寿") {
            return true
        }
        let short = a.count <= b.count ? a : b
        let long = a.count <= b.count ? b : a
        guard long.contains(short) else { return false }
        // 参道ケーブル≠本殿、山崎≠大山崎山荘
        return short.count >= 4 && Double(short.count) >= Double(long.count) * 0.85
    }

    private static func sameWalkPlace(_ a: Spot, _ b: Spot) -> Bool {
        if a.id == b.id { return true }
        if NameMatch.score(a.name, b.name) >= 92 { return true }
        return namesLikelySamePlace(a.name, b.name)
    }

    private static func spotMatchesAnchorKeys(_ spotName: String, keys: [String]) -> Bool {
        keys.contains { key in
            if spotName == key { return true }
            if key.count >= 4, spotName.contains(key) { return true }
            if spotName.count >= 4, key.contains(spotName),
               Double(spotName.count) >= Double(key.count) * 0.85 {
                return true
            }
            return false
        }
    }

    /// mustVisit が落ちないよう、遠い候補と入れ替えてセットに残す。
    private static func ensureMustVisits(
        _ set: [Spot],
        must: [Spot],
        station: Station,
        cap: Int
    ) -> [Spot] {
        var out = set
        let limit = max(cap, must.count)
        for m in must {
            if out.contains(where: { sameWalkPlace($0, m) }) { continue }
            if out.count < limit {
                out.append(m)
                continue
            }
            // いちばん遠い非 must を入れ替え
            let mustIds = Set(must.map(\.id))
            guard let dropIdx = out.indices.max(by: { i, j in
                let si = out[i], sj = out[j]
                if mustIds.contains(si.id) != mustIds.contains(sj.id) {
                    return mustIds.contains(si.id) && !mustIds.contains(sj.id)
                }
                let di = Geo.haversineKm(
                    lat1: station.lat, lng1: station.lng, lat2: si.lat, lng2: si.lng
                )
                let dj = Geo.haversineKm(
                    lat1: station.lat, lng1: station.lng, lat2: sj.lat, lng2: sj.lng
                )
                return di < dj
            }) else { continue }
            if mustIds.contains(out[dropIdx].id) { continue }
            out[dropIdx] = m
        }
        return out
    }

    private static func buildOrdinaryVariant(
        id: String,
        title: String,
        subtitle: String,
        vibe: String,
        spots: [Spot],
        station: Station,
        dayPart: DayPart,
        stay: StayOption,
        startHour: Int
    ) -> WalkCourse? {
        // 最後の関所: 出町の固有名がコースに残っていたら落とす
        let clean = DemachiTemplate.filterWalkSpots(spots, station: station)
        guard !clean.isEmpty else { return nil }
        let provisional = clean.map {
            CourseStop(
                spot: $0,
                walkMinutes: $0.walkMinutes,
                dwellMinutes: dwellMinutes($0.guide, stay: stay),
                clockLabel: ""
            )
        }
        // 駅出発 → 立ち寄り → 駅に戻る周回（同じ道の往復を避ける）
        return finishLoopCourse(
            id: id,
            title: title,
            subtitle: subtitle,
            vibe: vibe,
            provisional: provisional,
            stationLat: station.lat,
            stationLng: station.lng,
            startHour: startHour,
            stay: stay
        )
    }

    /// 登場順のまま時計だけ振る（まわり方の地理並べ替えはしない）。
    private static func stampClocks(_ stops: [CourseStop], startHour: Int) -> [CourseStop] {
        var hour = startHour
        var minute = 0
        return stops.map { stop in
            let label = String(format: "%d:%02d", hour, minute)
            minute += stop.walkMinutes + stop.dwellMinutes
            while minute >= 60 {
                minute -= 60
                hour = (hour + 1) % 24
            }
            return CourseStop(
                spot: stop.spot,
                walkMinutes: stop.walkMinutes,
                dwellMinutes: stop.dwellMinutes,
                clockLabel: label
            )
        }
    }

    static func courses(
        for station: Station,
        stay: StayOption,
        dayPart: DayPart,
        prefs: MealPrefs?
    ) -> [WalkCourse] {
        let prepared = DemachiTemplate.scrubContamination(
            on: snapLandmarkPins(
                BikeRentalSeal.ensure(
                    ensureLocalMajors(normalizeEdibleSouvenirs(DemachiTemplate.scrubContamination(on: station)))
                )
            )
        )
        // 土地紹介で触れた場所だけをまわり方の正本にする
        let introduced = StationLore.introducedVisitSpots(in: prepared)
        let introducedIds = Set(introduced.map(\.id))
        let walkPool = prepared.spots(for: stay).filter { introducedIds.contains($0.id) }
        let fallbackPool = prepared.spots(for: stay)
        let landPool = walkPool.count >= 2 ? walkPool : (introduced.isEmpty ? fallbackPool : introduced)
        // コース用は朝でもランチを残す。案内タブの全件表示とは別。閉店店は入れない。
        let pool = landPool.filter {
            mealFitsForCourse($0, dayPart: dayPart)
                && (!isFoodGuide($0.guide) || HoursOpen.isLikelyOpen($0, dayPart: dayPart))
        }
        let openWalk = landPool.filter {
            !isFoodGuide($0.guide) || HoursOpen.isLikelyOpen($0, dayPart: dayPart)
        }
        let source = pool.count >= 2 ? pool : openWalk
        let budget = stay.budgetMinutes
        let startHour = dayPart.defaultClockHour

        var claimed = Set<String>()
        return courseTemplates.compactMap { template in
            let prefer: [GuideKind]
            if dayPart == .morning && template.style == .food {
                prefer = [.meal, .souvenir, .sight]
            } else if dayPart == .night && template.style == .farther {
                prefer = [.meal, .tip, .rest]
            } else {
                prefer = template.prefer
            }

            let rawStops = pickStops(
                pool: source,
                prefer: prefer,
                dayPart: dayPart,
                stay: stay,
                startHour: startHour,
                prefs: prefs,
                style: template.style,
                avoid: claimed
            )
            guard !rawStops.isEmpty else { return nil }
            let course = finishLoopCourse(
                id: "\(template.id)-\(stay.rawValue)-\(dayPart.rawValue)",
                title: template.title,
                subtitle: "\(template.subtitle) · \(stay.courseLengthHint)",
                vibe: template.vibe,
                provisional: rawStops,
                stationLat: prepared.lat,
                stationLng: prepared.lng,
                startHour: startHour,
                stay: stay
            )
            guard var course = course else { return nil }
            for stop in course.stops.prefix(2) {
                claimed.insert(stop.spot.id)
            }
            if course.totalMinutes <= 0 {
                course = WalkCourse(
                    id: course.id,
                    title: course.title,
                    subtitle: course.subtitle,
                    vibe: course.vibe,
                    totalMinutes: min(budget, 45),
                    stops: course.stops,
                    returnWalkMinutes: course.returnWalkMinutes,
                    returnClockLabel: course.returnClockLabel
                )
            }
            return course
        }
    }

    /// 駅出発→立ち寄り→駅帰還のコースを組み立てる。
    private static func finishLoopCourse(
        id: String,
        title: String,
        subtitle: String,
        vibe: String,
        provisional: [CourseStop],
        stationLat: Double,
        stationLng: Double,
        startHour: Int,
        stay: StayOption
    ) -> WalkCourse? {
        guard !provisional.isEmpty else { return nil }
        let ordered = orderStopsAsStationLoop(
            stationLat: stationLat,
            stationLng: stationLng,
            spots: provisional.map(\.spot)
        )
        let built = rebuildStopsWithLegs(
            stationLat: stationLat,
            stationLng: stationLng,
            startHour: startHour,
            stay: stay,
            spots: ordered
        )
        guard let last = built.last else { return nil }
        let returnKm = Geo.haversineKm(
            lat1: last.spot.lat, lng1: last.spot.lng,
            lat2: stationLat, lng2: stationLng
        )
        let returnWalk = max(1, min(90, Int((returnKm * 1.3 / 4.5 * 60).rounded())))
        // 最終立ち寄り到着時刻 + 滞在 + 駅までの徒歩
        var hour = startHour
        var minute = 0
        if let parsed = parseClock(last.clockLabel) {
            hour = parsed.hour
            minute = parsed.minute
        }
        minute += last.dwellMinutes + returnWalk
        hour += minute / 60
        minute %= 60
        let returnClock = formatClock(hour: hour % 24, minute: minute)
        let visitTotal = built.reduce(0) { $0 + $1.walkMinutes + $1.dwellMinutes }
        return WalkCourse(
            id: id,
            title: title,
            subtitle: subtitle,
            vibe: vibe,
            totalMinutes: max(visitTotal + returnWalk, 20),
            stops: built,
            returnWalkMinutes: returnWalk,
            returnClockLabel: returnClock
        )
    }

    private static func parseClock(_ label: String) -> (hour: Int, minute: Int)? {
        let parts = label.split(separator: ":")
        guard parts.count == 2, let h = Int(parts[0]), let m = Int(parts[1]) else { return nil }
        return (h, m)
    }

    /// 駅を始点・終点にした扇形の並び。最大の空角を帰りに使い、同じ道の往復を避ける。
    private static func orderStopsAsStationLoop(
        stationLat: Double,
        stationLng: Double,
        spots: [Spot]
    ) -> [Spot] {
        guard spots.count > 1 else { return spots }

        struct Angled {
            let spot: Spot
            let angle: Double
        }
        let angled = spots.map { spot -> Angled in
            let angle = atan2(spot.lng - stationLng, spot.lat - stationLat)
            return Angled(spot: spot, angle: angle)
        }
        .sorted { $0.angle < $1.angle }

        // いちばん広い角度のすき間を「帰り」に使う（その向かい側を歩かない）
        var bestGap = -1.0
        var startIdx = 0
        for i in 0..<angled.count {
            let a = angled[i].angle
            let b = i + 1 < angled.count
                ? angled[i + 1].angle
                : angled[0].angle + 2 * .pi
            let gap = b - a
            if gap > bestGap {
                bestGap = gap
                startIdx = (i + 1) % angled.count
            }
        }

        var ordered = (0..<angled.count).map { angled[(startIdx + $0) % angled.count].spot }

        // 始点側は駅から近い方を先に（扇の端のうち近い端から出る）
        if let first = ordered.first, let last = ordered.last {
            let dFirst = Geo.haversineKm(
                lat1: stationLat, lng1: stationLng, lat2: first.lat, lng2: first.lng
            )
            let dLast = Geo.haversineKm(
                lat1: stationLat, lng1: stationLng, lat2: last.lat, lng2: last.lng
            )
            if dLast + 0.05 < dFirst {
                ordered.reverse()
            }
        }

        ordered = twoOptLoop(
            stationLat: stationLat,
            stationLng: stationLng,
            spots: ordered
        )
        return ordered
    }

    /// 周回長（駅→…→駅）を短くする。最初の1か所目は固定。
    private static func twoOptLoop(
        stationLat: Double,
        stationLng: Double,
        spots: [Spot]
    ) -> [Spot] {
        guard spots.count >= 3 else { return spots }
        var best = spots
        var improved = true
        while improved {
            improved = false
            for i in 1..<(best.count - 1) {
                for k in (i + 1)..<best.count {
                    var candidate = best
                    candidate.replaceSubrange(i...k, with: best[i...k].reversed())
                    if loopLengthKm(stationLat: stationLat, stationLng: stationLng, spots: candidate) + 0.02
                        < loopLengthKm(stationLat: stationLat, stationLng: stationLng, spots: best)
                    {
                        best = candidate
                        improved = true
                    }
                }
            }
        }
        return best
    }

    private static func loopLengthKm(
        stationLat: Double,
        stationLng: Double,
        spots: [Spot]
    ) -> Double {
        guard let last = spots.last else { return 0 }
        var lat = stationLat
        var lng = stationLng
        var total = 0.0
        for spot in spots {
            total += Geo.haversineKm(lat1: lat, lng1: lng, lat2: spot.lat, lng2: spot.lng)
            lat = spot.lat
            lng = spot.lng
        }
        total += Geo.haversineKm(
            lat1: last.lat, lng1: last.lng,
            lat2: stationLat, lng2: stationLng
        )
        return total
    }

    private static func rebuildStopsWithLegs(
        stationLat: Double,
        stationLng: Double,
        startHour: Int,
        stay: StayOption,
        spots: [Spot]
    ) -> [CourseStop] {
        var out: [CourseStop] = []
        var hour = startHour
        var minute = 0
        var lat = stationLat
        var lng = stationLng
        for spot in spots {
            let km = Geo.haversineKm(lat1: lat, lng1: lng, lat2: spot.lat, lng2: spot.lng)
            // 道なり係数 1.3 · 徒歩 4.5km/h
            let walk = max(1, min(90, Int((km * 1.3 / 4.5 * 60).rounded())))
            minute += walk
            hour += minute / 60
            minute %= 60
            let clock = formatClock(hour: hour % 24, minute: minute)
            let dwell = dwellMinutes(spot.guide, stay: stay)
            out.append(
                CourseStop(spot: spot, walkMinutes: walk, dwellMinutes: dwell, clockLabel: clock)
            )
            minute += dwell
            hour += minute / 60
            minute %= 60
            lat = spot.lat
            lng = spot.lng
        }
        return out
    }

    /// とりあえずここに行け：secretWorthy を優先してひとつ選ぶ。
    static func pickSecret(_ spots: [Spot]) -> Spot? {
        let marked = spots.filter(\.secretWorthy)
        return (marked.isEmpty ? spots : marked).randomElement()
    }
}
