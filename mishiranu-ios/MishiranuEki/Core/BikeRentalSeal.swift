import Foundation

/// 駅のレンタサイクルは「その駅で確認できたもの」だけ残す。他駅の店名・総称・遠いヒットは落とす。
enum BikeRentalSeal {
    /// 徒歩圏の上限（これより遠い Apple ヒットは出さない）
    static let maxWalkMinutes = 8

    /// 出町柳だけ確認済みの正本。
    private static let demachiPlaces: [BikeRentalPlace] = [
        BikeRentalPlace(
            name: "CLEW（クルー）京阪出町柳駅前",
            kind: .app,
            walkMinutes: 1,
            note: "京阪7番出口付近のポート。アプリ登録のあとQRで解錠。ポート間の乗り捨て向き。"
        ),
        BikeRentalPlace(
            name: "レンタサイクルえむじか 出町柳店",
            kind: .local,
            walkMinutes: 2,
            note: "駅すぐの店頭貸出。半日〜長期向き。身分証などの確認を。"
        ),
    ]

    static func ensure(_ station: Station) -> Station {
        var places = station.bikeRental.places ?? []
        places = places
            .map { canonicalizePlace($0, stationName: station.name) }
            .filter { belongs(to: station.name, placeName: $0.name) }
            .filter { !isGenericBikeName($0.name) }
            .filter { ($0.walkMinutes ?? 1) <= maxWalkMinutes }

        if station.name.contains("出町柳") {
            for must in demachiPlaces {
                if !places.contains(where: { matchesCanonical($0.name, must.name) }) {
                    places.append(must)
                }
            }
        }

        places = dedupe(places)
        let available = !places.isEmpty
        let summary: String
        if station.name.contains("出町柳"), available {
            summary =
                "駅すぐには CLEW（クルー）のポートと、店頭貸出のえむじかがあります。短い移動はアプリ、半日たっぷりなら店頭が向きます。"
        } else if available {
            let names = places.map(\.name).joined(separator: "、")
            let base = station.bikeRental.summary.trimmingCharacters(in: .whitespacesAndNewlines)
            summary = base.count >= 12 && !base.contains("未確認")
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
            bikeRental: bike, tourTitle: station.tourTitle,
            catchCopy: station.catchCopy, emptyCopy: station.emptyCopy,
            lat: station.lat, lng: station.lng, spots: station.spots
        )
    }

    /// Apple などで拾った店名を bikeRental へ足す（近い実在ヒットだけ）。
    static func merging(appleNames: [(name: String, walk: Int)], into station: Station) -> Station {
        var places = station.bikeRental.places ?? []
        for hit in appleNames {
            guard looksLikeBike(hit.name) else { continue }
            guard !isGenericBikeName(hit.name) else { continue }
            guard hit.walk <= maxWalkMinutes else { continue }
            guard belongs(to: station.name, placeName: hit.name) else { continue }
            if places.contains(where: { NameMatch.score($0.name, hit.name) >= 78 }) { continue }
            let kind: BikeRentalKind =
                hit.name.localizedCaseInsensitiveContains("CLEW")
                    || hit.name.contains("クルー")
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
                bikeRental: BikeRental(
                    available: !places.isEmpty,
                    summary: station.bikeRental.summary,
                    places: places
                ),
                tourTitle: station.tourTitle,
                catchCopy: station.catchCopy, emptyCopy: station.emptyCopy,
                lat: station.lat, lng: station.lng, spots: station.spots
            )
        )
    }

    static func looksLikeBike(_ name: String) -> Bool {
        let n = name.uppercased()
        return name.contains("レンタ") || name.contains("自転車") || name.contains("サイクル")
            || name.contains("バイクシェア") || n.contains("CLEW") || name.contains("クルー")
            || n.contains("HELLO") || name.contains("ドコモ")
    }

    /// 他駅の店名・ポートを誤って載せない。
    static func belongs(to stationName: String, placeName: String) -> Bool {
        let bare = SavedStationStore.bareName(stationName)
        let place = placeName
        // 出町柳専用の正式名は、出町柳以外では絶対に出さない
        if !bare.contains("出町柳") {
            if place.contains("出町柳") || place.contains("出町") && place.contains("えむじか") {
                return false
            }
            if place.contains("京阪出町柳") { return false }
        }
        // 店名に別の駅名が入っているとき、今の駅と一致しなければ落とす
        let foreignHints = ["出町柳", "三条", "四条", "宇治", "伏見", "嵐山", "奈良", "大阪", "神戸"]
        for hint in foreignHints {
            if place.contains(hint), !bare.contains(hint) {
                return false
            }
        }
        return true
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
            || (a.uppercased().contains("CLEW") && b.uppercased().contains("CLEW")
                && a.contains("出町") == b.contains("出町"))
            || (a.contains("えむじか") && b.contains("えむじか")
                && a.contains("出町") == b.contains("出町"))
    }

    private static func displayName(_ name: String, stationName: String) -> String {
        let bare = SavedStationStore.bareName(stationName)
        let u = name.uppercased()
        if bare.contains("出町柳") {
            if u.contains("CLEW") || name.contains("クルー") {
                return "CLEW（クルー）京阪出町柳駅前"
            }
            if name.contains("えむじか") {
                return "レンタサイクルえむじか 出町柳店"
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

    private static func dedupe(_ places: [BikeRentalPlace]) -> [BikeRentalPlace] {
        var out: [BikeRentalPlace] = []
        for place in places {
            if out.contains(where: { matchesCanonical($0.name, place.name) }) { continue }
            out.append(place)
        }
        return out
    }
}
