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

            if model.stationLoading {
                StationGuideLoadingPopup(
                    stationName: model.query.trimmingCharacters(in: .whitespacesAndNewlines),
                    onCancel: { model.cancelStationLookup() }
                )
                .transition(.opacity)
                .zIndex(40)
            }
        }
        .tint(Palette.warm)
        .preferredColorScheme(theme.skin.preferredColorScheme)
        // skin 切替で .id を付けない（設定のスクロール位置が先頭へ戻るため）
        .animation(.easeInOut(duration: 0.2), value: theme.skin)
        .animation(.easeInOut(duration: 0.25), value: model.screen)
        .animation(.easeInOut(duration: 0.2), value: model.stationLoading)
        .buttonStyle(PlainHapticButtonStyle())
        .onAppear { Haptics.prepare() }
    }
}

/// 案内生成中のモーダル。トップ／設定のどちらからでも同じ見た目。
struct StationGuideLoadingPopup: View {
    var stationName: String = ""
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

                Text("案内を作っています。")
                    .font(.mincho(.title3, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                    .multilineTextAlignment(.center)

                if !bareName.isEmpty {
                    Text("「\(bareName)」の徒歩圏")
                        .font(.readable(.callout))
                        .foregroundStyle(Palette.fog)
                        .multilineTextAlignment(.center)
                }

                Text("少し時間がかかることがあります")
                    .font(.readable(.caption))
                    .foregroundStyle(Palette.mist)

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
