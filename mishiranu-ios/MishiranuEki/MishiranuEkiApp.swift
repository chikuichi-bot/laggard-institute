import SwiftUI

@main
struct MishiranuEkiApp: App {
    @State private var model = AppModel(stations: StationStore.loadCatalog())

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .environment(ThemeStore.shared)
                .environment(BillingStore.shared)
                #if DEBUG
                .onAppear { model.applyLaunchDemo() }
                #endif
        }
    }
}

struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(ThemeStore.self) private var theme
    @Environment(BillingStore.self) private var billing

    private var detailConfirmTitle: String {
        let bare = model.pendingDetailBare
        let label = bare.isEmpty ? "この駅" : (bare.hasSuffix("駅") ? bare : "\(bare)駅")
        if model.contourIsDecisionUseful {
            return "「\(label)」の輪郭"
        }
        return "「\(label)」を調べますか？"
    }

    private var detailConfirmMessage: String {
        let ask: String = {
            if billing.usesByokForGeneration {
                return "詳しく調べますか？（自分の API・コイン不要）"
            }
            return "詳しく調べますか？コインを1枚使います（残り \(billing.coins) 枚）。"
        }()
        if model.contourIsDecisionUseful {
            let contour = model.contourSummary.trimmingCharacters(in: .whitespacesAndNewlines)
            if !contour.isEmpty {
                return contour + "\n\n" + ask
            }
        }
        return "地図だけでは降りる判断材料が足りません。詳しい歩き方と順番を調べます。\n\n" + ask
    }

    var body: some View {
        ZStack {
            Palette.canvas.ignoresSafeArea()
            switch model.screen {
            case .hero:
                HeroView().transition(.opacity)
            case .chat:
                // 到着チャットは廃止。万一残っていてもトップへ。
                HeroView().transition(.opacity)
                    .onAppear { model.goHero() }
            case .tour:
                TourView().transition(.opacity)
            }

            if model.contourLoading {
                StationGuideLoadingPopup(
                    stationName: model.query.trimmingCharacters(in: .whitespacesAndNewlines),
                    title: "駅の輪郭をみています。",
                    hints: model.previewHints,
                    onCancel: { model.cancelStationLookup() }
                )
                .transition(.opacity)
                .zIndex(40)
            } else if model.stationLoading {
                StationGuideLoadingPopup(
                    stationName: model.query.trimmingCharacters(in: .whitespacesAndNewlines),
                    hints: model.previewHints,
                    onCancel: { model.cancelStationLookup() }
                )
                .transition(.opacity)
                .zIndex(40)
            } else if model.awaitingDetailConfirm {
                GuideConfirmPopup(
                    eyebrow: model.contourIsDecisionUseful
                        ? "見知らぬ駅 · 輪郭"
                        : "見知らぬ駅",
                    title: detailConfirmTitle,
                    message: detailConfirmMessage,
                    confirmLabel: "詳しく調べる",
                    cancelLabel: "やめる",
                    onConfirm: { model.confirmDetailGeneration() },
                    onCancel: { model.declineDetailGeneration() }
                )
                .transition(.opacity)
                .zIndex(45)
            }
        }
        .tint(Palette.warm)
        .preferredColorScheme(theme.skin.preferredColorScheme)
        // skin 切替で .id を付けない（設定のスクロール位置が先頭へ戻るため）
        .animation(.easeInOut(duration: 0.2), value: theme.skin)
        .animation(.easeInOut(duration: 0.25), value: model.screen)
        .animation(.easeInOut(duration: 0.2), value: model.stationLoading)
        .animation(.easeInOut(duration: 0.2), value: model.contourLoading)
        .animation(.easeInOut(duration: 0.2), value: model.awaitingDetailConfirm)
        .buttonStyle(PlainHapticButtonStyle())
        .onAppear { Haptics.prepare() }
        .onChange(of: model.screen) { _, screen in
            if screen != .tour {
                model.placeNarrator.stop()
            }
        }
        .onChange(of: model.stationId) { _, _ in
            model.placeNarrator.stop()
        }
    }
}

/// 案内生成中／輪郭取得中のモーダル。トップ／設定のどちらからでも同じ見た目。
struct StationGuideLoadingPopup: View {
    var stationName: String = ""
    var title: String = "案内を作っています。"
    var hints: [String] = []
    var onCancel: (() -> Void)?

    private var bareName: String {
        let t = stationName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return "" }
        return t.hasSuffix("駅") ? String(t.dropLast()) : t
    }

    var body: some View {
        ZStack {
            Color.black.opacity(0.38)
                .ignoresSafeArea()
                .accessibilityHidden(true)

            VStack(spacing: 18) {
                ProgressView()
                    .controlSize(.large)
                    .tint(Palette.warm)

                Text(title)
                    .font(.mincho(.title3, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                    .multilineTextAlignment(.center)

                if !bareName.isEmpty {
                    Text("「\(bareName)」の徒歩圏")
                        .font(.readable(.callout))
                        .foregroundStyle(Palette.fog)
                        .multilineTextAlignment(.center)
                }

                if !hints.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(Array(hints.prefix(4).enumerated()), id: \.offset) { _, hint in
                            Text(hint)
                                .font(.readable(.caption))
                                .foregroundStyle(Palette.fog)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .padding(.top, 2)
                } else {
                    Text("少し時間がかかることがあります")
                        .font(.readable(.caption))
                        .foregroundStyle(Palette.mist)
                }

                if let onCancel {
                    Button("やめる", action: onCancel)
                        .font(.readable(.callout, weight: .semibold))
                        .foregroundStyle(Palette.ink)
                        .padding(.top, 4)
                        .accessibilityLabel("案内づくりをやめる")
                }
            }
            .padding(.horizontal, 28)
            .padding(.vertical, 30)
            .frame(maxWidth: 300)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Palette.paper)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(Palette.line, lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.18), radius: 18, y: 8)
            .padding(.horizontal, 36)
        }
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.updatesFrequently)
    }
}
