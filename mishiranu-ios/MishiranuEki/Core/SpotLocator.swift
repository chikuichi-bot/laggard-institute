import Foundation
import MapKit

/// 場所の正本は Apple マップ。
/// 初めて降りる人向けに、土地の顔になるメジャーなものだけ残す。
enum SpotLocator {
    /// 観光・休むところの採取半径。
    private static let walkRadiusKm = 2.0
    /// ご飯・土産の採取半径。
    private static let shopWalkRadiusKm = 1.6
    private static let shopMaxWalkMinutes = 18
    /// 件数より「その土地の顔」を優先。埋めるための店は足さない。
    private static let maxSightSpots = 4
    private static let maxMealSpots = 3
    private static let maxSouvenirSpots = 2
    private static let maxRestSpots = 2
    private static let maxTipSpots = 1

    static func refine(_ station: Station) async -> Station {
        var center = CLLocationCoordinate2D(latitude: station.lat, longitude: station.lng)
        if let hit = await bestMatch(
            queries: stationQueries(station.name),
            want: "\(SavedStationStore.bareName(station.name))駅",
            around: center,
            maxKm: 8,
            stationOnly: true
        ) {
            center = hit.coordinate
        }

        // 1) Apple マップから周辺を採取し、メジャー度で絞る
        let appleSpots = await harvestApplePlaces(
            around: center,
            stationName: station.name,
            preferredMajors: station.spots.filter(\.majorWorthy).map(\.name)
        )
        // 2) AI 文案は、地図上の同名へだけ載せる
        let blended = blendAICopy(aiSpots: station.spots, appleSpots: appleSpots, stationName: station.name)
        // 3) 名物の正本ピン（ふたば等）を最後に上書き
        let relocated = station.relocated(center: center, spots: markMajorFaces(blended))
        return LandmarkRegistry.apply(to: relocated)
    }

    // MARK: - Apple harvest

    private struct ApplePlace {
        let name: String
        let coordinate: CLLocationCoordinate2D
        let km: Double
        let category: MKPointOfInterestCategory?
        let address: String?
    }

    private static func harvestApplePlaces(
        around center: CLLocationCoordinate2D,
        stationName: String,
        preferredMajors: [String]
    ) async -> [Spot] {
        var places: [ApplePlace] = []
        places.append(contentsOf: await searchNearbyPOIs(center: center, radiusMeters: shopWalkRadiusKm * 1000))
        places.append(contentsOf: await searchNearbyPOIs(center: center, radiusMeters: walkRadiusKm * 1000))

        let bare = SavedStationStore.bareName(stationName)
        // 名所＋「屋号＋業態」の定番めしを先に引く（お米自慢 おにぎり屋さん 型）
        let stapleQueries = MealStapleCatcher.searchQueries(
            stationName: stationName,
            existingNames: preferredMajors
        )
        let queries = [
            "\(bare) 名所",
            "\(bare) 観光",
            "\(bare) 神社",
            "\(bare) 寺",
            "\(bare) 庭園",
            "\(bare) 名物",
            "\(bare) 和菓子",
            "\(bare) 公園",
        ] + stapleQueries + preferredMajors.prefix(3).map { "\($0) \(bare)" }
        for query in queries {
            if Task.isCancelled { break }
            places.append(contentsOf: await searchQuery(query, around: center, maxKm: walkRadiusKm))
        }

        var seen = Set<String>()
        var scored: [(Spot, Double)] = []
        for place in places {
            let key = NameMatch.normalize(place.name)
            guard !key.isEmpty, seen.insert(key).inserted else { continue }
            guard !isNoisePlace(place.name) else { continue }
            guard let guide = guide(for: place) else { continue }
            let limit = (guide == .meal || guide == .souvenir) ? shopWalkRadiusKm : walkRadiusKm
            guard place.km <= limit else { continue }
            if place.name.hasSuffix("駅"), guide != .sight { continue }

            let walk = max(1, min(90, Int((place.km * 1.3 / 4.5 * 60).rounded())))
            if guide == .meal || guide == .souvenir, walk > shopMaxWalkMinutes { continue }

            var fame = fameScore(place: place, guide: guide, preferredMajors: preferredMajors)
            if guide == .meal {
                fame += MealStapleCatcher.brandTradeScore(place.name)
                if MealStapleCatcher.isWeakCategoryName(place.name) { continue }
                // おにぎり利次郎など、ロック定番以外の同系統は採らない
                if MealStapleCatcher.isNonCanonicalRival(place.name, stationName: stationName) {
                    continue
                }
            }
            // 初めて降りる人向け: メジャー度が低いものは載せない
            guard fame >= 28 else { continue }

            let displayName = LandmarkRegistry.canonicalizeMealName(place.name, stationName: stationName)
                ?? place.name
            let blurb = appleBlurb(name: displayName, guide: guide, address: place.address)
            let spot = Spot(
                id: "apple-\(key.prefix(24))-\(Int(place.coordinate.latitude * 1e5))-\(Int(place.coordinate.longitude * 1e5))",
                name: displayName,
                genre: genre(for: guide),
                guide: guide,
                mealTier: .casual,
                mealTimes: [.morning, .lunch, .dinner],
                soloOk: true,
                budgetYen: guide == .meal ? "〜¥1,500" : "—",
                hours: nil,
                blurb: blurb,
                detail: place.address,
                walkMinutes: walk,
                secretWorthy: false,
                majorWorthy: false,
                lat: place.coordinate.latitude,
                lng: place.coordinate.longitude
            )
            scored.append((spot, fame))
        }

        let majorsOnly = MealStapleCatcher.keepMajorMealsOnly(
            pickMajorFaces(scored),
            stationName: stationName
        )
        return majorsOnly
    }

