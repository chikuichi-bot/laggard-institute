import Foundation

/// 画面表示用の漢字文を、AVSpeech が言い間違えにくい読み上げ文に直す。
/// 表示テキストは変えず、発話直前だけ通す。
enum SpeechSpeakable {
    /// - Parameters:
    ///   - text: 読み上げたい原文
    ///   - stationName: 駅名（「駅」あり／なしどちらでも可）
    ///   - stationReading: ひらがな読み（あれば最優先で駅名を置換）
    ///   - extraNames: 本文に出る固有名（スポット名など）。読みが無いので、区切りやすくするだけ。
    static func prepare(
        _ text: String,
        stationName: String,
        stationReading: String?,
        extraNames: [String] = []
    ) -> String {
        var s = text
        s = normalizePunctuation(s)
        s = replaceStationName(in: s, stationName: stationName, reading: stationReading)
        s = applyLexicon(s)
        s = softenProperNames(in: s, names: extraNames)
        s = expandWalkMinutes(s)
        s = expandOrdinals(s)
        s = collapseSpaces(s)
        return s.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func prepare(_ text: String, station: Station) -> String {
        let bare = station.indexStationLabel
        let reading = station.displayNameReading
        let spots = station.spots.map(\.name)
        let notes =
            station.sightseeingNotes.map(\.title)
            + station.historyNotes.map(\.title)
            + station.storyNotes.map(\.title)
        let extras = Array(Set(spots + notes)).filter { !$0.isEmpty }
        return prepare(
            text,
            stationName: bare,
            stationReading: reading,
            extraNames: extras
        )
    }

    // MARK: - steps

    private static func normalizePunctuation(_ text: String) -> String {
        var s = text
        let pairs: [(String, String)] = [
            ("·", "、"),
            ("・", "、"),
            ("／", "、"),
            ("/", "、"),
            ("｜", "、"),
            ("|", "、"),
            ("〜", "から"),
            ("～", "から"),
            ("…", "。"),
            ("...", "。"),
            ("※", "なお、"),
            ("→", "、つぎに、"),
            ("←", "、"),
            ("×", "、"),
            ("&", "と"),
            ("　", "、"),
        ]
        for (from, to) in pairs {
            s = s.replacingOccurrences(of: from, with: to)
        }
        // 読み上げにノイズになる記号は落とす
        let strip = CharacterSet(charactersIn: "【】[]（）()「」『』<>《》#*_`")
        s = s.components(separatedBy: strip).joined(separator: "、")
        return s
    }

    private static func replaceStationName(
        in text: String,
        stationName: String,
        reading: String?
    ) -> String {
        let bare = stationName.replacingOccurrences(of: "駅", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !bare.isEmpty else { return text }
        let kana = (reading ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !kana.isEmpty else {
            // 読みが無いときも「駅」を明示して誤読を減らす
            return text
                .replacingOccurrences(of: "\(bare)駅", with: "\(bare)、駅")
                .replacingOccurrences(of: bare, with: "\(bare)、")
        }
        var s = text
        // 長い形から
        s = s.replacingOccurrences(of: "\(bare)駅", with: "\(kana)えき")
        s = s.replacingOccurrences(of: bare, with: kana)
        return s
    }

    /// 難読・誤読されやすい語の固定読み（長い語から）。
    private static let lexicon: [(String, String)] = {
        let pairs: [(String, String)] = [
            // 駅・町
            ("出町柳", "でまちやなぎ"),
            ("淀屋橋", "よどやばし"),
            ("中書島", "ちゅうしょじま"),
            ("石清水八幡宮", "いわしみずはちまんぐう"),
            ("大山崎", "おおやまざき"),
            ("藤森", "ふじのもり"),
            ("墨染", "すみぞめ"),
            ("二ノ瀬", "にのせ"),
            ("貴船口", "きぶねぐち"),
            ("八瀬比叡山口", "やせひえいざんぐち"),
            ("宇治", "うじ"),
            // 土地の顔
            ("鴨川デルタ", "かもがわでるた"),
            ("賀茂御祖神社", "かもみおやじんじゃ"),
            ("下鴨神社", "しもがもじんじゃ"),
            ("枡形商店街", "ますがたしょうてんがい"),
            ("桝形商店街", "ますがたしょうてんがい"),
            ("鯖街道", "さばかいどう"),
            ("若狭街道", "わかさかいどう"),
            ("京都大学", "きょうとだいがく"),
            ("同志社大学", "どうししゃだいがく"),
            ("龍谷大学", "りゅうこくだいがく"),
            ("琵琶湖疏水", "びわこそすい"),
            ("疏水", "そすい"),
            ("糺の森", "ただすのもり"),
            ("賀茂川", "かもがわ"),
            ("高野川", "たかのがわ"),
            ("鴨川", "かもがわ"),
            ("濠川", "ほりかわ"),
            ("寺田屋", "てらだや"),
            ("月桂冠", "げっけいかん"),
            ("飛行神社", "ひこうじんじゃ"),
            ("藤森神社", "ふじのもりじんじゃ"),
            ("直違橋", "すじかいばし"),
            ("墨染寺", "すみぞめでら"),
            ("離宮八幡宮", "りきゅうはちまんぐう"),
            ("平等院", "びょうどういん"),
            ("宇治橋", "うじばし"),
            ("通圓", "つうえん"),
            ("貴船神社", "きぶねじんじゃ"),
            ("天王山", "てんのうざん"),
            ("山崎蒸溜所", "やまざきじょうりゅうじょ"),
            ("御香宮", "ごこうのみや"),
            // 案内語
            ("小回り", "こまわり"),
            ("大回り", "おおまわり"),
            ("徒歩", "とほ"),
            ("改札", "かいさつ"),
            ("目の置きどころ", "めのおきどころ"),
            ("立ち寄り", "たちより"),
            ("寄り道", "よりみち"),
            ("土地案内", "とちあんない"),
            ("見知らぬ駅", "みしらぬえき"),
        ]
        return pairs.sorted { $0.0.count > $1.0.count }
    }()

    private static func applyLexicon(_ text: String) -> String {
        var s = text
        for (kanji, kana) in lexicon {
            s = s.replacingOccurrences(of: kanji, with: kana)
        }
        return s
    }

    /// 読みの無い固有名は、前後に読点を入れて区切り誤読を減らす。
    private static func softenProperNames(in text: String, names: [String]) -> String {
        let sorted = names
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { $0.count >= 2 }
            .sorted { $0.count > $1.count }
        var s = text
        for name in sorted {
            // すでにひらがな化済み／短い語は触らない
            if name.unicodeScalars.allSatisfy({ CharacterSet.letters.contains($0) && $0.isASCII }) {
                continue
            }
            if s.contains(name) {
                s = s.replacingOccurrences(of: name, with: "、\(name)、")
            }
        }
        return s
    }

    private static func expandWalkMinutes(_ text: String) -> String {
        // 「約12分」「徒歩 約 5 分」「12分」
        let pattern = #"約?\s*(\d{1,2})\s*分"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return text }
        let ns = text as NSString
        let matches = regex.matches(in: text, range: NSRange(location: 0, length: ns.length))
        var result = text
        for match in matches.reversed() {
            guard match.numberOfRanges >= 2,
                  let full = Range(match.range, in: result),
                  let numRange = Range(match.range(at: 1), in: result),
                  let n = Int(result[numRange])
            else { continue }
            let spoken = "やく\(japaneseNumber(n))ふん"
            result.replaceSubrange(full, with: spoken)
        }
        return result
    }

    private static func expandOrdinals(_ text: String) -> String {
        var s = text
        let ordinals: [(String, String)] = [
            ("1番", "いちばん"), ("２番", "にばん"), ("2番", "にばん"),
            ("3番", "さんばん"), ("４番", "よんばん"), ("4番", "よんばん"),
            ("01", "ゼロいち"), ("02", "ゼロに"), ("03", "ゼロさん"), ("04", "ゼロよん"),
        ]
        for (from, to) in ordinals {
            s = s.replacingOccurrences(of: from, with: to)
        }
        return s
    }

    private static func collapseSpaces(_ text: String) -> String {
        var s = text
        while s.contains("、、") { s = s.replacingOccurrences(of: "、、", with: "、") }
        while s.contains("。。") { s = s.replacingOccurrences(of: "。。", with: "。") }
        return s
            .replacingOccurrences(of: " ,", with: "、")
            .replacingOccurrences(of: "  ", with: " ")
    }

    private static func japaneseNumber(_ n: Int) -> String {
        let digits = ["ゼロ", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"]
        if n < 10 { return digits[n] }
        if n == 10 { return "じゅう" }
        if n < 20 { return "じゅう" + digits[n - 10] }
        if n < 60 {
            let tens = n / 10
            let ones = n % 10
            let tenWord: String = {
                switch tens {
                case 2: return "にじゅう"
                case 3: return "さんじゅう"
                case 4: return "よんじゅう"
                case 5: return "ごじゅう"
                default: return "\(digits[tens])じゅう"
                }
            }()
            return ones == 0 ? tenWord : tenWord + digits[ones]
        }
        return "\(n)"
    }
}
