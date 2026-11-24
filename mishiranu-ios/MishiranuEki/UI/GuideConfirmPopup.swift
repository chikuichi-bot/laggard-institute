import SwiftUI

/// システムの確認シートではなく、紙の案内票のような確認。
struct GuideConfirmPopup: View {
    var eyebrow: String = "見知らぬ駅 · 案内"
    var title: String
    var message: String
    var confirmLabel: String = "調べる"
    var cancelLabel: String = "やめる"
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
                    Text(eyebrow)
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

                Text(title)
                    .font(.mincho(.title3, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.bottom, 10)

                Text(message)
                    .font(.mincho(.callout))
                    .foregroundStyle(Palette.fog)
                    .lineSpacing(5)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.bottom, 22)

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
                    Text(cancelLabel)
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
            .frame(maxWidth: 320)
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