    /// 製作所・薬局など、初めての土地案内に載せないもの。
    private static func isNoisePlace(_ name: String) -> Bool {
        let n = name
        let noise = [
            "製作所", "制作所", "工場", "工業", "金属", "鉄工", "有限会社", "株式会社",
            "自動車", "整備", "石油", "スタンド", "ATM", "銀行", "郵便局", "交番",
            "病院", "医院", "歯科", "薬局", "ドラッグ", "コンビニ", "スーパー",
            "コインランドリー", "駐車場", "パーキング",
        ]
        return noise.contains { n.contains($0) }
    }

    private static func fameScore(place: ApplePlace, guide: GuideKind, preferredMajors: [String]) -> Double {
        let n = place.name
        var score = 40.0 - place.km * 12
        if preferredMajors.contains(where: { NameMatch.score($0, n) >= 80 }) { score += 50 }
        if let category = place.category {
            switch category {
            case .museum, .park, .theater, .aquarium, .zoo: score += 28
            case .bakery: score += 28
            case .restaurant: score += 18
            case .cafe: score += 6
            case .brewery, .foodMarket: score += 10
            case .store: score -= 8
            case .pharmacy: score -= 40
            case .nightlife: score -= 6
            default:
                if #available(iOS 18.0, *), category == .nationalMonument { score += 32 }
            }
        }
        if n.contains("神社") || n.contains("神宮") || n.hasSuffix("寺") || n.contains("庭園") || n.contains("城") {
            score += 36
        }
        if n.contains("園"), guide == .sight || guide == .rest { score += 22 }
        if n.contains("おにぎり") || n.contains("うどん") || n.contains("そば") || n.contains("蕎麦") || n.contains("食堂") {
            score += 26
        }
        if n.contains("パン") || n.contains("進々堂") || n.contains("新進堂") || n.contains("満寿形") { score += 30 }
        if n.contains("カフェ") || n.contains("茶房") || n.contains("喫茶") { score += 6 }
        if n.contains("餅") || n.contains("菓子") || n.contains("和菓子") || n.contains("銘菓") { score += 24 }
        if n.contains("料理") { score += 8 }
        if n.hasSuffix("駅") { score += 8 }
        if guide == .tip { score -= 12 }
        if guide == .souvenir, !(n.contains("菓子") || n.contains("餅") || n.contains("土産") || n.contains("パン") || n.contains("銘菓")) {
            score -= 20
        }
        // 近所の多目的カフェは土地の顔にしない
        let soft = ["多目的", "つながる", "知る、感じる", "コワーキング", "レンタルスペース"]
        if soft.contains(where: { n.contains($0) }) { score -= 45 }
        return score
    }

