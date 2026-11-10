import SwiftUI

@main
struct MishiranuEkiApp: App {
    @State private var model = AppModel(stations: StationStore.loadBundled())

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .tint(Palette.warm)
                .preferredColorScheme(.light)
        }
    }
}

struct RootView: View {
    @Environment(AppModel.self) private var model

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
        .animation(.easeInOut(duration: 0.25), value: model.screen)
    }
}
