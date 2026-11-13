import Foundation

/// 場所の短い説明。Apple の定型文や空欄を、名前から分かる一文に差し替える。
enum SpotCopy {
    /// 「この駅からの観光の目印。」など、中身のない定型か。
    static func isGeneric(_ text: String) -> Bool {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty { return true }
        let hollow = [
            "この駅からの観光の目印",
            "駅からの徒歩圏で立ち寄れる食事どころ",
            "手土産や買い物の候補",
            "歩いたあとに腰を下ろせる場所",
            "予定にない寄り道向き",
        ]
        // 住所が付いて長くなっても、定型なら作り直す
        return hollow.contains { t.contains($0) }
    }

    /// 表示用の短い説明（観光・ご飯など）。物語は含めない → `storyNotes(for:in:)`。
    static func blurb(for spot: Spot, in station: Station? = nil) -> String {
        let displayName = LandscapeSpotName.clarified(spot.name)
        let split = splitStorySupplement(spot.blurb)
        let primaryRaw = split.primary.trimmingCharacters(in: .whitespacesAndNewlines)
        let guide = spot.guide == .story ? GuideKind.sight : spot.guide
        let base: String = {
            if looksLikeStoryLead(primaryRaw, name: displayName)
                || primaryRaw.isEmpty
                || isGeneric(primaryRaw)
                || LandscapeSpotName.shouldRewriteBlurb(primaryRaw, name: spot.name)
            {
                if LandscapeSpotName.shouldRewriteBlurb(primaryRaw, name: spot.name),
                   !looksLikeStoryLead(primaryRaw, name: displayName),
                   !primaryRaw.isEmpty,
                   !isGeneric(primaryRaw)
                {
                    return LandscapeSpotName.walkBlurb(for: spot.name, walkMinutes: spot.walkMinutes)
                }
                return compose(name: displayName, guide: guide, address: nonStoryDetail(spot.detail))
            }
            return primaryRaw
        }()

        // 土地の記憶は LoreTrace、物語は storyNotes(for:in:) で別ブロック
        return base
    }

