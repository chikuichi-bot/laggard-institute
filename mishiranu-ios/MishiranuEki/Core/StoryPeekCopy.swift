import Foundation

/// 無料 peek の結び。百科で完結させず、改札を出る身体的な予感で止める。
enum StoryPeekCopy {
    static let walkInvite =
        "改札の外に、その名残を感じながら歩ける道が続いています。"

    static let emptyBody =
        "確かな物語のゆかりは見つかりませんでした。それでも改札の外には、名前のない空気の道が続いていることがあります。"

    static func bodyHasWalkInvite(_ body: String) -> Bool {
        let t = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return false }
        if t.contains("改札") { return true }
        if t.contains("歩ける道") { return true }
        if t.contains("足でたど") { return true }
        if t.contains("空気の道が続") { return true }
        if t.contains("いま歩ける空気") { return true }
        return false
    }

    /// 最後の note の結びが百科完結なら、歩き出しの一文を足す。
    static func ensureWalkInvite(_ notes: [HistoryNote]) -> [HistoryNote] {
        guard let last = notes.last else { return notes }
        if bodyHasWalkInvite(last.body) { return notes }
        var base = last.body.trimmingCharacters(in: .whitespacesAndNewlines)
        while base.hasSuffix("。") || base.hasSuffix(".") || base.hasSuffix("．") {
            base = String(base.dropLast())
        }
        let updated = HistoryNote(title: last.title, body: "\(base)。\(walkInvite)")
        return Array(notes.dropLast()) + [updated]
    }

    /// フッターに誘いを出すか（本文末尾に既にあれば出さない）。
    static func shouldShowWalkInviteFooter(_ notes: [HistoryNote]) -> Bool {
        guard let last = notes.last else { return false }
        return !bodyHasWalkInvite(last.body)
    }
}
