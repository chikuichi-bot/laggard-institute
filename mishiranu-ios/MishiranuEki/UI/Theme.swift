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
    static let ink = Color(hex: 0x1f1b17)
    /// 土地ページ本文向け。ink より一段濃く、紙面でも薄く見えない。
    static let body = Color(hex: 0x12100e)
    static let fog = Color(hex: 0x4a433a)
    static let mist = Color(hex: 0x6e675e)
    static let paper = Color(hex: 0xf9f4e6)
    static let canvas = Color(hex: 0xf5eedc)
    static let warm = Color(hex: 0xb5493a)
    static let warmDeep = Color(hex: 0x9a3d31)
    static let river = Color(hex: 0x6b8cca)
    static let moss = Color(hex: 0x5f7d6a)
    static let taupe = Color(hex: 0xc1b4a4)
    static let gold = Color(hex: 0xc5a059)
    static let line = Color(hex: 0xe3d5c1)
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
    static func mincho(_ style: Font.TextStyle, weight: Font.Weight = .regular) -> Font {
        .system(style, design: .serif).weight(weight)
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
            .padding(.vertical, 14)
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
    }
}

struct ChipButtonStyle: ButtonStyle {
    var primary = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.medium))
            .padding(.vertical, 10)
            .padding(.horizontal, 14)
            .foregroundStyle(primary ? Palette.paper : Palette.ink)
            .background(
                Capsule().fill(primary ? Palette.warm : Palette.paper)
            )
            .overlay(Capsule().stroke(primary ? Color.clear : Palette.line, lineWidth: 1))
            .opacity(configuration.isPressed ? 0.7 : 1)
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
