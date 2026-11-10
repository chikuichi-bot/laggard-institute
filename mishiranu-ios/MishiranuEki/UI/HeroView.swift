import SwiftUI

struct HeroView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer(minLength: 40)
            PictogramIcon(.train, size: 56)
                .foregroundStyle(Palette.warm)
                .padding(.bottom, 28)
            Kicker(text: "LAGADO LAB")
                .padding(.bottom, 10)
            Text("見知らぬ駅")
                .font(.system(size: 48, weight: .semibold, design: .serif))
                .foregroundStyle(Palette.ink)
                .padding(.bottom, 18)
            Text("降りた駅の、徒歩圏だけを、物語にする。予定のない寄り道を、いまここから。")
                .font(.mincho(.body))
                .foregroundStyle(Palette.fog)
                .lineSpacing(8)
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
            VStack(spacing: 14) {
                Button {
                    model.startArrival()
                } label: {
                    Label {
                        Text("知らない駅に到着")
                    } icon: {
                        PictogramIcon(.arrival, size: 24)
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
            }
            Text(model.savedCount > 0
                ? "保存 \(model.savedCount) 駅 · 検索した駅だけがここに残ります"
                : "駅を検索すると、ここに少しずつ貯まります")
                .font(.readable(.caption))
                .foregroundStyle(Palette.mist)
                .frame(maxWidth: .infinity)
                .padding(.top, 16)
                .padding(.bottom, 8)
        }
        .padding(.horizontal, 28)
        .padding(.bottom, 16)
        .background(
            LinearGradient(colors: [Palette.paper, Palette.canvas], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
        )
    }
}
