import SwiftUI

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xff) / 255,
            green: Double((hex >> 8) & 0xff) / 255,
            blue: Double(hex & 0xff) / 255,
            opacity: opacity
        )
    }
}

enum Palette {
    /// 設定の見た目（A/C）に追従。切替時は RootView の .id(skin) で再描画。
    @MainActor private static var tokens: SkinTokens {
        SkinTokens.tokens(for: ThemeStore.shared.skin)
    }

    @MainActor static var ink: Color { tokens.ink }
    @MainActor static var body: Color { tokens.body }
    @MainActor static var fog: Color { tokens.fog }
    @MainActor static var mist: Color { tokens.mist }
    @MainActor static var paper: Color { tokens.paper }
    @MainActor static var canvas: Color { tokens.canvas }
    @MainActor static var warm: Color { tokens.warm }
    @MainActor static var warmDeep: Color { tokens.warmDeep }
    @MainActor static var river: Color { tokens.river }
    @MainActor static var moss: Color { tokens.moss }
    @MainActor static var taupe: Color { tokens.taupe }
    @MainActor static var gold: Color { tokens.gold }
    @MainActor static var line: Color { tokens.line }
}

extension GuideKind {
    var color: Color {
        switch self {
        case .meal: return Color(hex: 0xb5493a)
        case .souvenir: return Color(hex: 0x9a7a8c)
        case .sight: return Color(hex: 0x5f7d6a)
        case .rest: return Color(hex: 0xc5a059)
        case .tip: return Color(hex: 0x6b8cca)
        }
    }

    var pictogram: Pictogram {
        switch self {
        case .meal: return .restaurant
        case .souvenir: return .gift
        case .sight: return .photoSpot
        case .rest: return .waitingArea
        case .tip: return .ancientRoad
        }
    }
}

extension DayPart {
    var pictogram: Pictogram {
        switch self {
        case .morning: return .sunrise
        case .midday: return .sunny
        case .afternoon: return .partiallySunny
        case .evening: return .sunset
        case .night: return .nightSky
        }
    }
}

extension TourTab {
    var pictogram: Pictogram {
        switch self {
        case .map: return .destination
        case .place: return .history
        case .walk: return .trekking
        case .guide: return .information
        case .more: return .menu
        }
    }
}

extension Font {
    /// A/C ともゴシック（交通・地図の顔）。
    static func mincho(_ style: Font.TextStyle, weight: Font.Weight = .regular) -> Font {
        .system(style, design: .default).weight(weight)
    }

    /// ゴシックの意味階層を保ったまま Dynamic Type に追従する。
    static func readable(_ style: Font.TextStyle, weight: Font.Weight = .regular) -> Font {
        .system(style).weight(weight)
    }
}

struct Kicker: View {
    let text: String
    var pictogram: Pictogram?

    var body: some View {
        HStack(spacing: 6) {
            if let pictogram {
                PictogramIcon(pictogram, size: 13)
            }
            Text(text)
                .font(.caption2.weight(.semibold))
                .tracking(1.6)
        }
        .foregroundStyle(Palette.mist)
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    var filled = true

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.mincho(.body, weight: .semibold))
            .padding(.vertical, 15)
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity)
            .foregroundStyle(filled ? Palette.paper : Palette.ink)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(filled ? (configuration.isPressed ? Palette.warmDeep : Palette.warm) : Palette.paper)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(filled ? Color.clear : Palette.line, lineWidth: 1)
            )
            .opacity(configuration.isPressed && !filled ? 0.7 : 1)
            .onChange(of: configuration.isPressed) { _, pressed in
                if pressed { Haptics.tap() }
            }
    }
}

struct ChipButtonStyle: ButtonStyle {
    var primary = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.medium))
            .padding(.vertical, 11)
            .padding(.horizontal, 15)
            .foregroundStyle(primary ? Palette.paper : Palette.ink)
            .background(
                Capsule().fill(primary ? Palette.warm : Palette.paper)
            )
            .overlay(Capsule().stroke(primary ? Color.clear : Palette.line, lineWidth: 1))
            .opacity(configuration.isPressed ? 0.7 : 1)
            .onChange(of: configuration.isPressed) { _, pressed in
                if pressed { Haptics.tap() }
            }
    }
}

/// `.plain` 相当。見た目はそのまま、タップで軽い振動。
struct PlainHapticButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .onChange(of: configuration.isPressed) { _, pressed in
                if pressed { Haptics.tapLight() }
            }
    }
}

struct Card<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Palette.paper)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Palette.line, lineWidth: 1)
        )
    }
}

/// 折り返して並べるチップ用レイアウト。
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var maxX: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0 && x + size.width > width {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            maxX = max(maxX, x - spacing)
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: proposal.width ?? maxX, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > bounds.minX && x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
