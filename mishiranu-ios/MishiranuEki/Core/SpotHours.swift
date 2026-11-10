import Foundation

/// ご飯・お土産の営業時間表示。分かっているときだけ書く。無いときは書かない。
enum SpotHours {
    static func display(for spot: Spot) -> String? {
        cleaned(spot.hours)
    }

    private static func cleaned(_ hours: String?) -> String? {
        let t = hours?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return t.isEmpty ? nil : t
    }
}
