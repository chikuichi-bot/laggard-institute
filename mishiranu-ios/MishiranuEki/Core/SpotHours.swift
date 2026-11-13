import Foundation

/// ご飯・お土産の営業時間表示。分かっているときだけ書く。無いときは書かない。
enum SpotHours {
    static func display(for spot: Spot) -> String? {
        cleaned(spot.hours)
    }

    /// 営業確認の逃げ道を付ける店寄りの案内。
    static func isShopLike(_ spot: Spot) -> Bool {
        switch spot.guide {
        case .meal, .souvenir:
            return true
        case .rest:
            // 「終日（屋外）」はベンチ等 → 免責不要
            let hours = cleaned(spot.hours) ?? ""
            return !hours.contains("屋外")
        case .sight, .tip:
            return false
        }
    }

    private static func cleaned(_ hours: String?) -> String? {
        let t = hours?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return t.isEmpty ? nil : t
    }
}

enum SpotDistance {
    /// 徒歩分と、目安のメートル（分×80m）。すぐ戻れる距離だと分かる文言。
    static func caption(walkMinutes: Int) -> String {
        let m = max(1, walkMinutes)
        let meters = m * 80
        if meters >= 1000 {
            let km = Double(meters) / 1000.0
            return String(format: "駅から徒歩約 %d 分（約 %.1f km・すぐ戻れる）", m, km)
        }
        return "駅から徒歩約 \(m) 分（約 \(meters) m・すぐ戻れる）"
    }
}
