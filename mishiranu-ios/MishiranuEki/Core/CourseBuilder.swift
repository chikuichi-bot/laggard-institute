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

private struct CourseTemplate {
    let id: String
    let title: String
    let subtitle: String
    let vibe: String
    let prefer: [GuideKind]
}

private let courseTemplates: [CourseTemplate] = [
    CourseTemplate(
        id: "slow",
        title: "ゆる歩きコース",
        subtitle: "景色と休みを多めに",
        vibe: "急がず、土地の気配を拾う",
        prefer: [.sight, .rest, .tip]
    ),
    CourseTemplate(
        id: "taste",
        title: "食べる寄り道コース",
        subtitle: "ご飯と土産を軸に",
        vibe: "空腹と手土産のあいだを歩く",
        prefer: [.meal, .souvenir, .rest]
    ),
    CourseTemplate(
        id: "farther",
        title: "少し先までコース",
        subtitle: "徒歩圏の端まで伸ばす",
        vibe: "駅前を抜けて、ひとつ奥へ",
        prefer: [.tip, .sight, .meal]
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

    static func dwellMinutes(_ guide: GuideKind) -> Int {
        switch guide {
        case .meal: return 25
        case .rest: return 15
        default: return 12
        }
    }

    private static func scoreSpot(
        _ spot: Spot,
        prefer: [GuideKind],
        dayPart: DayPart,
        used: Set<String>,
        prefs: MealPrefs?
    ) -> Double {
        if used.contains(spot.id) { return -1 }
        if !mealFits(spot, dayPart: dayPart) { return -1 }
        var score: Double
        if let preferIdx = prefer.firstIndex(of: spot.guide) {
            score = 40 - Double(preferIdx) * 8
        } else {
            score = 8
        }
        if spot.secretWorthy { score += 6 }
        score += max(0, 18 - Double(spot.walkMinutes) * 0.35)
        score += Double(5 - spot.guide.orderIndex) * 0.4
        score += mealPrefScore(spot, prefs: prefs)
        return score
    }

    static func formatClock(hour: Int, minute: Int) -> String {
        let h = ((hour % 24) + 24) % 24
        let m = max(0, min(59, minute))
        return String(format: "%d:%02d", h, m)
    }

    private static func pickStops(
        pool: [Spot],
        prefer initialPrefer: [GuideKind],
        dayPart: DayPart,
        budgetMinutes: Int,
        startHour: Int,
        prefs: MealPrefs?
    ) -> [CourseStop] {
        var prefer = initialPrefer
        var used = Set<String>()
        var stops: [CourseStop] = []
        var elapsed = 0
        var cursorHour = startHour
        var cursorMinute = 0
        let maxStops = budgetMinutes <= 60 ? 3 : budgetMinutes <= 160 ? 4 : 5

        while stops.count < maxStops {
            var best: Spot?
            var bestScore = -1.0
            for spot in pool {
                let cost = spot.walkMinutes + dwellMinutes(spot.guide)
                if elapsed + cost > budgetMinutes + 8 { continue }
                let score = scoreSpot(spot, prefer: prefer, dayPart: dayPart, used: used, prefs: prefs)
                if score > bestScore {
                    bestScore = score
                    best = spot
                }
            }
            guard let pick = best, bestScore >= 0 else { break }

            let dwell = dwellMinutes(pick.guide)
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

            prefer = Array(prefer.dropFirst()) + [prefer[0]]
        }
        return stops
    }

    static func courses(
        for station: Station,
        stay: StayOption,
        dayPart: DayPart,
        prefs: MealPrefs?
    ) -> [WalkCourse] {
        let fallbackPool = station.spots(for: stay)
        let pool = fallbackPool.filter { mealFits($0, dayPart: dayPart) }
        let budget = stay.budgetMinutes
        let startHour = dayPart.defaultClockHour

        return courseTemplates.compactMap { template in
            let source = pool.count >= 3 ? pool : fallbackPool
            let prefer: [GuideKind]
            if dayPart == .morning && template.id == "taste" {
                prefer = [.meal, .sight, .souvenir]
            } else if dayPart == .night && template.id == "farther" {
                prefer = [.meal, .tip, .rest]
            } else {
                prefer = template.prefer
            }
            let stops = pickStops(
                pool: source,
                prefer: prefer,
                dayPart: dayPart,
                budgetMinutes: budget,
                startHour: startHour,
                prefs: prefs
            )
            guard !stops.isEmpty else { return nil }
            let total = stops.reduce(0) { $0 + $1.walkMinutes + $1.dwellMinutes }
            return WalkCourse(
                id: "\(template.id)-\(stay.rawValue)-\(dayPart.rawValue)",
                title: template.title,
                subtitle: template.subtitle,
                vibe: template.vibe,
                totalMinutes: total > 0 ? total : min(budget, 45),
                stops: stops
            )
        }
    }

    /// とりあえずここに行け：secretWorthy を優先してひとつ選ぶ。
    static func pickSecret(_ spots: [Spot]) -> Spot? {
        let marked = spots.filter(\.secretWorthy)
        return (marked.isEmpty ? spots : marked).randomElement()
    }
}