    /// ジャンルごとに、メジャー度の高いものだけ残す。
    private static func pickMajorFaces(_ scored: [(Spot, Double)]) -> [Spot] {
        let caps: [GuideKind: Int] = [
            .sight: maxSightSpots,
            .meal: maxMealSpots,
            .souvenir: maxSouvenirSpots,
            .rest: maxRestSpots,
            .tip: maxTipSpots,
        ]
        var out: [Spot] = []
        for guide in GuideKind.order {
            let cap = caps[guide] ?? 0
            let list = scored
                .filter { $0.0.guide == guide }
                .sorted { lhs, rhs in
                    if lhs.1 != rhs.1 { return lhs.1 > rhs.1 }
                    return lhs.0.walkMinutes < rhs.0.walkMinutes
                }
            out.append(contentsOf: list.prefix(cap).map(\.0))
        }
        return out
    }

    /// 土地の顔3つ（名所寄り2 + 名物1）に major 印。近さより有名度。
    private static func markMajorFaces(_ spots: [Spot]) -> [Spot] {
        func faceScore(_ spot: Spot) -> Double {
            let n = spot.name
            let blob = n + spot.blurb + (spot.detail ?? "")
            var score = 0.0
            switch spot.guide {
            case .sight: score += 36
            case .souvenir: score += 22
            case .rest: score += 10
            case .meal: score += 8
            case .tip: score += 2
            }
            if n.contains("神社") || n.contains("寺") || n.contains("城") || n.contains("神宮") || n.contains("大社") {
                score += 42
            }
            if n.contains("デルタ") || n.contains("三角州") || blob.contains("合流") { score += 48 }
            if blob.contains("世界遺産") || blob.contains("名物") || blob.contains("銘菓") { score += 28 }
            if CourseBuilder.isEdibleOmiyage(spot) { score += 40 }
            if n.contains("ふたば") || n.contains("赤福") || n.contains("もみじ饅頭") { score += 30 }
            let soft = ["多目的", "つながる", "知る、感じる", "コワーキング", "レンタルスペース"]
            if soft.contains(where: { n.contains($0) }) { score -= 60 }
            score += max(0, 10 - Double(spot.walkMinutes) * 0.25)
            return score
        }
        let ranked = spots.sorted { faceScore($0) > faceScore($1) }
        let softTokens = ["多目的", "つながる", "知る、感じる", "コワーキング", "レンタルスペース"]
        func isSoft(_ spot: Spot) -> Bool {
            softTokens.contains { spot.name.contains($0) }
        }
        let sights = ranked.filter {
            !isSoft($0) && ($0.guide == .sight || $0.guide == .rest || isLandmarkish($0.name))
        }
        let foodFaces = ranked.filter {
            !isSoft($0) && ($0.guide == .meal || $0.guide == .souvenir)
        }
        var ids = Set<String>()
        for s in sights.prefix(2) { ids.insert(s.id) }
        if let food = foodFaces.first(where: { CourseBuilder.isEdibleOmiyage($0) || $0.guide == .souvenir })
            ?? foodFaces.first {
            ids.insert(food.id)
        }
        for s in ranked where ids.count < 3 {
            if isSoft(s) { continue }
            ids.insert(s.id)
        }
        return spots.map { spot in
            Spot(
                id: spot.id, name: spot.name, genre: spot.genre, guide: spot.guide,
                mealTier: spot.mealTier, mealTimes: spot.mealTimes, soloOk: spot.soloOk,
                budgetYen: spot.budgetYen, hours: spot.hours, blurb: spot.blurb, detail: spot.detail,
                walkMinutes: spot.walkMinutes, secretWorthy: false,
                majorWorthy: ids.contains(spot.id),
                lat: spot.lat, lng: spot.lng
            )
        }
    }

