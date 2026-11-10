import CoreLocation
import Foundation

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

    /// 散歩中心向けの「ベタさ」。近いだけの小社より、土地の顔になる名所を上げる。
    private static func landmarkFameScore(_ spot: Spot) -> Double {
        let n = spot.name
        let blob = n + spot.blurb + (spot.detail ?? "")
        var score = 0.0
        if spot.majorWorthy { score += 40 }
        if spot.guide == .sight { score += 8 }
        // ガイドブック級の社寺・普通の公共の顔
        if FirstVisitFaces.isGuidebookWorship(n) { score += 55 }
        if FirstVisitFaces.isOrdinaryPublicFace(n) || n.contains("合流") { score += 45 }
        if n.contains("城") || n.contains("金閣") || n.contains("清水") || n.contains("浅草") { score += 35 }
        if blob.contains("世界遺産") || blob.contains("観光の") || blob.contains("参道") { score += 20 }
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

    /// 手土産になる名物菓子（お土産タブ／定番名物枠）
    static func isEdibleOmiyage(_ spot: Spot) -> Bool {
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
        // 土地を代表する一軒（出町柳ならふたば）。みたらしは土産リストには出すが定番枠の主ではない
        let blob = spot.name + spot.blurb
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
    static func snapLandmarkPins(_ station: Station) -> Station {
        let filtered = station.relocated(
            center: CLLocationCoordinate2D(latitude: station.lat, longitude: station.lng),
            spots: FirstVisitFaces.filterSpots(station.spots, stationName: station.name)
        )
        return LandmarkRegistry.apply(to: filtered)
    }

    /// 名物菓子を souvenir に寄せる（ご飯だけに閉じない）
    static func normalizeEdibleSouvenirs(_ station: Station) -> Station {
        var spots = station.spots.map { spot -> Spot in
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
            if !spots.contains(where: { $0.name.contains("ふたば") }) {
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
            if !spots.contains(where: { $0.name.contains("進々堂") || $0.name.contains("新進堂") }) {
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
                        detail: "京阪出町柳から枡形へ徒歩数分。昼だけ・売り切れ次第終了。",
                        walkMinutes: 4,
                        secretWorthy: false,
                        majorWorthy: false,
                        lat: 35.03005,
                        lng: 135.76985
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
                        detail: "参道まわり。神社とセットで寄るとわかりやすい。",
                        walkMinutes: 15,
                        secretWorthy: false,
                        majorWorthy: false,
                        lat: 35.0392,
                        lng: 135.7715
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

    /// major を名所2＋名物1に整える（ベタな名所を優先）
    static func balanceMajorsSightseeing(_ station: Station) -> Station {
        var base = station
        // 出町柳は下鴨神社を名所枠に必ず入れる
        if base.name.contains("出町柳"),
           !base.spots.contains(where: { $0.name.contains("下鴨") || $0.name.contains("賀茂御祖") }) {
            let shrine = Spot(
                id: "ai-major-shimogamo",
                name: "下鴨神社（賀茂御祖神社）",
                genre: "history",
                guide: .sight,
                mealTier: .casual,
                mealTimes: [.lunch],
                soloOk: true,
                budgetYen: "",
                hours: "6:30〜17:00（季節により変動）",
                blurb: "世界遺産の社。糺の森を抜けて本殿へ。出町柳の顔になる名所。",
                detail: "駅から北東へ。デルタを経由すると道がわかりやすい。",
                walkMinutes: 12,
                secretWorthy: false,
                majorWorthy: true,
                lat: 35.0387,
                lng: 135.7727
            )
            base = Station(
                id: base.id, name: base.name, nameReading: base.nameReading,
                line: base.line, prefecture: base.prefecture, region: base.region,
                mood: base.mood, radiiKm: base.radiiKm, stationIntro: base.stationIntro,
                areaAbout: base.areaAbout, walkGuide: base.walkGuide,
                historyNotes: base.historyNotes, sightseeingNotes: base.sightseeingNotes,
                bikeRental: base.bikeRental, tourTitle: base.tourTitle,
                catchCopy: base.catchCopy, emptyCopy: base.emptyCopy,
                lat: base.lat, lng: base.lng, spots: base.spots + [shrine]
            )
        }

        let majors = base.spots.filter(\.majorWorthy)
        let landmarks = (majors.filter { $0.guide == .sight || isLandmarkName($0.name) }
            + base.spots.filter { $0.guide == .sight || isLandmarkName($0.name) })
            .reduce(into: [Spot]()) { acc, s in
                if !acc.contains(where: { $0.id == s.id }) { acc.append(s) }
            }
            .sorted { landmarkFameScore($0) > landmarkFameScore($1) }
        let foods = base.spots.filter { isFoodGuide($0.guide) }
        let iconic = base.spots.first(where: { $0.name.contains("ふたば") })
            ?? foods.first(where: isIconicShop)
            ?? majors.first(where: { isFoodGuide($0.guide) })

        // 有名度で名所2 + 名物1（駅固有の固定リストではなくスコアで土地の顔を決める）
        var keep: [Spot] = []
        for s in landmarks where keep.count < 2 {
            if s.name.contains("幸神社") || isGenericNeighborhoodCafe(s) { continue }
            if !keep.contains(where: { $0.id == s.id }) { keep.append(s) }
        }
        if let iconic, keep.count < 3, !isGenericNeighborhoodCafe(iconic) {
            keep.append(iconic)
        }
        for s in landmarks where keep.count < 3 {
            if s.name.contains("幸神社") || isGenericNeighborhoodCafe(s) { continue }
            if !keep.contains(where: { $0.id == s.id }) { keep.append(s) }
        }
        return withMajorFlags(base, ids: Set(keep.prefix(3).map(\.id)))
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
           !station.spots.contains(where: { $0.name.contains("ふたば") }) {
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
            ? base.spots.first(where: { $0.name.contains("ふたば") })
            : nil
        let iconic = demachiFutaba
            ?? shops.first(where: isIconicShop)
            ?? shops.first(where: { $0.name.contains(SavedStationStore.bareName(base.name)) && $0.guide == .meal })
        guard let must = iconic else { return base }
        let station = base

        var majors = station.spots.filter(\.majorWorthy)
        if majors.contains(where: { $0.id == must.id }) {
            if majors.count <= 3 { return station }
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
        } else if majors.count >= 3, !majors.contains(where: { $0.id == must.id }) {
            if let far = majors.filter({ !isLandmarkName($0.name) }).max(by: { $0.walkMinutes < $1.walkMinutes }) {
                majors.removeAll { $0.id == far.id }
            }
        }
        if !majors.contains(where: { $0.id == must.id }) {
            majors.append(must)
        }
        var ids = Set(majors.map(\.id))
        // landmark を優先して3件に
        var keep: [String] = [must.id]
        for m in majors where isLandmarkName(m.name) && keep.count < 3 {
            if !keep.contains(m.id) { keep.append(m.id) }
        }
        for m in majors.sorted(by: { $0.walkMinutes < $1.walkMinutes }) where keep.count < 3 {
            if !keep.contains(m.id) { keep.append(m.id) }
        }
        ids = Set(keep)
        return balanceMajorsSightseeing(withMajorFlags(station, ids: ids))
    }

    /// 保存データに major 印が無いとき、名所・近い店を定番候補にする（サーバ再生成前の保険）
    static func ensureLocalMajors(_ station: Station) -> Station {
        let sealed = balanceMajorsSightseeing(sealIconicMajors(station))
        let marked = sealed.spots.filter(\.majorWorthy)
        if marked.count >= 3 { return sealed }
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
            if spot.name.contains("ふたば") { score += 40 }
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
            ($0.0.guide == .meal || $0.0.guide == .souvenir) && (isIconicShop($0.0) || $0.0.name.contains("ふたば"))
        })?.0 ?? scored.first(where: { $0.0.guide == .meal })?.0 {
            if !picked.contains(where: { $0.id == shop.id }) { picked.append(shop) }
        }
        for row in scored where picked.count < 3 {
            if !picked.contains(where: { $0.id == row.0.id }) {
                picked.append(row.0)
            }
        }
        return balanceMajorsSightseeing(withMajorFlags(sealed, ids: Set(picked.prefix(3).map(\.id))))
    }

    static func courses(
        for station: Station,
        stay: StayOption,
        dayPart: DayPart,
        prefs: MealPrefs?
    ) -> [WalkCourse] {
        let prepared = snapLandmarkPins(
            BikeRentalSeal.ensure(ensureLocalMajors(normalizeEdibleSouvenirs(station)))
        )
        let walkPool = prepared.spots(for: stay)
        // コース用は朝でもランチを残す。案内タブの全件表示とは別。閉店店は入れない。
        let pool = walkPool.filter {
            mealFitsForCourse($0, dayPart: dayPart)
                && (!isFoodGuide($0.guide) || HoursOpen.isLikelyOpen($0, dayPart: dayPart))
        }
        let openWalk = walkPool.filter {
            !isFoodGuide($0.guide) || HoursOpen.isLikelyOpen($0, dayPart: dayPart)
        }
        let source = pool.count >= 3 ? pool : openWalk
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
            // ジャンル優先で拾ったあとに、駅起点で往復しにくい順へ並べ替える
            let stops = orderStopsAlongWalk(
                stationLat: prepared.lat,
                stationLng: prepared.lng,
                startHour: startHour,
                stay: stay,
                stops: rawStops
            )
            // 次のコースが同じ2か所から始まらないよう、先頭寄りの停留を確保
            for stop in stops.prefix(2) {
                claimed.insert(stop.spot.id)
            }
            let total = stops.reduce(0) { $0 + $1.walkMinutes + $1.dwellMinutes }
            return WalkCourse(
                id: "\(template.id)-\(stay.rawValue)-\(dayPart.rawValue)",
                title: template.title,
                subtitle: "\(template.subtitle) · \(stay.courseLengthHint)",
                vibe: template.vibe,
                totalMinutes: total > 0 ? total : min(budget, 45),
                stops: stops
            )
        }
    }

    /// 駅から出発し、いまの位置からいちばん近い未訪問へ進む。小さな2-optで交差を減らす。
    private static func orderStopsAlongWalk(
        stationLat: Double,
        stationLng: Double,
        startHour: Int,
        stay: StayOption,
        stops: [CourseStop]
    ) -> [CourseStop] {
        guard stops.count > 1 else { return stops }
        var remaining = stops.map(\.spot)
        var ordered: [Spot] = []
        var curLat = stationLat
        var curLng = stationLng
        while !remaining.isEmpty {
            let bestIdx = remaining.indices.min(by: { i, j in
                let di = Geo.haversineKm(
                    lat1: curLat, lng1: curLng,
                    lat2: remaining[i].lat, lng2: remaining[i].lng
                )
                let dj = Geo.haversineKm(
                    lat1: curLat, lng1: curLng,
                    lat2: remaining[j].lat, lng2: remaining[j].lng
                )
                return di < dj
            })!
            let next = remaining.remove(at: bestIdx)
            ordered.append(next)
            curLat = next.lat
            curLng = next.lng
        }
        ordered = twoOptPath(stationLat: stationLat, stationLng: stationLng, spots: ordered)
        return rebuildStopsWithLegs(
            stationLat: stationLat,
            stationLng: stationLng,
            startHour: startHour,
            stay: stay,
            spots: ordered
        )
    }

    /// 固定の出発点付きパスの2-opt（交差・遠回りを軽く減らす）。
    private static func twoOptPath(stationLat: Double, stationLng: Double, spots: [Spot]) -> [Spot] {
        guard spots.count >= 3 else { return spots }
        var best = spots
        var improved = true
        while improved {
            improved = false
            for i in 0..<(best.count - 1) {
                for k in (i + 1)..<best.count {
                    var candidate = best
                    candidate.replaceSubrange(i...k, with: best[i...k].reversed())
                    if pathLengthKm(stationLat: stationLat, stationLng: stationLng, spots: candidate) + 0.02
                        < pathLengthKm(stationLat: stationLat, stationLng: stationLng, spots: best) {
                        best = candidate
                        improved = true
                    }
                }
            }
        }
        return best
    }

    private static func pathLengthKm(stationLat: Double, stationLng: Double, spots: [Spot]) -> Double {
        var lat = stationLat
        var lng = stationLng
        var total = 0.0
        for spot in spots {
            total += Geo.haversineKm(lat1: lat, lng1: lng, lat2: spot.lat, lng2: spot.lng)
            lat = spot.lat
            lng = spot.lng
        }
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
            let clock = formatClock(hour: hour, minute: minute)
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
