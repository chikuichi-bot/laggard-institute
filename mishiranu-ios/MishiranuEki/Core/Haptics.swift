import UIKit

/// ボタンタップの短い振動（相対性理論計と同じ系統）。
enum Haptics {
    private static let light = UIImpactFeedbackGenerator(style: .light)
    private static let medium = UIImpactFeedbackGenerator(style: .medium)

    static func prepare() {
        light.prepare()
        medium.prepare()
    }

    /// 主ボタン・チップなど、はっきりした操作。
    static func tap() {
        medium.impactOccurred(intensity: 0.85)
        medium.prepare()
    }

    /// タブ・リスト行など、軽い操作。
    static func tapLight() {
        light.impactOccurred(intensity: 0.7)
        light.prepare()
    }
}