    /// シート用: この場所に紐づく物語のゆかり（タイトル＋本文）。
    static func storyNotes(for spot: Spot, in station: Station?) -> [HistoryNote] {
        let place = LandscapeSpotName.clarified(spot.name)
        var notes: [HistoryNote] = []
        if let station {
            for note in station.storyNotes {
                if let named = StoryMapSpots.placeName(fromStoryTitle: note.title),
                   StoryMapSpots.samePlace(name: place, named)
                    || StoryMapSpots.samePlace(name: spot.name, named)
                {
                    notes.append(note)
                    continue
                }
                let afterTo: String = {
                    guard let last = note.title.split(separator: "と", maxSplits: 1).last else {
                        return ""
                    }
                    return String(last).trimmingCharacters(in: .whitespacesAndNewlines)
                }()
                if note.title.contains(place)
                    || note.body.contains(place)
                    || (!afterTo.isEmpty && (place.contains(afterTo) || afterTo.contains(place)))
                {
                    notes.append(note)
                }
            }
        }
        if !notes.isEmpty { return dedupeNotes(notes) }

        // 保存文に〔物語〕だけ残っている場合の救済
        for line in storySupplementLines(for: spot) {
            let raw = line
                .replacingOccurrences(of: "〔物語〕", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            guard !raw.isEmpty else { continue }
            if let sep = raw.range(of: " — ") ?? raw.range(of: "—") {
                let title = String(raw[..<sep.lowerBound])
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                let body = String(raw[sep.upperBound...])
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                notes.append(HistoryNote(title: title.isEmpty ? "物語のゆかり" : title, body: body))
            } else {
                notes.append(HistoryNote(title: "物語のゆかり", body: raw))
            }
        }
        return dedupeNotes(notes)
    }

    private static func dedupeNotes(_ notes: [HistoryNote]) -> [HistoryNote] {
        var out: [HistoryNote] = []
        for note in notes {
            if out.contains(where: {
                $0.title == note.title || $0.body == note.body
                    || ($0.body.contains(note.body) || note.body.contains($0.body))
            }) { continue }
            out.append(note)
        }
        return out
    }

    /// 〔物語〕マーカー行だけ。
    static func storySupplementLines(for spot: Spot) -> [String] {
        let fromBlurb = splitStorySupplement(spot.blurb).supplements
        let fromDetail = splitStorySupplement(spot.detail ?? "").supplements
        return uniqueStoryParts(fromBlurb + fromDetail)
    }

    /// detail が物語補足だけのときはシートで出さない（blurb 末尾に寄せる）。
    static func nonStoryDetail(_ detail: String?) -> String? {
        guard let detail else { return nil }
        let split = splitStorySupplement(detail)
        let t = split.primary.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty { return nil }
        if looksLikeStoryLead(t, name: "") { return nil }
        if t.hasPrefix("物語のゆかり") { return nil }
        return t
    }

    private static func splitStorySupplement(_ text: String) -> (primary: String, supplements: [String]) {
        let marker = "〔物語〕"
        guard text.contains(marker) else {
            return (text, [])
        }
        var primary = ""
        var supplements: [String] = []
        var rest = text
        while let range = rest.range(of: marker) {
            let before = String(rest[..<range.lowerBound])
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if primary.isEmpty { primary = before }
            else if !before.isEmpty { primary = "\(primary) \(before)" }
            rest = String(rest[range.lowerBound...])
            // 次の〔物語〕まで、または末尾
            if let next = rest.range(of: marker, range: rest.index(after: rest.startIndex)..<rest.endIndex) {
                let chunk = String(rest[..<next.lowerBound])
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                if !chunk.isEmpty { supplements.append(chunk) }
                rest = String(rest[next.lowerBound...])
            } else {
                let chunk = rest.trimmingCharacters(in: .whitespacesAndNewlines)
                if !chunk.isEmpty { supplements.append(chunk) }
                rest = ""
                break
            }
        }
        return (primary, supplements)
    }

    private static func uniqueStoryParts(_ parts: [String]) -> [String] {
        var out: [String] = []
        for p in parts {
            var t = p.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !t.isEmpty else { continue }
            if !t.hasPrefix("〔物語〕") { t = "〔物語〕\(t)" }
            if out.contains(where: {
                $0 == t || $0.contains(t.replacingOccurrences(of: "〔物語〕", with: ""))
                    || t.contains($0.replacingOccurrences(of: "〔物語〕", with: ""))
            }) {
                continue
            }
            out.append(t)
        }
        return out
    }

    /// 物語本文がメイン枠に入ってしまっているか。
    private static func looksLikeStoryLead(_ text: String, name: String) -> Bool {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty { return false }
        if t.hasPrefix("〔物語〕") || t.hasPrefix("物語のゆかり") { return true }
        let cues = ["映画『", "ドラマ『", "乱闘シーン", "ロケ", "撮影地", "画面の", "小説を映画"]
        if cues.contains(where: { t.contains($0) }) { return true }
        if let named = namedBlurb(name), !name.isEmpty {
            let head = String(named.prefix(12))
            if !t.contains(head), t.count > 40, cues.contains(where: { t.contains($0) }) {
                return true
            }
        }
        return false
    }

    /// 地図・シートに出す名前（川の総称だけを避ける）。
    static func displayName(for spot: Spot) -> String {
        LandscapeSpotName.clarified(spot.name)
    }

    static func compose(name: String, guide: GuideKind, address: String?) -> String {
        let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let whereText = shortWhere(address)
        if let special = namedBlurb(n) {
            return whereText.map { "\(special)（\($0)）" } ?? special
        }
        switch guide {
        case .sight:
            if n.contains("神社") || n.contains("神宮") || n.hasSuffix("大社") {
                return "\(n)\(paren(whereText))。参拝の社。境内と参道が、この土地の顔になる。"
            }
            if n.hasSuffix("寺") || n.contains("寺院") {
                return "\(n)\(paren(whereText))。静かな境内。歩いて寄れる祈りの場。"
            }
            if n.contains("城") {
                return "\(n)\(paren(whereText))。城の跡と町の層が、短く見える場所。"
            }
            if n.contains("デルタ") || n.contains("三角州") {
                return "\(n)\(paren(whereText))。歩いて川辺へ出ると、合流の景色が開ける。"
            }
            if n.contains("川") || n.contains("河") || n.contains("堤防") {
                return "\(n)\(paren(whereText))。駅から歩いて寄る川辺。ホームから見渡す景色ではない。"
            }
            if n.contains("資料館") || n.contains("博物館") || n.contains("美術館") {
                return "\(n)\(paren(whereText))。土地の物語を、短く辿れる展示。"
            }
            if n.contains("公園") || n.contains("庭園") {
                return "\(n)\(paren(whereText))。足を止めて景色を拾う場所。"
            }
            return "\(n)\(paren(whereText))。駅からの徒歩圏で立ち寄れる名所。"
        case .meal:
            if n.contains("うどん") || n.contains("そば") || n.contains("蕎麦") {
                return "\(n)\(paren(whereText))。気軽に入れる、土地の麺どころ。"
            }
            if n.contains("パン") || n.contains("進々堂") {
                return "\(n)\(paren(whereText))。焼きたてを手に取れるパン屋。"
            }
            if n.contains("おにぎり") {
                return "\(n)\(paren(whereText))。駅近で握りを受け取れる定番。"
            }
            return "\(n)\(paren(whereText))。徒歩圏で立ち寄れる食事どころ。"
        case .souvenir:
            if n.contains("餅") || n.contains("菓子") || n.contains("ふたば") || n.contains("走井") {
                return "\(n)\(paren(whereText))。門前・手土産の名物。軽い包みで帰りやすい。"
            }
            return "\(n)\(paren(whereText))。手土産や買い物の候補。"
        case .rest:
            if n.contains("喫茶") || n.contains("カフェ") || n.contains("茶房") || n.contains("珈琲") || n.contains("コーヒー") {
                return "\(n)\(paren(whereText))。歩いたあとに腰を下ろせる喫茶。"
            }
            return "\(n)\(paren(whereText))。歩いたあとに腰を下ろせる場所。"
        case .tip:
            return "\(n)\(paren(whereText))。予定にない寄り道向き。"
        case .story:
            return "\(n)\(paren(whereText))。映画・ドラマ・文学のゆかり。画面で見た場所を、足で確かめる。"
        }
    }

    /// よく出る固有名だけ、一文を固定（地図の定型より優先）。
    private static func namedBlurb(_ name: String) -> String? {
        // タイムズ等に「下鴨神社」が付いても、社の文案を付けない
        if PlaceNoise.isNoise(name) { return nil }
        if name.contains("鴨川デルタ") || (name.contains("鴨川") && name.contains("デルタ")) {
            return "鴨川と高野川の合流。飛び石が並び、多くの人が川辺で憩う町の顔。"
        }
        if name.contains("下鴨神社") || name.contains("賀茂御祖") {
            return "世界遺産の社。糺の森を抜けて本殿へ。出町柳からの散歩の行き先。"
        }
        if name.contains("下鴨城") || name.contains("瀬見の小川") {
            return "城跡と復元された瀬見の小川。下鴨の古い水の筋が薄く見える。"
        }
        if name.contains("出町ふたば") || (name.contains("ふたば") && !name.contains("カフェ")) {
            return "出町の顔といえば豆餅。並んでも買う人が絶えない甘味で、手土産にもなる。"
        }
        if name.contains("石清水八幡宮") && !name.hasSuffix("駅") {
            return "男山の神域。朝廷と武家の信仰が重なる八幡の本社で、山ごとが案内になる。"
        }
        if name.contains("飛行神社") {
            return "航空の夢をまつる小さな社。古い八幡の隣に、近代の物語が静かに座る。"
        }
        if name.contains("走井餅") {
            return "門前名物の走井餅。お茶うけやうどんも店内で、駅からの手土産にもなる。"
        }
        if name.contains("進々堂") {
            return "京大北門前の老舗パン。焼きたてを持って、散策の途中で食べ歩きもできる。"
        }
        return nil
    }

    private static func shortWhere(_ address: String?) -> String? {
        guard let address else { return nil }
        let t = address.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return nil }
        // 住所丸ごとだと長いので、市区以降の短さだけ
        if t.count <= 18 { return t }
        return String(t.prefix(18))
    }

    private static func paren(_ whereText: String?) -> String {
        whereText.map { "（\($0)）" } ?? ""
    }
}