    private static func isLandmarkish(_ name: String) -> Bool {
        name.contains("神社") || name.contains("寺") || name.contains("城")
            || name.contains("デルタ") || name.contains("宮") || name.contains("公園")
            || name.contains("港") || name.contains("市場")
    }

    private static func searchNearbyPOIs(center: CLLocationCoordinate2D, radiusMeters: Double) async -> [ApplePlace] {
        let request = MKLocalPointsOfInterestRequest(center: center, radius: radiusMeters)
        var categories: [MKPointOfInterestCategory] = [
            .restaurant, .cafe, .bakery, .brewery,
            .museum, .park, .theater, .aquarium, .zoo,
            .beach, .marina,
        ]
        if #available(iOS 18.0, *) {
            categories.append(.nationalMonument)
        }
        request.pointOfInterestFilter = MKPointOfInterestFilter(including: categories)
        let origin = CLLocation(latitude: center.latitude, longitude: center.longitude)
        guard let response = try? await MKLocalSearch(request: request).start() else { return [] }
        return response.mapItems.compactMap { item -> ApplePlace? in
            guard let name = item.name, !name.isEmpty else { return nil }
            let coordinate = coordinateOf(item)
            let km = origin.distance(from: CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)) / 1000
            return ApplePlace(
                name: name,
                coordinate: coordinate,
                km: km,
                category: item.pointOfInterestCategory,
                address: addressLine(item)
            )
        }
    }

    private static func searchQuery(_ query: String, around center: CLLocationCoordinate2D, maxKm: Double) async -> [ApplePlace] {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = query
        request.region = MKCoordinateRegion(
            center: center,
            latitudinalMeters: maxKm * 2_200,
            longitudinalMeters: maxKm * 2_200
        )
        request.resultTypes = [.pointOfInterest]
        let origin = CLLocation(latitude: center.latitude, longitude: center.longitude)
        guard let response = try? await MKLocalSearch(request: request).start() else { return [] }
        return response.mapItems.compactMap { item -> ApplePlace? in
            guard let name = item.name, !name.isEmpty else { return nil }
            let coordinate = coordinateOf(item)
            let km = origin.distance(from: CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)) / 1000
            guard km <= maxKm else { return nil }
            return ApplePlace(
                name: name,
                coordinate: coordinate,
                km: km,
                category: item.pointOfInterestCategory,
                address: addressLine(item)
            )
        }
    }

    private static func guide(for place: ApplePlace) -> GuideKind? {
        if let category = place.category {
            switch category {
            case .restaurant, .cafe, .bakery, .brewery, .foodMarket:
                return .meal
            case .museum, .theater, .aquarium, .zoo:
                return .sight
            case .park, .beach, .marina:
                return .rest
            case .publicTransport:
                return place.name.hasSuffix("駅") ? .sight : nil
            case .store, .pharmacy, .library, .nightlife:
                break
            default:
                if #available(iOS 18.0, *), category == .nationalMonument {
                    return .sight
                }
                break
            }
        }
        let n = place.name
        if n.hasSuffix("駅") { return .sight }
        if n.contains("神社") || n.contains("神宮") || n.hasSuffix("寺") || n.contains("庭園") || n.contains("城") {
            return .sight
        }
        if n.contains("園"), !n.contains("保育園"), !n.contains("幼稚園") { return .sight }
        if n.contains("カフェ") || n.contains("食堂") || n.contains("レストラン") || n.contains("ラーメン")
            || n.contains("うどん") || n.contains("そば") || n.contains("寿司") || n.contains("パン")
            || n.contains("茶房") || n.contains("料理") {
            return .meal
        }
        if n.contains("餅") || n.contains("菓子") || n.contains("和菓子") || n.contains("銘菓") || n.contains("土産") {
            return .souvenir
        }
        if n.contains("公園") || n.contains("河川敷") || n.contains("喫茶") {
            return .rest
        }
        // 初めての案内に、分類不明の店は載せない
        return nil
    }

    private static func genre(for guide: GuideKind) -> String {
        switch guide {
        case .meal, .souvenir: return "gourmet"
        case .sight: return "history"
        case .rest: return "nature"
        case .tip: return "odd"
        }
    }

    private static func appleBlurb(name: String, guide: GuideKind, address: String?) -> String {
        let whereText = address.map { "（\($0)）" } ?? ""
        switch guide {
        case .meal:
            return "\(name)\(whereText)。駅からの徒歩圏で立ち寄れる食事どころ。"
        case .souvenir:
            return "\(name)\(whereText)。手土産や買い物の候補。"
        case .sight:
            return "\(name)\(whereText)。この駅からの観光の目印。"
        case .rest:
            return "\(name)\(whereText)。歩いたあとに腰を下ろせる場所。"
        case .tip:
            return "\(name)\(whereText)。予定にない寄り道向き。"
        }
    }

    /// AI の文案・major 印を、Apple の同名スポットへ移す。メジャー指定は優先して残す。
    private static func blendAICopy(aiSpots: [Spot], appleSpots: [Spot], stationName: String) -> [Spot] {
        var result = appleSpots
        let preferred = aiSpots.filter { $0.majorWorthy || LandmarkRegistry.isLocked($0, stationName: stationName) }
        for ai in preferred + aiSpots {
            if LandmarkRegistry.isLocked(ai, stationName: stationName) {
                let locked = LandmarkRegistry.apply(ai, stationName: stationName)
                if let idx = result.firstIndex(where: { NameMatch.score($0.name, locked.name) >= 85 }) {
                    result[idx] = locked.withCopy(from: ai).moved(
                        to: CLLocationCoordinate2D(latitude: locked.lat, longitude: locked.lng),
                        walkMinutes: locked.walkMinutes
                    )
                } else if ai.majorWorthy || preferred.contains(where: { $0.id == ai.id }) {
                    result.append(locked)
                }
                continue
            }
            guard let idx = result.firstIndex(where: { NameMatch.score($0.name, ai.name) >= 82 }) else { continue }
            let apple = result[idx]
            result[idx] = apple.withCopy(from: ai).moved(
                to: CLLocationCoordinate2D(latitude: apple.lat, longitude: apple.lng),
                walkMinutes: apple.walkMinutes
            )
        }
        return result
    }

    // MARK: - Matching helpers (station center)

    private struct Hit {
        let coordinate: CLLocationCoordinate2D
        let kmFromCenter: Double
        let score: Double
    }

    private static func bestMatch(
        queries: [String],
        want: String,
        around center: CLLocationCoordinate2D,
        maxKm: Double,
        stationOnly: Bool,
        minimumScore: Double = 70
    ) async -> Hit? {
        let origin = CLLocation(latitude: center.latitude, longitude: center.longitude)
        var best: Hit?
        for query in queries {
            let request = MKLocalSearch.Request()
            request.naturalLanguageQuery = query
            request.region = MKCoordinateRegion(
                center: center,
                latitudinalMeters: maxKm * 2_200,
                longitudinalMeters: maxKm * 2_200
            )
            request.resultTypes = [.pointOfInterest]
            if stationOnly {
                request.pointOfInterestFilter = MKPointOfInterestFilter(including: [.publicTransport])
            }
            guard let response = try? await MKLocalSearch(request: request).start() else { continue }
            for item in response.mapItems {
                guard let name = item.name else { continue }
                let coordinate = coordinateOf(item)
                let km = origin.distance(from: CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)) / 1000
                guard km <= maxKm else { continue }
                if stationOnly {
                    let ok = item.pointOfInterestCategory == .publicTransport || name.hasSuffix("駅")
                    guard ok else { continue }
                }
                let score = max(NameMatch.score(want, name), NameMatch.score(query, name) - 4)
                guard score >= minimumScore else { continue }
                let rank = score * 10 - km * 20
                if best == nil || rank > best!.score * 10 - best!.kmFromCenter * 20 {
                    best = Hit(coordinate: coordinate, kmFromCenter: km, score: score)
                }
            }
            if let best, best.score >= 96, best.kmFromCenter <= 1.2 { break }
        }
        return best
    }

    private static func stationQueries(_ name: String) -> [String] {
        let bare = SavedStationStore.bareName(name)
        return ["\(bare)駅", bare]
    }

    private static func coordinateOf(_ item: MKMapItem) -> CLLocationCoordinate2D {
        if #available(iOS 26.0, *) { return item.location.coordinate }
        return item.placemark.coordinate
    }

    private static func addressLine(_ item: MKMapItem) -> String? {
        let p = item.placemark
        let parts = [p.thoroughfare, p.subThoroughfare, p.locality, p.subLocality]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: " ")
    }
}

