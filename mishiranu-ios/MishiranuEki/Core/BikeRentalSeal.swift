import Foundation

/// 駅のレンタサイクルは「その駅で確認できたもの」だけ残す。他駅の店名・総称・遠いヒットは落とす。
/// 正本: `bike-rental-locks.json`（CLEW / HELLO の駅名付きポートのみ）。
enum BikeRentalSeal {
    /// 徒歩圏の上限（これより遠い Apple ヒットは出さない）
    static let maxWalkMinutes = 8

    private struct LockFile: Decodable {
        struct Lock: Decodable {
            let station: String
            let kind: String?
            let name: String
            let code: String?
            let address: String?
            let walkMinutes: Int
            let note: String?
            let summary: String?
        }

        let locks: [Lock]
    }

    private static let locks: [LockFile.Lock] = {
        guard let url = Bundle.main.url(forResource: "bike-rental-locks", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let file = try? JSONDecoder().decode(LockFile.self, from: data)
        else { return [] }
        return file.locks
    }()

    private static func lockedPlaces(for stationName: String) -> [BikeRentalPlace] {
        let bare = SavedStationStore.bareName(stationName)
        return locks.compactMap { lock in
            guard bare.contains(lock.station) || stationName.contains(lock.station) else { return nil }
            let kind = BikeRentalKind(rawValue: lock.kind ?? "app") ?? .app
            return BikeRentalPlace(
                name: lock.name,
                kind: kind,
                walkMinutes: lock.walkMinutes,
                note: lock.note
            )
        }
    }

    private static func lockedSummary(for stationName: String) -> String? {
        let bare = SavedStationStore.bareName(stationName)
        return locks.first {
            bare.contains($0.station) || stationName.contains($0.station)
        }?.summary
    }

    static func ensure(_ station: Station) -> Station {
        var places = station.bikeRental.places ?? []
        places = places
            .map { canonicalizePlace($0, stationName: station.name) }
            .filter { belongs(to: station.name, placeName: $0.name) }
            .filter { !isGenericBikeName($0.name) }
            .filter { !isClosedBikeName($0.name) }
            .filter { ($0.walkMinutes ?? 1) <= maxWalkMinutes }

        for must in lockedPlaces(for: station.name) {
            if !places.contains(where: { matchesCanonical($0.name, must.name) }) {
                places.append(must)
            }
        }

        places = dedupe(places)
        let available = !places.isEmpty
        let summary: String
        if available, let locked = lockedSummary(for: station.name) {
            summary = locked
        } else if available {
            let names = places.map(\.name).joined(separator: "、")
            let base = station.bikeRental.summary.trimmingCharacters(in: .whitespacesAndNewlines)
            summary = base.count >= 12 && !base.contains("未確認") && !base.contains("えむじか")
                ? base
                : "この駅で確認できた貸出は次のとおりです（\(names)）。"
        } else {
            summary = "この駅で確認できたレンタサイクルは、いまのところありません。観光案内所や駅掲示も見てください。"
        }

        let bike = BikeRental(available: available, summary: summary, places: places.isEmpty ? nil : places)
        return Station(
            id: station.id, name: station.name, nameReading: station.nameReading,
            line: station.line, prefecture: station.prefecture, region: station.region,
            mood: station.mood, radiiKm: station.radiiKm, stationIntro: station.stationIntro,
            areaAbout: station.areaAbout, walkGuide: station.walkGuide,
            historyNotes: station.historyNotes, sightseeingNotes: station.sightseeingNotes,
            storyNotes: station.storyNotes,
            bikeRental: bike, tourTitle: station.tourTitle,
            catchCopy: station.catchCopy, emptyCopy: station.emptyCopy,
            railHint: station.railHint,
            lat: station.lat, lng: station.lng, spots: station.spots,
            atmosphereCorridors: station.atmosphereCorridors
        )
    }

    /// Apple などで拾った店名を bikeRental へ足す（近い実在ヒットだけ）。
    static func merging(appleNames: [(name: String, walk: Int)], into station: Station) -> Station {
        var places = station.bikeRental.places ?? []
        for hit in appleNames {
            guard looksLikeBike(hit.name) else { continue }
            guard !isGenericBikeName(hit.name) else { continue }
            guard !isClosedBikeName(hit.name) else { continue }
            guard hit.walk <= maxWalkMinutes else { continue }
            guard belongs(to: station.name, placeName: hit.name) else { continue }
            if places.contains(where: { NameMatch.score($0.name, hit.name) >= 78 }) { continue }
            let kind: BikeRentalKind =
                hit.name.localizedCaseInsensitiveContains("CLEW")
                    || hit.name.contains("クルー")
                    || hit.name.localizedCaseInsensitiveContains("CREW")
                    || hit.name.contains("HELLO")
                    || hit.name.contains("ドコモ")
                    || hit.name.contains("シェア")
                    ? .app : .local
            places.append(
                BikeRentalPlace(
                    name: displayName(hit.name, stationName: station.name),
                    kind: kind,
                    walkMinutes: hit.walk,
                    note: kind == .app ? "アプリ登録のあとポートで解錠。" : "店頭で半日〜1日。"
                )
            )
        }
        return ensure(
            Station(
                id: station.id, name: station.name, nameReading: station.nameReading,
                line: station.line, prefecture: station.prefecture, region: station.region,
                mood: station.mood, radiiKm: station.radiiKm, stationIntro: station.stationIntro,
                areaAbout: station.areaAbout, walkGuide: station.walkGuide,
                historyNotes: station.historyNotes, sightseeingNotes: station.sightseeingNotes,
                storyNotes: station.storyNotes,
                bikeRental: BikeRental(
                    available: !places.isEmpty,
                    summary: station.bikeRental.summary,
                    places: places
                ),
                tourTitle: station.tourTitle,
                catchCopy: station.catchCopy, emptyCopy: station.emptyCopy,
                railHint: station.railHint,
                lat: station.lat, lng: station.lng, spots: station.spots,
                atmosphereCorridors: station.atmosphereCorridors
            )
        )
    }

    static func looksLikeBike(_ name: String) -> Bool {
        let n = name.uppercased()
        return name.contains("レンタ") || name.contains("自転車") || name.contains("サイクル")
            || name.contains("バイクシェア") || n.contains("CLEW") || name.contains("クルー")
            || n.contains("CREW") || n.contains("HELLO") || name.contains("ドコモ")
    }

    /// 他駅の店名・ポートを誤って載せない。
    static func belongs(to stationName: String, placeName: String) -> Bool {
        let bare = SavedStationStore.bareName(stationName)
        let place = placeName
        // ロック正本の駅以外に、その駅専用の正式名が付いていたら落とす
        for lock in locks {
            if place.contains(lock.station) || lock.name == place
                || (isClewName(place) && place.contains(lock.station)) {
                if !(bare.contains(lock.station) || stationName.contains(lock.station)) {
                    // 出町柳専用名など
                    if place.contains(lock.station) { return false }
                }
            }
        }
        if !bare.contains("出町柳") {
            if place.contains("出町柳") || place.contains("京阪出町柳") {
                return false
            }
        }
        if !bare.contains("元田中"), place.contains("元田中") {
            return false
        }
        let foreignHints = ["出町柳", "三条", "四条", "宇治", "伏見", "嵐山", "奈良", "大阪", "神戸"]
        for hint in foreignHints {
            if place.contains(hint), !bare.contains(hint) {
                return false
            }
        }
        return true
    }

    /// 閉業・撤去済み。保存データや Apple の古いヒットが残っても出さない。
    static func isClosedBikeName(_ name: String) -> Bool {
        name.contains("えむじか")
    }

    private static func isGenericBikeName(_ name: String) -> Bool {
        let generics = [
            "駅前のレンタサイクル", "枡形・駅前のレンタサイクル店", "レンタサイクル店",
            "周辺のレンタサイクル", "貸自転車", "シェアサイクル", "レンタサイクル",
        ]
        if generics.contains(where: { name == $0 }) { return true }
        if name.count < 8 && (name.contains("レンタ") || name.contains("サイクル")) { return true }
        return false
    }

    private static func matchesCanonical(_ a: String, _ b: String) -> Bool {
        NameMatch.score(a, b) >= 72
            || (isClewName(a) && isClewName(b))
            || (isHelloCyclingName(a) && isHelloCyclingName(b))
    }

    private static func isClewName(_ name: String) -> Bool {
        let u = name.uppercased()
        return u.contains("CLEW") || u.contains("CREW") || name.contains("クルー")
    }

    private static func isHelloCyclingName(_ name: String) -> Bool {
        let u = name.uppercased()
        return (u.contains("HELLO") && u.contains("CYCLING"))
            || name.contains("ハローサイクリング")
            || name.contains("ハロー・サイクリング")
    }

    private static func displayName(_ name: String, stationName: String) -> String {
        let bare = SavedStationStore.bareName(stationName)
        for lock in locks {
            guard bare.contains(lock.station) || stationName.contains(lock.station) else { continue }
            if isClewName(name), isClewName(lock.name) {
                return lock.name
            }
            if isHelloCyclingName(name), isHelloCyclingName(lock.name) {
                return lock.name
            }
        }
        return name
    }

    private static func canonicalizePlace(_ place: BikeRentalPlace, stationName: String) -> BikeRentalPlace {
        BikeRentalPlace(
            name: displayName(place.name, stationName: stationName),
            kind: place.kind ?? place.resolvedKind,
            walkMinutes: place.walkMinutes,
            note: place.note
        )
    }

    /// 同じ系統（CLEW / HELLO など）は1件。近い方・駅名付きを残す。
    private static func dedupe(_ places: [BikeRentalPlace]) -> [BikeRentalPlace] {
        var out: [BikeRentalPlace] = []
        for place in places {
            if let index = out.firstIndex(where: { matchesCanonical($0.name, place.name) }) {
                out[index] = preferred(out[index], place)
                continue
            }
            out.append(place)
        }
        return out
    }

    private static func preferred(_ a: BikeRentalPlace, _ b: BikeRentalPlace) -> BikeRentalPlace {
        let walkA = a.walkMinutes ?? 99
        let walkB = b.walkMinutes ?? 99
        if walkA != walkB { return walkB < walkA ? b : a }
        return b.name.count > a.name.count ? b : a
    }
}
