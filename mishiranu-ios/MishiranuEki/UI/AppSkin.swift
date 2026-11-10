import SwiftUI

/// 見た目の方向。設定で A / C を選べる。
enum AppSkin: String, CaseIterable, Identifiable, Hashable {
    case board
    case topo

    var id: String { rawValue }

    var label: String {
        switch self {
        case .board: return "ホームの時刻表"
        case .topo: return "ポケット地形図"
        }
    }

    var codeLabel: String {
        switch self {
        case .board: return "A"
        case .topo: return "C"
        }
    }

    var blurb: String {
        switch self {
        case .board: return "暗い電光掲示。到着の情報板。"
        case .topo: return "折り畳み地図。歩くための帳面。"
        }
    }

    var preferredColorScheme: ColorScheme {
        switch self {
        case .board: return .dark
        case .topo: return .light
        }
    }

    private static let storageKey = "mishiranu.skin"

    static func load() -> AppSkin {
        if let raw = UserDefaults.standard.string(forKey: storageKey),
           let skin = AppSkin(rawValue: raw)
        {
            return skin
        }
        return .board
    }

    static func save(_ skin: AppSkin) {
        UserDefaults.standard.set(skin.rawValue, forKey: storageKey)
    }
}

@MainActor
@Observable
final class ThemeStore {
    static let shared = ThemeStore()

    var skin: AppSkin {
        didSet { AppSkin.save(skin) }
    }

    private init() {
        skin = AppSkin.load()
    }
}

struct SkinTokens {
    let ink: Color
    let body: Color
    let fog: Color
    let mist: Color
    let paper: Color
    let canvas: Color
    let warm: Color
    let warmDeep: Color
    let river: Color
    let moss: Color
    let taupe: Color
    let gold: Color
    let line: Color

    static func tokens(for skin: AppSkin) -> SkinTokens {
        switch skin {
        case .board:
            return SkinTokens(
                ink: Color(hex: 0xe8edf5),
                body: Color(hex: 0xc9d2e0),
                fog: Color(hex: 0x9aa6b8),
                mist: Color(hex: 0x7a8699),
                paper: Color(hex: 0x1a1f28),
                canvas: Color(hex: 0x12151a),
                warm: Color(hex: 0xf0b429),
                warmDeep: Color(hex: 0xd9a01f),
                river: Color(hex: 0x3d8bfd),
                moss: Color(hex: 0x5f8f7a),
                taupe: Color(hex: 0x3a4558),
                gold: Color(hex: 0xf0b429),
                line: Color(hex: 0x2a3342)
            )
        case .topo:
            return SkinTokens(
                ink: Color(hex: 0x2c3328),
                body: Color(hex: 0x3a4236),
                fog: Color(hex: 0x5c6556),
                mist: Color(hex: 0x6e7768),
                paper: Color(hex: 0xefece2),
                canvas: Color(hex: 0xe6e2d6),
                warm: Color(hex: 0x4f6b4a),
                warmDeep: Color(hex: 0x3f5740),
                river: Color(hex: 0x3d5f78),
                moss: Color(hex: 0x4f6b4a),
                taupe: Color(hex: 0xb8b39c),
                gold: Color(hex: 0x8b4a3a),
                line: Color(hex: 0xc9c4b4)
            )
        }
    }
}