enum NameMatch {
    static func normalize(_ s: String) -> String {
        var t = s.precomposedStringWithCompatibilityMapping.lowercased()
        for (from, to) in [("桝", "枡"), ("餘", "余"), ("ヶ", "ケ"), ("ヵ", "カ"), ("京都", "")] {
            t = t.replacingOccurrences(of: from, with: to)
        }
        t = t.replacingOccurrences(of: "[（(].*?[）)]", with: "", options: .regularExpression)
        t = t.replacingOccurrences(of: "(本店|本舗|店|駅前|駅|跡地|跡)$", with: "", options: .regularExpression)
        t = t.replacingOccurrences(of: "[\\s　・･/／「」『』\\-ー〜~、,.。]", with: "", options: .regularExpression)
        return t
    }

    /// 0–100。完全一致 100、包含 70–95、それ以外は最長共通部分の割合。
    static func score(_ a: String, _ b: String) -> Double {
        let x = normalize(a), y = normalize(b)
        if x.isEmpty || y.isEmpty { return 0 }
        if x == y { return 100 }
        if x.contains(y) || y.contains(x) {
            return 70 + 25 * Double(min(x.count, y.count)) / Double(max(x.count, y.count))
        }
        let xs = Array(x)
        var longest = 0
        for i in 0..<xs.count {
            var j = i + 2
            while j <= xs.count {
                if y.contains(String(xs[i..<j])) { longest = max(longest, j - i) }
                j += 1
            }
        }
        return 65 * Double(longest) / Double(max(xs.count, y.count))
    }
}

