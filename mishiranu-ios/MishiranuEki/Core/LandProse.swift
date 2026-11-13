import Foundation

/// 土地ページの仕訳（セクション間で同じ説明をかぶらせない）。
enum LandProse {
    /// 鴨川／賀茂川は同音で、生成文が合流後の名を逆転しやすい。
    /// 正: 上流＝賀茂川＋高野川 → 合流後の南＝鴨川。
    static func correctKamoRiverNaming(_ text: String) -> String {
        var out = text
        let pairs: [(String, String)] = [
            ("鴨川と高野川が合流し、賀茂川へと名を変え", "賀茂川と高野川が合流し、鴨川へと名を変え"),
            ("鴨川と高野川が合流し，賀茂川へと名を変え", "賀茂川と高野川が合流し，鴨川へと名を変え"),
            ("合流し、賀茂川へと名を変え", "合流し、鴨川へと名を変え"),
            ("合流し，賀茂川へと名を変え", "合流し，鴨川へと名を変え"),
            ("合流して賀茂川へと名を変え", "合流して鴨川へと名を変え"),
            ("名を変えて賀茂川", "名を変えて鴨川"),
            ("鴨川と高野川が合流し、鴨川へと名を変え", "賀茂川と高野川が合流し、鴨川へと名を変え"),
            ("鴨川と高野川が合流し，鴨川へと名を変え", "賀茂川と高野川が合流し，鴨川へと名を変え"),
        ]
        for (wrong, right) in pairs {
            out = out.replacingOccurrences(of: wrong, with: right)
        }
        return out
    }

    private static func fixRiverFields(_ station: Station) -> Station {
        Station(
            id: station.id,
            name: station.name,
            nameReading: station.nameReading,
            line: station.line,
            prefecture: station.prefecture,
            region: station.region,
            mood: station.mood,
            radiiKm: station.radiiKm,
            stationIntro: station.stationIntro.map(correctKamoRiverNaming),
            areaAbout: station.areaAbout.map(correctKamoRiverNaming),
            walkGuide: station.walkGuide.map(correctKamoRiverNaming),
            historyNotes: station.historyNotes.map {
                HistoryNote(title: correctKamoRiverNaming($0.title), body: correctKamoRiverNaming($0.body))
            },
            sightseeingNotes: station.sightseeingNotes.map {
                HistoryNote(title: correctKamoRiverNaming($0.title), body: correctKamoRiverNaming($0.body))
            },
            storyNotes: station.storyNotes.map {
                HistoryNote(title: correctKamoRiverNaming($0.title), body: correctKamoRiverNaming($0.body))
            },
            bikeRental: station.bikeRental,
            tourTitle: station.tourTitle,
            catchCopy: station.catchCopy,
            emptyCopy: station.emptyCopy,
            railHint: station.railHint,
            lat: station.lat,
            lng: station.lng,
            spots: station.spots,
            atmosphereCorridors: station.atmosphereCorridors
        )
    }

