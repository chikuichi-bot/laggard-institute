import Foundation

/// 駅の歴史文から、降りた瞬間・歩く途中に渡す「一片」を拾う。
/// 図鑑として全部見せず、名前が出てくる一文だけを差し出す。
enum StationLore {
    /// 到着時に会話で渡す一片。毎回同じにならないよう、駅と日付で選ぶ。
    static func arrivalFragment(for station: Station, on date: Date = Date()) -> (title: String, line: String)? {
        let notes = station.historyNotes.filter { !$0.body.isEmpty }
        guard !notes.isEmpty else {
            guard let line = sentences(station.areaAbout).first else { return nil }
            return ("この土地のこと", line)
        }
        let day = Calendar.current.ordinality(of: .day, in: .era, for: date) ?? 0
        // hashValue は起動ごとに変わるので、文字コードの和で安定させる
        let seed = station.id.unicodeScalars.reduce(0) { $0 + Int($1.value) } + day
        let note = notes[seed % notes.count]
        guard let line = sentences(note.body).first else { return nil }
        return (note.title, line)
    }

    /// その場所の名前が出てくる、土地の記憶の一文。なければ nil（無理に埋めない）。
    static func trace(for spot: Spot, in station: Station) -> String? {
        let keys = nameKeys(spot.name)
        guard !keys.isEmpty else { return nil }
        let pool: [String] =
            station.historyNotes.flatMap { sentences($0.body) }
            + sentences(station.areaAbout)
            + sentences(station.stationIntro)
            + station.sightseeingNotes.flatMap { sentences($0.body) }
        let blurb = spot.blurb
        for key in keys {
            if let hit = pool.first(where: { $0.contains(key) && !blurb.contains($0) }) {
                return hit
            }
        }
        return nil
    }

    /// 「下鴨神社（賀茂御祖神社）」→ ["下鴨神社（賀茂御祖神社）", "下鴨神社", "賀茂御祖神社"]
    static func nameKeys(_ name: String) -> [String] {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        var keys: [String] = [trimmed]
        let parts = trimmed
            .components(separatedBy: CharacterSet(charactersIn: "（）()「」 　・/"))
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { $0.count >= 3 }
        keys.append(contentsOf: parts)
        for suffix in ["本店", "駅前店", "店"] where trimmed.hasSuffix(suffix) {
            let core = String(trimmed.dropLast(suffix.count))
            if core.count >= 3 { keys.append(core) }
        }
        var seen = Set<String>()
        return keys.filter { seen.insert($0).inserted }
    }

    static func sentences(_ text: String?) -> [String] {
        guard let text, !text.isEmpty else { return [] }
        var out: [String] = []
        var current = ""
        for ch in text {
            if ch == "\n" { continue }
            current.append(ch)
            if "。！？".contains(ch) {
                let s = current.trimmingCharacters(in: .whitespacesAndNewlines)
                if s.count >= 8 { out.append(s) }
                current = ""
            }
        }
        let rest = current.trimmingCharacters(in: .whitespacesAndNewlines)
        if rest.count >= 8 { out.append(rest) }
        return out
    }
}
