import Foundation

/// 案内を出す直前の関所。過去の実地ミス（配食をご飯にする、出町の混入、川の総称、閉業レンタ、生成メモの店名）をここでまとめて落とす。
/// 保存・思い出し・作り直しのどれでも `remember` が通すので、経路ごとに漏れない。
enum GuideIntegrity {
    static func seal(_ station: Station) -> Station {
        var next = CourseBuilder.snapLandmarkPins(station)
        next = CourseBuilder.ensureLocalMajors(next)
        next = CourseBuilder.normalizeEdibleSouvenirs(next)
        next = LandProse.refine(next)
        // 物語のゆかりを地図ピンへ（作品名付きメモ → 場所スポット）
        next = StoryMapSpots.ensure(on: next)
        next = DemachiTemplate.scrubContamination(on: next)
        next = WalkInMealFilter.strip(from: next)
        next = dropEditorialShops(next)
        next = BikeRentalSeal.ensure(next)
        next = LandscapeSpotName.apply(to: next)
        return next
    }

    /// 「※…以外」など生成メモが店名に混ざった meal/souvenir を捨てる。
    private static func dropEditorialShops(_ station: Station) -> Station {
        let spots = station.spots.filter { spot in
            guard spot.guide == .meal || spot.guide == .souvenir else { return true }
            if spot.name.contains("※") || spot.name.contains("以外") { return false }
            return true
        }
        guard spots.count != station.spots.count else { return station }
        return Station(
            id: station.id, name: station.name, nameReading: station.nameReading,
            line: station.line, prefecture: station.prefecture, region: station.region,
            mood: station.mood, radiiKm: station.radiiKm, stationIntro: station.stationIntro,
            areaAbout: station.areaAbout, walkGuide: station.walkGuide,
            historyNotes: station.historyNotes, sightseeingNotes: station.sightseeingNotes,
            storyNotes: station.storyNotes,
            bikeRental: station.bikeRental, tourTitle: station.tourTitle,
            catchCopy: station.catchCopy, emptyCopy: station.emptyCopy,
            railHint: station.railHint,
            lat: station.lat, lng: station.lng, spots: spots
        )
    }
}