extension Spot {
    func moved(to c: CLLocationCoordinate2D, walkMinutes: Int? = nil) -> Spot {
        Spot(
            id: id, name: name, genre: genre, guide: guide, mealTier: mealTier, mealTimes: mealTimes,
            soloOk: soloOk, budgetYen: budgetYen, hours: hours, blurb: blurb, detail: detail,
            walkMinutes: walkMinutes ?? self.walkMinutes, secretWorthy: secretWorthy,
            majorWorthy: majorWorthy, lat: c.latitude, lng: c.longitude
        )
    }

    /// Apple の座標・名前を保ったまま、AI の文案と印だけ借りる。
    func withCopy(from ai: Spot) -> Spot {
        Spot(
            id: id,
            name: name,
            genre: genre.isEmpty ? ai.genre : genre,
            guide: guide,
            mealTier: ai.mealTier,
            mealTimes: ai.mealTimes.isEmpty ? mealTimes : ai.mealTimes,
            soloOk: ai.soloOk,
            budgetYen: ai.budgetYen == "—" ? budgetYen : ai.budgetYen,
            hours: ai.hours ?? hours,
            blurb: ai.blurb.isEmpty ? blurb : ai.blurb,
            detail: ai.detail ?? detail,
            walkMinutes: walkMinutes,
            secretWorthy: ai.secretWorthy || secretWorthy,
            majorWorthy: ai.majorWorthy || majorWorthy,
            lat: lat,
            lng: lng
        )
    }
}

extension Station {
    func relocated(center: CLLocationCoordinate2D, spots: [Spot]) -> Station {
        Station(
            id: id, name: name, nameReading: nameReading, line: line, prefecture: prefecture, region: region,
            mood: mood, radiiKm: radiiKm, stationIntro: stationIntro, areaAbout: areaAbout,
            walkGuide: walkGuide, historyNotes: historyNotes, sightseeingNotes: sightseeingNotes,
            bikeRental: bikeRental, tourTitle: tourTitle, catchCopy: catchCopy, emptyCopy: emptyCopy,
            lat: center.latitude, lng: center.longitude, spots: spots
        )
    }
}
