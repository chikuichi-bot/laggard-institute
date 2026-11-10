import Foundation

/// 駅のレンタサイクルを、総称ではなく実在サービスの正式名で残す。
enum BikeRentalSeal {
    /// 出町柳など、確認済みの顔になる貸出。
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
        places = canonicalizeNames(places)

        if station.name.contains("出町柳") {
            for must in demachiPlaces {
                if !places.contains(where: { matchesCanonical($0.name, must.name) }) {
                    places.append(must)
                }
            }
            // 総称だけの行は落とす（正式名があるとき）
            places.removeAll { isGenericBikeName($0.name) }
        }

        places = dedupe(places)
        let available = !places.isEmpty || station.bikeRental.available
        let summary: String
        if station.name.contains("出町柳") {
            summary =
                "駅すぐには CLEW（クルー）のポートと、店頭貸出のえむじかがあります。短い移動はアプリ、半日たっぷりなら店頭が向きます。"
        } else if station.bikeRental.summary.count >= 20 {
            summary = station.bikeRental.summary
        } else {
            summary = available
                ? "駅周辺でレンタサイクルやシェアサイクルを使えることがあります。正式な店名・ポート名を案内に出します。"
                : station.bikeRental.summary
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

    /// Apple などで拾った店名を bikeRental へ足す。
    static func merging(appleNames: [(name: String, walk: Int)], into station: Station) -> Station {
        var places = station.bikeRental.places ?? []
        for hit in appleNames {
            guard looksLikeBike(hit.name) else { continue }
            if isGenericBikeName(hit.name) { continue }
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
                    name: canonicalDisplayName(hit.name),
                    kind: kind,
                    walkMinutes: hit.walk,
                    note: kind == .app ? "アプリ登録のあとポートで解錠。" : "店頭で半日〜1日。"
                )
            )
        }
        let sealed = ensure(
            Station(
                id: station.id, name: station.name, nameReading: station.nameReading,
                line: station.line, prefecture: station.prefecture, region: station.region,
                mood: station.mood, radiiKm: station.radiiKm, stationIntro: station.stationIntro,
                areaAbout: station.areaAbout, walkGuide: station.walkGuide,
                historyNotes: station.historyNotes, sightseeingNotes: station.sightseeingNotes,
                bikeRental: BikeRental(
                    available: true,
                    summary: station.bikeRental.summary,
                    places: places
                ),
                tourTitle: station.tourTitle,
                catchCopy: station.catchCopy, emptyCopy: station.emptyCopy,
                lat: station.lat, lng: station.lng, spots: station.spots
            )
        )
        return sealed
    }

    static func looksLikeBike(_ name: String) -> Bool {
        let n = name.uppercased()
        return name.contains("レンタ") || name.contains("自転車") || name.contains("サイクル")
            || name.contains("バイクシェア") || n.contains("CLEW") || name.contains("クルー")
            || n.contains("HELLO") || name.contains("ドコモ")
    }

    private static func isGenericBikeName(_ name: String) -> Bool {
        let generics = [
            "駅前のレンタサイクル", "枡形・駅前のレンタサイクル店", "レンタサイクル店",
            "周辺のレンタサイクル", "貸自転車",
        ]
        return generics.contains(where: { name == $0 || name.hasSuffix($0) && name.count < 18 })
    }

    private static func matchesCanonical(_ a: String, _ b: String) -> Bool {
        NameMatch.score(a, b) >= 72
            || (a.uppercased().contains("CLEW") && b.uppercased().contains("CLEW"))
            || (a.contains("クルー") && b.contains("クルー"))
            || (a.contains("えむじか") && b.contains("えむじか"))
    }

    private static func canonicalDisplayName(_ name: String) -> String {
        let u = name.uppercased()
        if u.contains("CLEW") || name.contains("クルー") {
            if name.contains("出町") { return "CLEW（クルー）京阪出町柳駅前" }
            return name.contains("CLEW") || name.contains("クルー") ? name : "CLEW（クルー）"
        }
        if name.contains("えむじか") { return "レンタサイクルえむじか 出町柳店" }
        return name
    }

    private static func canonicalizeNames(_ places: [BikeRentalPlace]) -> [BikeRentalPlace] {
        places.map { place in
            BikeRentalPlace(
                name: canonicalDisplayName(place.name),
                kind: place.kind ?? place.resolvedKind,
                walkMinutes: place.walkMinutes,
                note: place.note
            )
        }
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
