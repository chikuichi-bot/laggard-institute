#if DEBUG
import Foundation

/// Debug ビルドだけ: `-mishiranuDemo <chat|map|place|walk|guide|more>` で画面を直接開く。
extension AppModel {
    func applyLaunchDemo(arguments: [String] = ProcessInfo.processInfo.arguments) {
        guard
            let flag = arguments.firstIndex(of: "-mishiranuDemo"),
            arguments.indices.contains(flag + 1),
            let station = stations.first
        else { return }
        let target = arguments[flag + 1]

        goHero()
        if target == "chat" {
            return
        }
        chooseStation(station)
        if let tab = TourTab(rawValue: target), tab != .place {
            openTour(tab: tab)
            if tab == .guide { guideKind = .meal }
        }
    }
}
#endif
