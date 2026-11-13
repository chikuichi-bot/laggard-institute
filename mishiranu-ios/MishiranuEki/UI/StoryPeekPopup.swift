import SwiftUI

/// コイン前の無料チラ見せ。物語のゆかりだけを出し、散歩道（本案内）へ進むか聞く。
struct StoryPeekPopup: View {
    var stationLabel: String
    var notes: [HistoryNote]
    var confirmLabel: String
    var coinAsk: String
    var onConfirm: () -> Void
    var onCancel: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.34)
                .ignoresSafeArea()
                .onTapGesture(perform: onCancel)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 8) {
                    PictogramIcon(.train, size: 16)
                        .foregroundStyle(Palette.warm)
                    Text("見知らぬ駅 · 物語のゆかり")
                        .font(.readable(.caption2, weight: .semibold))
                        .tracking(1.2)
                        .foregroundStyle(Palette.mist)
                    Spacer(minLength: 0)
                }
                .padding(.bottom, 12)

                Rectangle()
                    .fill(Palette.line)
                    .frame(height: 1)
                    .padding(.bottom, 1)
                Rectangle()
                    .fill(Palette.ink.opacity(0.55))
                    .frame(height: 1)
                    .padding(.bottom, 16)

                Text("「\(stationLabel)」")
                    .font(.mincho(.title3, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.bottom, 6)

                Text("まずは無料で、物語のゆかりだけ。")
                    .font(.mincho(.callout))
                    .foregroundStyle(Palette.fog)
                    .padding(.bottom, 14)

                if notes.isEmpty {
                    Text("確かな物語のゆかりは見つかりませんでした。散歩道を調べると、土地の歩き方と一緒に見つかることがあります。")
                        .font(.mincho(.callout))
                        .foregroundStyle(Palette.fog)
                        .lineSpacing(5)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.bottom, 18)
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            ForEach(Array(notes.prefix(4).enumerated()), id: \.offset) { _, note in
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(note.title)
                                        .font(.mincho(.subheadline, weight: .semibold))
                                        .foregroundStyle(Palette.ink)
                                        .fixedSize(horizontal: false, vertical: true)
                                    Text(note.body)
                                        .font(.mincho(.callout))
                                        .foregroundStyle(Palette.fog)
                                        .lineSpacing(5)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }
                    }
                    .frame(maxHeight: 280)
                    .padding(.bottom, 16)
                }

                Text(coinAsk)
                    .font(.mincho(.callout))
                    .foregroundStyle(Palette.fog)
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.bottom, 16)

                Button(action: onConfirm) {
                    Text(confirmLabel)
                        .font(.mincho(.body, weight: .semibold))
                        .tracking(2)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .foregroundStyle(Palette.paper)
                        .background(
                            RoundedRectangle(cornerRadius: 4, style: .continuous)
                                .fill(Palette.ink)
                        )
                }
                .buttonStyle(PlainHapticButtonStyle())
                .padding(.bottom, 10)

                Button(action: onCancel) {
                    Text("やめる")
                        .font(.readable(.callout))
                        .foregroundStyle(Palette.mist)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                }
                .buttonStyle(PlainHapticButtonStyle())
            }
            .padding(.horizontal, 22)
            .padding(.top, 20)
            .padding(.bottom, 14)
            .frame(maxWidth: 340)
            .background(
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(Palette.paper)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .stroke(Palette.ink.opacity(0.55), lineWidth: 1)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .stroke(Palette.line, lineWidth: 1)
                    .padding(4)
            )
            .shadow(color: .black.opacity(0.16), radius: 20, y: 10)
            .padding(.horizontal, 28)
        }
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isModal)
    }
}
