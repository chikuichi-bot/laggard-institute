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
                .lineSpacing(6)
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
            VStack(spacing: 12) {
                Button {
                    model.startArrival()
                } label: {
                    Label {
                        Text("知らない駅に到着")
                    } icon: {
                        PictogramIcon(.arrival, size: 20)
                    }
                }
                .buttonStyle(PrimaryButtonStyle())

                Button("出町柳ですぐ見る") {
                    model.quickDemo()
                }
                .buttonStyle(PrimaryButtonStyle(filled: false))
            }
            Text("収録 \(model.stations.count) 駅 · 位置情報は端末の外に送りません")
                .font(.caption)
                .foregroundStyle(Palette.mist)
                .frame(maxWidth: .infinity)
                .padding(.top, 14)
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
