import SwiftUI

/// 駅ヘッド。地図・土地・歩く／案内／設定で共通。「京阪電車　出町柳駅」を画面中央に。
struct StationChromeHeader: View {
    @Environment(AppModel.self) private var model
    @Environment(ThemeStore.self) private var theme
    let station: Station

    private var pillCorner: CGFloat { theme.skin == .board ? 4 : 2 }

    private var pillFill: Color {
        theme.skin == .board ? Palette.warm : Palette.ink
    }

    private var pillText: Color {
        theme.skin == .board ? Palette.canvas : Palette.paper
    }

    var body: some View {
        ZStack {
            Text(station.chromeStationLabel)
                .font(.system(.subheadline, design: .default).weight(.bold))
                .foregroundStyle(pillText)
                .tracking(0.6)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
                .padding(.horizontal, 12)
                .padding(.vertical, 5)
                .background(
                    RoundedRectangle(cornerRadius: pillCorner, style: .continuous)
                        .fill(pillFill)
                )
                .padding(.horizontal, 44)
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)

            HStack {
                Button {
                    model.goHero()
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Palette.ink)
                        .frame(width: 32, height: 32)
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
