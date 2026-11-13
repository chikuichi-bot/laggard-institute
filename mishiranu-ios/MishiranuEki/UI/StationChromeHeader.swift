import SwiftUI

/// 駅ヘッド。地図・土地・歩く／案内／設定で共通。「京阪電車　出町柳駅」を画面中央に。
struct StationChromeHeader: View {
    @Environment(AppModel.self) private var model
    @Environment(ThemeStore.self) private var theme
    let station: Station

    private var quietPaper: Bool { theme.skin == .ma }

    private var pillCorner: CGFloat {
        switch theme.skin {
        case .ma: return 0
        case .board: return 4
        case .topo: return 2
        }
    }

    private var pillFill: Color {
        switch theme.skin {
        case .ma: return .clear
        case .board: return Palette.warm
        case .topo: return Palette.ink
        }
    }

    private var pillText: Color {
        switch theme.skin {
        case .ma: return Palette.ink
        case .board: return Palette.canvas
        case .topo: return Palette.paper
        }
    }

    var body: some View {
        ZStack {
            Text(station.chromeStationLabel)
                .font(
                    quietPaper
                        ? .system(.subheadline, design: .serif).weight(.medium)
                        : .system(.subheadline, design: .default).weight(.bold)
                )
                .foregroundStyle(pillText)
                .tracking(quietPaper ? 1.2 : 0.6)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
                .padding(.horizontal, quietPaper ? 4 : 12)
                .padding(.vertical, quietPaper ? 4 : 5)
                .background(
                    RoundedRectangle(cornerRadius: pillCorner, style: .continuous)
                        .fill(pillFill)
                )
                .overlay(alignment: .bottom) {
                    if quietPaper {
                        Rectangle()
                            .fill(Palette.ink.opacity(0.35))
                            .frame(height: 1)
                    }
                }
                .padding(.horizontal, 44)
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)

            HStack {
                Button {
                    model.goHero()
                } label: {
                    // 文言なし。英語の top は違和感。行き先は「駅を探し直す」。
                    Image(systemName: "chevron.left")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Palette.ink)
                        .padding(.trailing, 4)
                        .frame(minWidth: 44, minHeight: 32, alignment: .leading)
                        .contentShape(Rectangle())
                }
                .buttonStyle(PlainHapticButtonStyle())
                .accessibilityLabel("駅を探し直す")
                Spacer(minLength: 0)
            }
        }
        .padding(.horizontal, 14)
        .padding(.top, 8)
        .padding(.bottom, 10)
        .frame(maxWidth: .infinity)
        .background(Palette.paper)
        .overlay(alignment: .bottom) { Divider().overlay(Palette.line) }
    }
}
