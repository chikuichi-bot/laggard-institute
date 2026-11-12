import SwiftUI

/// 駅名検索用。候補を一覧し、選んでから案内をつくるか聞く（「ここは」とは言わない）。
struct GuideCandidatePopup: View {
    var queryLabel: String
    var candidates: [StationNameCandidate]
    var isLoading: Bool = false
    var onConfirm: (StationNameCandidate) -> Void
    var onCancel: () -> Void

    @State private var selectedId: String?

    private var selected: StationNameCandidate? {
        candidates.first { $0.id == selectedId } ?? candidates.first
    }

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
                    Text("見知らぬ駅 · 候補")
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

                Text("「\(queryLabel)」の候補")
                    .font(.mincho(.title3, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.bottom, 8)

                Text("駅を選んでから、案内をつくります。")
                    .font(.mincho(.callout))
                    .foregroundStyle(Palette.fog)
                    .padding(.bottom, 14)

                if isLoading {
                    HStack {
                        Spacer(minLength: 0)
                        ProgressView()
                            .tint(Palette.warm)
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 24)
                } else {
                    ScrollView {
                        VStack(spacing: 0) {
                            ForEach(candidates) { cand in
                                Button {
                                    selectedId = cand.id
                                } label: {
                                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                                        PictogramIcon(.train, size: 15)
                                            .foregroundStyle(
                                                selectedId == cand.id || (selectedId == nil && cand.id == candidates.first?.id)
                                                    ? Palette.warm
                                                    : Palette.ink.opacity(0.55)
                                            )
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(cand.name)
                                                .font(.mincho(.body, weight: .semibold))
                                                .foregroundStyle(Palette.ink)
                                            Text(cand.detail)
                                                .font(.readable(.caption))
                                                .foregroundStyle(Palette.mist)
                                                .lineLimit(2)
                                        }
                                        Spacer(minLength: 0)
                                    }
                                    .padding(.vertical, 11)
                                    .padding(.horizontal, 8)
                                    .background(
                                        RoundedRectangle(cornerRadius: 4, style: .continuous)
                                            .fill(
                                                (selectedId == cand.id || (selectedId == nil && cand.id == candidates.first?.id))
                                                    ? Palette.ink.opacity(0.06)
                                                    : Color.clear
                                            )
                                    )
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(PlainHapticButtonStyle())
                                Divider().overlay(Palette.line)
                            }
                        }
                    }
                    .frame(maxHeight: 220)
                }

                if let selected, !isLoading {
                    Text("「\(selected.bareName)」で徒歩圏の案内をつくりますか？")
                        .font(.mincho(.callout))
                        .foregroundStyle(Palette.fog)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 14)
                        .padding(.bottom, 16)

                    Button {
                        onConfirm(selected)
                    } label: {
                        Text("調べる")
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
                }

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
        .onAppear {
            if selectedId == nil {
                selectedId = candidates.first?.id
            }
        }
        .onChange(of: candidates.map(\.id)) { _, ids in
            if let selectedId, ids.contains(selectedId) { return }
            self.selectedId = ids.first
        }
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isModal)
    }
}
