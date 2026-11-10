import SwiftUI

@main
struct MishiranuEkiApp: App {
    @State private var model = AppModel(stations: StationStore.loadCatalog())

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .environment(ThemeStore.shared)
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
                ArrivalChatView().transition(.move(edge: .trailing).combined(with: .opacity))
            case .tour:
                TourView().transition(.opacity)
            }
        }
        .tint(Palette.warm)
        .preferredColorScheme(theme.skin.preferredColorScheme)
        .id(theme.skin)
        .animation(.easeInOut(duration: 0.25), value: model.screen)
    }
}
