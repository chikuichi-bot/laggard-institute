import CoreLocation
import Foundation

/// 土地の顔アンカー（大学・商店街・旧街道の着き口など）。
/// 詳説は historyNotes に一度だけ。intro/walk/sightseeing へ同じ文を重ねない。
enum LandPresentAnchors {
    struct Anchor: Decodable {
        let name: String
        let kind: String
        let whereLabel: String
        let why: String?
        let present: String
        let aliases: [String]?
        let mustVisit: Bool?
        let guide: String?
        let walkMinutes: Int?
        let lat: Double?
        let lng: Double?

        enum CodingKeys: String, CodingKey {
            case name, kind, why, present, aliases, mustVisit, guide, walkMinutes, lat, lng
            case whereLabel = "where"
        }

        var keys: [String] { [name] + (aliases ?? []) }
        var isMustVisit: Bool { mustVisit == true }
    }

    private struct File: Decodable {
        struct StationRow: Decodable {
            let station: String
            let anchors: [Anchor]
        }
        let stations: [StationRow]
    }

    private static let rows: [File.StationRow] = {
        guard
            let url = Bundle.main.url(forResource: "land-present-anchors", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let file = try? JSONDecoder().decode(File.self, from: data)
        else { return [] }
        return file.stations
    }()

    private static func stationRowMatch(_ stationName: String, rowStation: String) -> Bool {
        let bare = SavedStationStore.bareName(stationName)
        let key = SavedStationStore.bareName(rowStation)
        guard !bare.isEmpty, !key.isEmpty else { return false }
        if bare == key { return true }
        // 「京阪出町柳」など。駅名がキーを含むときだけ（キーが駅名に含まれる逆方向は禁止）。
        // ※ `key.contains(bare)` は「墨染」→別駅や出町柳への誤爆の温床。
        if key.count >= 2, bare.count >= key.count, bare.contains(key) { return true }
        return false
    }

    static func anchors(forStationName name: String) -> [Anchor] {
        guard let row = rows.first(where: { stationRowMatch(name, rowStation: $0.station) })
        else { return [] }
        return row.anchors
    }

    private static func corpusHas(_ corpus: String, _ anchor: Anchor) -> Bool {
        anchor.keys.contains { corpus.contains($0) }
    }

    private static func isWrongMasugataGate(_ text: String) -> Bool {
        guard text.contains("枡形") || text.contains("桝形") else { return false }
        if text.contains("京阪改札のすぐ外")
            || text.contains("改札のすぐ外")
            || text.contains("改札近く")
            || text.contains("駅前の短いアーケード")
            || text.range(of: #"京阪.{0,12}すぐ"#, options: .regularExpression) != nil
            || text.range(of: #"動線のすぐ外に[、,]?枡形"#, options: .regularExpression) != nil
        {
            return true
        }
        // 「枡形商店街です」なのに5番・出町橋が無い＝改札すぐと誤認した旧文
        if text.contains("枡形商店街です"),
           !text.contains("5番"), !text.contains("出町橋") {
            return true
        }
        return false
    }

    /// 保存済みの誤案内（京阪改札すぐ＝枡形）を正本の行き方に直す。
    private static func scrubWrongMasugataGateCopy(_ station: Station) -> Station {
        let notes = station.sightseeingNotes
        guard !notes.isEmpty else { return station }
        guard let masugata = anchors(forStationName: station.name)
            .first(where: { $0.name == "枡形商店街" })
        else { return station }
        var changed = false
        let next = notes.map { note -> HistoryNote in
            if isWrongMasugataGate(note.title + note.body) {
                changed = true
                return HistoryNote(
                    title: "枡形商店街",
                    body: "\(masugata.name)です。\(masugata.whereLabel)。\(masugata.present)"
                )
            }
            return note
        }
        guard changed else { return station }
        return Station(
            id: station.id,
            name: station.name,
            nameReading: station.nameReading,
            line: station.line,
            prefecture: station.prefecture,
            region: station.region,
            mood: station.mood,
            radiiKm: station.radiiKm,
            stationIntro: station.stationIntro,
            areaAbout: station.areaAbout,
            walkGuide: station.walkGuide,
            historyNotes: station.historyNotes,
            sightseeingNotes: next,
            storyNotes: station.storyNotes,
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

    static func ensure(on station: Station) -> Station {
        var station = scrubWrongMasugataGateCopy(station)
        let list = anchors(forStationName: station.name)
        guard !list.isEmpty else {
            return LandProse.refine(ensureVisitSpots(on: station))
        }

        let corpus = StationLore.landCorpus(station)
        var walk = station.walkGuide ?? ""
        var notes = station.historyNotes

        for anchor in list {
            let named = corpusHas(corpus, anchor)
            let inNotes = notes.contains {
                $0.title.contains(anchor.name) || $0.body.contains(anchor.name)
            }

            if !inNotes {
                if anchor.kind == "road",
                   notes.contains(where: { $0.body.contains("鯖街道") || $0.title.contains("鯖街道") }) {
                    continue
                }
                if anchor.name.contains("枡形"),
                   notes.contains(where: { $0.title.contains("枡形") || $0.body.contains("枡形") }) {
                    continue
                }
                let title: String = {
                    switch anchor.kind {
                    case "university": return "\(anchor.name)のいま"
                    case "arcade": return "\(anchor.name)と土地の顔"
                    case "road": return "\(anchor.name)のこと"
                    default: return anchor.name
                    }
                }()
                let body = [
                    "\(anchor.name)は\(anchor.whereLabel)にあります。",
                    anchor.why ?? "",
                    anchor.present,
                ].joined()
                notes.append(HistoryNote(title: title, body: body))
            }

            if anchor.isMustVisit, !named, !walk.contains(anchor.name) {
                let line = "駅を出たら\(anchor.name)へ寄ります。"
                walk = walk.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    ? line
                    : walk.trimmingCharacters(in: .whitespacesAndNewlines) + line
            }
        }

        let withProse = Station(
            id: station.id,
            name: station.name,
            nameReading: station.nameReading,
            line: station.line,
            prefecture: station.prefecture,
            region: station.region,
            mood: station.mood,
            radiiKm: station.radiiKm,
            stationIntro: station.stationIntro,
            areaAbout: station.areaAbout,
            walkGuide: walk.isEmpty ? station.walkGuide : walk,
            historyNotes: notes,
            sightseeingNotes: station.sightseeingNotes,
            storyNotes: station.storyNotes,
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
        return LandProse.refine(ensureVisitSpots(on: ensureSightseeing(on: withProse)))
    }

    /// 観光案内メモ＝mustVisit 雛形。旧三井家など雛形外は落とす。
    private static func ensureSightseeing(on station: Station) -> Station {
        let must = anchors(forStationName: station.name).filter(\.isMustVisit)
        guard must.count >= 2 else { return station }

        func title(for anchor: Anchor) -> String {
            if anchor.name == "下鴨神社" { return "下鴨神社と糺の森" }
            return anchor.name
        }
        func body(for anchor: Anchor) -> String {
            // 正式名 → 行き方 → 着いたら何があるか
            "\(anchor.name)です。\(anchor.whereLabel)。\(anchor.present)"
        }
        func mentions(_ note: HistoryNote, _ anchor: Anchor) -> Bool {
            let blob = note.title + note.body
            return anchor.keys.contains { !$0.isEmpty && blob.contains($0) }
        }

        let existing = station.sightseeingNotes
        let core: [HistoryNote] = must.map { anchor in
            if let hit = existing.first(where: { mentions($0, anchor) }) {
                let raw = hit.body.trimmingCharacters(in: .whitespacesAndNewlines)
                let useHit = !raw.isEmpty && !isWrongMasugataGate(hit.title + raw)
                return HistoryNote(
                    title: title(for: anchor),
                    body: useHit ? raw : body(for: anchor)
                )
            }
            return HistoryNote(title: title(for: anchor), body: body(for: anchor))
        }
        let extras = existing.filter { note in
            !DemachiTemplate.isForeignDemachiPlace(note.title, stationName: station.name)
                && !must.contains(where: { mentions(note, $0) })
                && !isWrongMasugataGate(note.title + note.body)
        }
        let sightseeing = Array((core + extras).prefix(7))

        return Station(
            id: station.id,
            name: station.name,
            nameReading: station.nameReading,
            line: station.line,
            prefecture: station.prefecture,
            region: station.region,
            mood: station.mood,
            radiiKm: station.radiiKm,
            stationIntro: station.stationIntro,
            areaAbout: station.areaAbout,
            walkGuide: station.walkGuide,
            historyNotes: station.historyNotes,
            sightseeingNotes: sightseeing,
            storyNotes: station.storyNotes,
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

    private static func ensureVisitSpots(on station: Station) -> Station {
        let visit = anchors(forStationName: station.name).filter {
            $0.isMustVisit || ($0.kind == "university" && $0.lat != nil && $0.lng != nil)
        }
        guard !visit.isEmpty else { return station }
        var spots = station.spots
        for anchor in visit {
            if let idx = spots.firstIndex(where: { spot in
                anchor.keys.contains { spot.name.contains($0) || $0.contains(spot.name) }
            }) {
                let cur = spots[idx]
                spots[idx] = Spot(
                    id: cur.id,
                    name: cur.name.contains(anchor.name) ? cur.name : anchor.name,
                    genre: cur.genre,
                    guide: cur.guide,
                    mealTier: cur.mealTier,
                    mealTimes: cur.mealTimes,
                    soloOk: cur.soloOk,
                    budgetYen: cur.budgetYen,
                    hours: cur.hours,
                    blurb: cur.blurb,
                    detail: cur.detail,
                    walkMinutes: anchor.walkMinutes ?? cur.walkMinutes,
                    secretWorthy: cur.secretWorthy,
                    majorWorthy: anchor.isMustVisit ? true : cur.majorWorthy,
                    // 正本座標があれば上書き（駅・デルタ寄せの誤ピンを残さない）
                    lat: anchor.lat ?? cur.lat,
                    lng: anchor.lng ?? cur.lng,
                    coordTrust: anchor.lat != nil ? .lock : cur.coordTrust
                )
                continue
            }
            let guide: GuideKind = {
                switch anchor.guide {
                case "meal": return .meal
                case "rest": return .rest
                case "souvenir": return .souvenir
                case "tip": return .tip
                case "story": return .story
                default: return .sight
                }
            }()
            spots.append(
                Spot(
                    id: "anchor-\(NameMatch.normalize(anchor.name).prefix(28))",
                    name: anchor.name,
                    genre: anchor.kind == "nature" ? "nature" : "town",
                    guide: guide,
                    mealTier: .casual,
                    mealTimes: [],
                    soloOk: true,
                    budgetYen: "—",
                    hours: "終日（屋外）",
                    blurb: [anchor.why, anchor.present].compactMap { $0 }.joined(separator: " "),
                    detail: anchor.whereLabel,
                    walkMinutes: anchor.walkMinutes ?? 8,
                    secretWorthy: false,
                    majorWorthy: true,
                    lat: anchor.lat ?? (anchor.kind == "university" ? station.lat + 0.0045 : station.lat + 0.00012),
                    lng: anchor.lng ?? (anchor.kind == "university" ? station.lng + 0.0045 : station.lng - 0.00015),
                    coordTrust: anchor.lat != nil ? .lock : .unverified
                )
            )
        }
        return station.relocated(
            center: CLLocationCoordinate2D(latitude: station.lat, longitude: station.lng),
            spots: spots
        )
    }
}
