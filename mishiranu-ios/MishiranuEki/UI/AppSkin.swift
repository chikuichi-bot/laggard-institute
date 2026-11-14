import MapKit
import SwiftUI

/// 見た目の方向。設定で選べる。既定はトップと同じ文庫の紙。
enum AppSkin: String, CaseIterable, Identifiable, Hashable {
    case ma
    case board
    case topo

    var id: String { rawValue }

    var label: String {
        switch self {
        case .ma: return "文庫の紙"
        case .board: return "ホームの時刻表"
        case .topo: return "ポケット地形図"
        }
    }

    var codeLabel: String {
        switch self {
        case .ma: return "本"
        case .board: return "A"
        case .topo: return "C"
        }
    }

    var blurb: String {
        switch self {
        case .ma: return "トップと同じ余白。小説の紙。"
        case .board: return "暗い電光掲示。到着の情報板。"
        case .topo: return "折り畳み地図。歩くための帳面。"
        }
    }

    var preferredColorScheme: ColorScheme {
        switch self {
        case .ma, .topo: return .light
        case .board: return .dark
        }
    }

    private static let storageKey = "mishiranu.skin"
    private static let pickedKey = "mishiranu.skin.picked"

    static func load() -> AppSkin {
        let defaults = UserDefaults.standard
        let picked = defaults.bool(forKey: pickedKey)
        if let raw = defaults.string(forKey: storageKey),
           let skin = AppSkin(rawValue: raw)
        {
            // 旧既定の board は、トップ（文庫の余白）に寄せる
            if skin == .board, !picked {
                save(.ma, markPicked: false)
                return .ma
            }
            return skin
        }
        return .ma
    }

    static func save(_ skin: AppSkin, markPicked: Bool = true) {
        UserDefaults.standard.set(skin.rawValue, forKey: storageKey)
        if markPicked {
            UserDefaults.standard.set(true, forKey: pickedKey)
        }
    }
}

/// 文字の大きさ。標準はシステム（Dynamic Type）に合わせる。
enum TextSizePref: String, CaseIterable, Identifiable {
    case system
    case large
    case xlarge

    var id: String { rawValue }

    var label: String {
        switch self {
        case .system: return "標準"
        case .large: return "やや大きい"
        case .xlarge: return "大きい"
        }
    }

    /// システムより小さくはしない。大きめ／大きいだけ床を上げる。
    func resolve(_ system: DynamicTypeSize) -> DynamicTypeSize {
        switch self {
        case .system:
            return system
        case .large:
            return max(system, .xLarge)
        case .xlarge:
            return max(system, .xxLarge)
        }
    }

    func next() -> TextSizePref {
        let all = Self.allCases
        guard let i = all.firstIndex(of: self) else { return .system }
        return all[(i + 1) % all.count]
    }

    private static let storageKey = "mishiranu.textSize"

    static func load() -> TextSizePref {
        guard let raw = UserDefaults.standard.string(forKey: storageKey),
              let pref = TextSizePref(rawValue: raw)
        else { return .system }
        return pref
    }

    static func save(_ pref: TextSizePref) {
        UserDefaults.standard.set(pref.rawValue, forKey: storageKey)
    }
}

/// 地図の詳細。すっきり＝番号ピンだけ、くわしく＝おすすめの名前も出す。
/// Apple の店・施設 POI はどちらでも出さない（散歩の点と紛らわしい）。
enum MapDetailPref: String, CaseIterable, Identifiable {
    case clean
    case rich

    var id: String { rawValue }

    var label: String {
        switch self {
        case .clean: return "すっきり"
        case .rich: return "くわしく"
        }
    }

    var pointsOfInterest: PointOfInterestCategories {
        // 設定のどちらでも Apple POI は抑える。TourMap は mapStyle 側でも excludingAll。
        .excludingAll
    }

    func next() -> MapDetailPref {
        let all = Self.allCases
        guard let i = all.firstIndex(of: self) else { return .clean }
        return all[(i + 1) % all.count]
    }

    private static let storageKey = "mishiranu.mapDetail"

    static func load() -> MapDetailPref {
        guard let raw = UserDefaults.standard.string(forKey: storageKey),
              let pref = MapDetailPref(rawValue: raw)
        else { return .clean }
        return pref
    }

    static func save(_ pref: MapDetailPref) {
        UserDefaults.standard.set(pref.rawValue, forKey: storageKey)
    }
}

@MainActor
@Observable
final class ThemeStore {
    static let shared = ThemeStore()

    var skin: AppSkin {
        didSet { AppSkin.save(skin) }
    }

    var textSize: TextSizePref {
        didSet { TextSizePref.save(textSize) }
    }

    var mapDetail: MapDetailPref {
        didSet { MapDetailPref.save(mapDetail) }
    }

    private init() {
        skin = AppSkin.load()
        textSize = TextSizePref.load()
        mapDetail = MapDetailPref.load()
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
        case .ma:
            return SkinTokens(
                ink: Color(hex: 0x2a241c),
                body: Color(hex: 0x3d362c),
                fog: Color(hex: 0x5c5348),
                mist: Color(hex: 0x8a7d6b),
                paper: Color(hex: 0xf8f5ee),
                canvas: Color(hex: 0xf8f5ee),
                warm: Color(hex: 0x2a241c),
                warmDeep: Color(hex: 0x1a1612),
                river: Color(hex: 0x6b7c8a),
                moss: Color(hex: 0x5f6b58),
                taupe: Color(hex: 0xc9c0b0),
                gold: Color(hex: 0x8a7d6b),
                line: Color(hex: 0xddd4c4)
            )
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
