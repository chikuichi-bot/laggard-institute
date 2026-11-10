import Foundation

/// 営業時間の文字列から、その時間帯に開いていそうかを見る。
enum HoursOpen {
    /// わからないときは true（落とさない）。閉店と分かるときだけ false。
    static func isLikelyOpen(_ spot: Spot, dayPart: DayPart) -> Bool {
        isLikelyOpen(hours: spot.hours, atHour: dayPart.defaultClockHour, mealTimes: spot.mealTimes, guide: spot.guide)
    }

    static func isLikelyOpen(
        hours: String?,
        atHour hour: Int,
        mealTimes: [MealTime],
        guide: GuideKind
    ) -> Bool {
        let h = ((hour % 24) + 24) % 24
        if let hours, let open = parseOpen(hours: hours, atHour: h) {
            return open
        }
        // hours が無い食事は mealTimes でざっくり
        if guide == .meal {
            let allowed = Set(dayPartMealTimes(forHour: h))
            let times = mealTimes.isEmpty ? [MealTime.lunch] : mealTimes
            return times.contains(where: { allowed.contains($0) })
        }
        // お土産・休みどころで時間が無いものは屋外・不定として残す
        return true
    }

    private static func dayPartMealTimes(forHour hour: Int) -> [MealTime] {
        switch DayPart.from(hour: hour) {
        case .morning: return [.morning]
        case .midday: return [.morning, .lunch]
        case .afternoon: return [.lunch]
        case .evening: return [.lunch, .dinner]
        case .night: return [.dinner]
        }
    }

    /// true=開、false=閉、nil=判定不能
    private static func parseOpen(hours: String, atHour hour: Int) -> Bool? {
        let t = hours.precomposedStringWithCompatibilityMapping
        if t.contains("終日") || t.contains("屋外") || t.contains("24時間") {
            return true
        }
        // 8:30〜17:30 / 8:00-18:00頃 / 11:00～19:00
        let pattern = #"(\d{1,2})\s*[:：]\s*(\d{2})\s*[〜～\-~－—]\s*(\d{1,2})\s*[:：]\s*(\d{2})"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(t.startIndex..<t.endIndex, in: t)
        guard let match = regex.firstMatch(in: t, range: range),
              match.numberOfRanges >= 5,
              let r1 = Range(match.range(at: 1), in: t),
              let r2 = Range(match.range(at: 2), in: t),
              let r3 = Range(match.range(at: 3), in: t),
              let r4 = Range(match.range(at: 4), in: t),
              let oh = Int(t[r1]), let om = Int(t[r2]),
              let ch = Int(t[r3]), let cm = Int(t[r4])
        else { return nil }

        let openMin = oh * 60 + om
        var closeMin = ch * 60 + cm
        // 深夜跨ぎ（22:00〜2:00）
        if closeMin <= openMin { closeMin += 24 * 60 }
        let nowMin = hour * 60 + 30 // 時間帯の真ん中寄り
        let now = nowMin < openMin ? nowMin + 24 * 60 : nowMin
        return now >= openMin && now < closeMin
    }
}
