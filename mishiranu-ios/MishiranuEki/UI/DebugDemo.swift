#if DEBUG
import Foundation

/// Debug ビルドだけ: `-mishiranuDemo <chat|course|map|place|walk|guide|more>` で画面を直接開く（スクリーンショット確認用）。
extension AppModel {
    func applyLaunchDemo(arguments: [String] = ProcessInfo.processInfo.arguments) {
        guard
            let flag = arguments.firstIndex(of: "-mishiranuDemo"),
            arguments.indices.contains(flag + 1),
            let station = stations.first
        else { return }
        let target = arguments[flag + 1]

        startArrival()
        chooseStation(station)
        chooseClock(.afternoon)
        if target == "chat" { return }
        chooseStay(.threeHours)
        chooseMealSolo(.solo)
        chooseMealBudget(.casual)
        if target == "course" { return }

        if let tab = TourTab(rawValue: target) {
            selectedCourse = courses.first
            openTour(tab: tab)
            if tab == .guide { guideKind = .meal }
        }
    }
}
#endif