    /// 01 駅のこと / 02 歩き方 / 03 エリア+メモ / 04 観光メモ
    static func refine(_ station: Station) -> Station {
        // 正本の厚み（いまと歴史を結んだ文）を先に載せ、川名修正へ進む。
        let station = fixRiverFields(AreaDepth.overlay(on: station))
        var claimed: [String] = []

        let intro = takeUnique(sentences(station.stationIntro), claimed: &claimed)
        var walkLines = sentences(station.walkGuide).filter { line in
            if (line.contains("鯖街道") || line.contains("着き口") || line.contains("由来")),
               line.count > 48 {
                return false
            }
            return true
        }
        let walk = takeUnique(walkLines, claimed: &claimed)

        let aboutParas = (station.areaAbout ?? "")
            .components(separatedBy: "\n\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        var aboutOut: [String] = []
        let paras = aboutParas.isEmpty ? [station.areaAbout ?? ""] : aboutParas
        for para in paras {
            let kept = takeUnique(sentences(para), claimed: &claimed)
            if !kept.isEmpty { aboutOut.append(join(kept)) }
        }

        var notes: [HistoryNote] = []
        var titles = Set<String>()
        for note in station.historyNotes {
            let title = note.title.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !title.isEmpty, titles.insert(title).inserted else { continue }
            let kept = takeUnique(sentences(note.body), claimed: &claimed)
            guard !kept.isEmpty else { continue }
            notes.append(HistoryNote(title: title, body: join(kept)))
        }

        var sight: [HistoryNote] = []
        var sightTitles = Set<String>()
        for note in station.sightseeingNotes {
            let title = note.title.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !title.isEmpty, sightTitles.insert(title).inserted else { continue }
            let filtered = sentences(note.body).filter { line in
                if (line.contains("鯖街道") || line.contains("世界遺産") || line.contains("由来")),
                   line.count > 40 {
                    return false
                }
                return true
            }
            let kept = takeUnique(filtered, claimed: &claimed)
            guard !kept.isEmpty else { continue }
            sight.append(HistoryNote(title: title, body: join(kept)))
        }

        let refined = Station(
            id: station.id,
            name: station.name,
            nameReading: station.nameReading,
            line: station.line,
            prefecture: station.prefecture,
            region: station.region,
            mood: station.mood,
            radiiKm: station.radiiKm,
            stationIntro: intro.isEmpty ? station.stationIntro : join(intro),
            areaAbout: aboutOut.isEmpty ? station.areaAbout : aboutOut.joined(separator: "\n\n"),
            walkGuide: walk.isEmpty ? station.walkGuide : join(walk),
            historyNotes: notes.isEmpty ? station.historyNotes : notes,
            sightseeingNotes: sight.isEmpty ? station.sightseeingNotes : sight,
            storyNotes: station.storyNotes.map {
                HistoryNote(title: correctKamoRiverNaming($0.title), body: correctKamoRiverNaming($0.body))
            },
            bikeRental: station.bikeRental,
            tourTitle: station.tourTitle,
            catchCopy: station.catchCopy,
            emptyCopy: station.emptyCopy,
            railHint: station.railHint,
            lat: station.lat,
            lng: station.lng,
            spots: station.spots,
            atmosphereCorridors: station.atmosphereCorridors
        )
        // AreaDepth 誤適用や AI コピーで出町の固有名が残らないように最後にもう一度落とす
        return DemachiTemplate.scrubContamination(on: refined)
    }

    private static func sentences(_ text: String?) -> [String] {
        guard let text, !text.isEmpty else { return [] }
        var out: [String] = []
        var cur = ""
        for ch in text {
            if ch == "\n" {
                let s = cur.trimmingCharacters(in: .whitespacesAndNewlines)
                if s.count >= 8 { out.append(s) }
                cur = ""
                continue
            }
            cur.append(ch)
            if "。！？".contains(ch) {
                let s = cur.trimmingCharacters(in: .whitespacesAndNewlines)
                if s.count >= 8 { out.append(s) }
                cur = ""
            }
        }
        let rest = cur.trimmingCharacters(in: .whitespacesAndNewlines)
        if rest.count >= 8 { out.append(rest) }
        return out
    }

    private static func norm(_ s: String) -> String {
        s.replacingOccurrences(of: "\\s+", with: "", options: .regularExpression)
            .replacingOccurrences(of: "[。．、，・「」『』（）()]", with: "", options: .regularExpression)
    }

    private static func nearDuplicate(_ a: String, _ b: String) -> Bool {
        let na = norm(a)
        let nb = norm(b)
        guard na.count >= 10, nb.count >= 10 else { return false }
        if na == nb { return true }
        let shorter = na.count <= nb.count ? na : nb
        let longer = na.count <= nb.count ? nb : na
        if shorter.count >= 14, longer.contains(shorter) { return true }
        let n = min(22, shorter.count)
        return n >= 16 && longer.hasPrefix(String(shorter.prefix(n)))
    }

    private static func takeUnique(_ lines: [String], claimed: inout [String]) -> [String] {
        var keep: [String] = []
        for line in lines {
            if claimed.contains(where: { nearDuplicate($0, line) }) { continue }
            keep.append(line)
            claimed.append(line)
        }
        return keep
    }

    private static func join(_ lines: [String]) -> String {
        lines.map { line in
            if line.hasSuffix("。") || line.hasSuffix("！") || line.hasSuffix("？") { return line }
            return line + "。"
        }.joined()
    }
}
