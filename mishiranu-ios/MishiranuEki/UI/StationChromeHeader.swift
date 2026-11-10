import SwiftUI

/// 駅名ピル。地図・土地・歩く／案内／設定で共通。見た目は A/C に追従。
struct StationChromeHeader: View {
    @Environment(AppModel.self) private var model
    @Environment(ThemeStore.self) private var theme
    let station: Station

    private var courseTitle: String {
        model.selectedCourse?.title ?? station.tourTitle
    }

    private var metaLine: String {
        "\(model.dayPart.label) · \(model.stay.label)"
    }

    private var pillCorner: CGFloat { theme.skin == .board ? 4 : 2 }

    private var pillFill: Color {
        theme.skin == .board ? Palette.warm : Palette.ink
    }

    private var pillText: Color {
        theme.skin == .board ? Palette.canvas : Palette.paper
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .center, spacing: 8) {
                Button {
                    model.startArrival()
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Palette.ink)
                        .frame(width: 32, height: 32)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("駅を探し直す")

                Text(station.name)
                    .font(.system(.subheadline, design: .default).weight(.bold))
                    .foregroundStyle(pillText)
                    .tracking(0.8)
                    .lineLimit(1)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 5)
                    .background(
                        RoundedRectangle(cornerRadius: pillCorner, style: .continuous)
                            .fill(pillFill)
                    )

                Text(courseTitle)
                    .font(.system(.footnote))
                    .foregroundStyle(Palette.fog)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Text(metaLine)
                .font(.caption2)
                .foregroundStyle(Palette.mist)
                .padding(.leading, 40)
        }
        .padding(.horizontal, 14)
        .padding(.top, 8)
        .padding(.bottom, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.paper)
        .overlay(alignment: .bottom) { Divider().overlay(Palette.line) }
    }
}
