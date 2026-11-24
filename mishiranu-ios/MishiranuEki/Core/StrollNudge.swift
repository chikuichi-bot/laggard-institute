import Foundation
import UserNotifications

/// 休眠防止のごく弱い想起（シミュレーション「思い出してくれない」への応答）。
/// プッシュ営業ではなく、7日開けたら1通だけ。開いたら組み直す。
enum StrollNudge {
    private static let requestId = "mishiranu.stroll.nudge.v1"
    private static let lastOpenKey = "mishiranu.strollNudge.lastOpen"
    private static let askedKey = "mishiranu.strollNudge.askedAuth"

    /// アプリを開いたときに呼ぶ。
    @MainActor
    static func noteAppBecameActive() {
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: lastOpenKey)
        Task { await rescheduleIfAllowed() }
    }

    /// 初回だけ許可を静かに聞く（拒否でも機能は壊れない）。
    @MainActor
    static func askPermissionOnceIfNeeded() {
        guard !UserDefaults.standard.bool(forKey: askedKey) else { return }
        UserDefaults.standard.set(true, forKey: askedKey)
        Task {
            let center = UNUserNotificationCenter.current()
            let settings = await center.notificationSettings()
            guard settings.authorizationStatus == .notDetermined else {
                await rescheduleIfAllowed()
                return
            }
            _ = try? await center.requestAuthorization(options: [.alert, .sound])
            await rescheduleIfAllowed()
        }
    }

    private static func rescheduleIfAllowed() async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        guard settings.authorizationStatus == .authorized
            || settings.authorizationStatus == .provisional
        else {
            center.removePendingNotificationRequests(withIdentifiers: [requestId])
            return
        }

        center.removePendingNotificationRequests(withIdentifiers: [requestId])

        let content = UNMutableNotificationContent()
        content.title = "見知らぬ駅"
        content.body = "しばらく開けていません。次の電車までの、ひと寄りでも。"
        content.sound = .default

        // 7日後。開くたびに延びるので、使っている人には届かない。
        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: 7 * 24 * 60 * 60,
            repeats: false
        )
        let req = UNNotificationRequest(identifier: requestId, content: content, trigger: trigger)
        try? await center.add(req)
    }
}
