import Foundation
import MapKit

/// 場所の正本は **ロック → Apple マップ**。AI の lat/lng は文案専用で地図に残さない。
/// 初めて降りる人向けに、土地の顔になるメジャーなものだけ残す。
enum SpotLocator {
    /// 観光・休むところの採取半径（徒歩圏 約1km）。
    private static let walkRadiusKm = 1.1
    /// ご飯・土産の採取半径（ロック定番は別枠で半径外も採る）。
    private static let shopWalkRadiusKm = 1.2
    private static let shopMaxWalkMinutes = 22
    /// 地図に出してよい Apple ピンの上限（MapPinTrust と同じ）。
    private static let appleMapMaxKm = MapPinTrust.appleMapMaxKm
    /// ロック／定番の名検索だけ広げる（みたらし等）。地図ゲートは別。
    private static let stapleSearchMaxKm = 2.4
    /// 件数より「その土地の顔」を優先。埋めるための店は足さない。
    private static let maxSightSpots = 4
    private static let maxMealSpots = 3
    private static let maxSouvenirSpots = 4
    private static let maxRestSpots = 4
    private static let maxTipSpots = 1

    static func refine(_ station: Station) async -> Station {
        let lockedCenter = LandmarkRegistry.lockedStationCenter(name: station.name)
        let seedCenter = lockedCenter
            ?? CLLocationCoordinate2D(latitude: station.lat, longitude: station.lng)
        let bare = SavedStationStore.bareName(station.name)
        // AI が出町座標を他駅に貼ると 8km では駅本体に届かない（二ノ瀬は出町から約8.5km）。
        let want = "\(bare)駅"
        let queries = stationQueries(station.name)
        var stationHit = await bestMatch(
            queries: queries,
            want: want,
            around: seedCenter,
            maxKm: 18,
            stationOnly: true,
            minimumScore: 92
        )
        if stationHit == nil {
            stationHit = await bestMatch(
                queries: queries,
                want: want,
                around: seedCenter,
                maxKm: 80,
                stationOnly: true,
                minimumScore: 92
            )
        }

        // A: 駅中心はロック or MapKit の鉄道駅ヒットだけ採用。神社・町名代表点は拒否。
        let center: CLLocationCoordinate2D
        let centerVerified: Bool
        if let locked = lockedCenter {
            center = locked
            centerVerified = true
        } else if let hit = stationHit {
            center = hit.coordinate
            centerVerified = true
        } else {
            center = seedCenter
            centerVerified = false
        }

        // 1) Apple マップから周辺を採取し、メジャー度で絞る
        // 駅名門前の「○○神社」も必ず探す（藤森→藤森神社）。駅舎自体は名所にしない。
        var preferred = station.spots.filter(\.majorWorthy).map(\.name).filter {
            !$0.hasSuffix("駅")
                && !DemachiTemplate.isForeignDemachiPlace($0, stationName: station.name)
        }
        for seed in ["\(bare)神社", "\(bare)神宮", "\(bare)大社"] where !preferred.contains(seed) {
            preferred.insert(seed, at: 0)
        }
        preferred.append(contentsOf: LandmarkRegistry.appleSearchNames(for: station.name))
        var appleSpots = await harvestApplePlaces(
            around: center,
            stationName: station.name,
            preferredMajors: preferred
        )
        // 駅中心が未検証なら Apple 座標を地図に出さない（ロックは後段で戻る）
        if !centerVerified {
            appleSpots = appleSpots.map { $0.withTrust(.unverified) }
        }
        // 2) AI は文案だけ。座標は Apple／ロック。AI 仮座標は載せない。
        let blend = blendAICopy(aiSpots: station.spots, appleSpots: appleSpots, stationName: station.name)
        var pinned = await resolveMissingCoordinates(
            blend.ready,
            unresolved: blend.needsApplePin,
            center: center,
            stationName: station.name,
            allowApplePins: centerVerified
        )
        if !centerVerified {
            pinned = pinned.map { spot in
                if LandmarkRegistry.isLocked(spot, stationName: station.name) { return spot }
                if spot.coordTrust == .apple { return spot.withTrust(.unverified) }
                return spot
            }
        }
        let firstVisit = FirstVisitFaces.filterSpots(pinned, stationName: station.name)
        // 3) レンタサイクル（CLEW 等）を Apple から拾って bikeRental へ
        let bikeHits = centerVerified
            ? await harvestBikeRentals(around: center, stationName: station.name)
            : []
        let withBike = BikeRentalSeal.merging(appleNames: bikeHits, into: station.relocated(center: center, spots: firstVisit))
        // 4) 名物の正本ピン（ふたば等）を最後に上書き
        let relocated = withBike.relocated(center: center, spots: markMajorFaces(withBike.spots))
        return BikeRentalSeal.ensure(LandmarkRegistry.apply(to: relocated))
    }

    private static func harvestBikeRentals(
        around center: CLLocationCoordinate2D,
        stationName: String
    ) async -> [(name: String, walk: Int)] {
        let bare = SavedStationStore.bareName(stationName)
        // 駅そのものに付く貸出だけ。遠い別駅ポートを拾わない。
        let bikeRadiusKm = 0.5
        let queries = [
            "CLEW \(bare)",
            "クルー \(bare)",
            "\(bare) レンタサイクル",
            "HELLO CYCLING \(bare)",
        ]
        var hits: [(name: String, walk: Int)] = []
        var seen = Set<String>()
        for query in queries {
            if Task.isCancelled { break }
            for place in await searchQuery(query, around: center, maxKm: bikeRadiusKm) {
                guard BikeRentalSeal.looksLikeBike(place.name) || place.name.uppercased().contains("CLEW")
                    || place.name.contains("クルー") else { continue }
                guard !BikeRentalSeal.isClosedBikeName(place.name) else { continue }
                guard BikeRentalSeal.belongs(to: stationName, placeName: place.name) else { continue }
                let key = NameMatch.normalize(place.name)
                guard seen.insert(key).inserted else { continue }
                let walk = max(1, min(BikeRentalSeal.maxWalkMinutes, Int((place.km * 1.3 / 4.5 * 60).rounded())))
                guard walk <= BikeRentalSeal.maxWalkMinutes else { continue }
                hits.append((place.name, walk))
            }
        }
        return hits
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
        // 駅名そのもの（石清水八幡宮など）と、門前の定番社寺を先に引く。
        // 「駅名 寺」は近所の無名寺まで拾うので使わない。ガイドブック級は preferredMajors で引く。
        let lockNames = LandmarkRegistry.appleSearchNames(for: stationName)
        var queries = [
            bare,
            "\(bare)神社",
            "\(bare) 名所",
            "\(bare) 観光",
            "\(bare) 神社",
            "\(bare) 庭園",
            "\(bare) 名物",
            "\(bare) 和菓子",
            "\(bare) 餅",
            "\(bare) 土産",
            "\(bare) お土産",
            "\(bare) みやげ",
            "\(bare) 公園",
            "\(bare) 商店街",
            "\(bare) 市場",
            "\(bare) 橋",
            "\(bare) 喫茶",
            "\(bare) カフェ",
            "\(bare) 茶房",
            // 駅前の定番めし（棒寿司・食堂など）を明示的に引く
            "\(bare) 寿司",
            "\(bare) 棒寿司",
            "\(bare) 鯖寿司",
            "\(bare) 食堂",
            "\(bare) 定食",
            "\(bare) うどん",
            "\(bare) そば",
            "\(bare) ご飯",
        ] + stapleQueries + preferredMajors.prefix(8).map { "\($0)" } + lockNames
        if bare.contains("八幡") {
            queries.append(contentsOf: [
                "飛行神社", "飛行神社 \(bare)", "石清水八幡宮",
                "走井餅", "やわた走井餅老舗", "八幡 土産",
                "朝日屋", "朝日屋 棒寿司", "朝日屋 \(bare)", "鯖の棒寿司 八幡",
            ])
        }
        for query in queries {
            if Task.isCancelled { break }
            let maxKm = lockNames.contains(where: { query.contains($0) || $0.contains(query) })
                ? stapleSearchMaxKm
                : walkRadiusKm
            places.append(contentsOf: await searchQuery(query, around: center, maxKm: maxKm))
        }

        var seen = Set<String>()
        var scored: [(Spot, Double)] = []
        for place in places {
            let key = NameMatch.normalize(place.name)
            guard !key.isEmpty, seen.insert(key).inserted else { continue }
            guard !isNoisePlace(place.name) else { continue }
            guard let guide = guide(for: place) else { continue }
            let displayProbe = LandmarkRegistry.canonicalizeMealName(place.name, stationName: stationName)
                ?? place.name
            let lockedPlace = LandmarkRegistry.isLocked(name: place.name, stationName: stationName)
                || LandmarkRegistry.isLocked(name: displayProbe, stationName: stationName)
            let limit = min(
                appleMapMaxKm,
                (guide == .meal || guide == .souvenir) ? shopWalkRadiusKm : walkRadiusKm
            )
            // ロック定番は半径外でも採る（AI 仮座標に落ちないように）。地図ゲートは MapPinTrust。
            if !lockedPlace {
                guard place.km <= limit else { continue }
            } else {
                guard place.km <= stapleSearchMaxKm else { continue }
            }
            // 駅舎そのものは観光スポットにしない（藤森駅 ≠ 藤森神社）
            if place.name.hasSuffix("駅") { continue }

            let walk = max(1, min(90, Int((place.km * 1.3 / 4.5 * 60).rounded())))
            if !lockedPlace, guide == .meal || guide == .souvenir, walk > shopMaxWalkMinutes {
                continue
            }

            // 近所の寺・小社は、初めて降りる人の案内に載せない
            if FirstVisitFaces.isNeighborhoodWorship(place.name, stationName: stationName) {
                continue
            }
            // 他駅に出町の顔・出町ピンを採らない
            if DemachiTemplate.isForeignDemachiPlace(place.name, stationName: stationName) {
                continue
            }
            if !DemachiTemplate.isDemachiStationName(stationName),
               DemachiTemplate.isOnDemachiPin(
                lat: place.coordinate.latitude, lng: place.coordinate.longitude
               ) {
                continue
            }
            var fame = fameScore(place: place, guide: guide, preferredMajors: preferredMajors, stationName: stationName)
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
                lng: place.coordinate.longitude,
                coordTrust: .apple
            )
            scored.append((spot, fame))
        }

        let majorsOnly = MealStapleCatcher.keepMajorMealsOnly(
            pickMajorFaces(scored),
            stationName: stationName
        )
        if let reach = await halfDayReach(
            around: center,
            stationName: stationName,
            preferredMajors: preferredMajors,
            already: majorsOnly
        ) {
            return majorsOnly + [reach]
        }
        return majorsOnly
    }

    /// 半日のときだけ使う、徒歩圏（約1km）の外の名所1件。
    private static func halfDayReach(
        around center: CLLocationCoordinate2D,
        stationName: String,
        preferredMajors: [String],
        already: [Spot]
    ) async -> Spot? {
        let bare = SavedStationStore.bareName(stationName)
        var places: [ApplePlace] = []
        let queries = ["\(bare) 名所", "\(bare) 観光", "\(bare) 神社"] + preferredMajors.prefix(3).map { "\($0)" }
        for query in queries {
            if Task.isCancelled { break }
            places.append(contentsOf: await searchQuery(query, around: center, maxKm: 2.4))
        }
        var best: (ApplePlace, Double)?
        for place in places {
            guard place.km >= 1.15, place.km <= 2.4 else { continue }
            if isNoisePlace(place.name) { continue }
            if FirstVisitFaces.isNeighborhoodWorship(place.name, stationName: stationName) { continue }
            if already.contains(where: { NameMatch.score($0.name, place.name) >= 78 }) { continue }
            let guidebook = FirstVisitFaces.isGuidebookWorship(place.name, stationName: stationName)
                || FirstVisitFaces.isOrdinaryPublicFace(place.name)
            let named = preferredMajors.contains { NameMatch.score($0, place.name) >= 80 }
            guard guidebook || named else { continue }
            var fame = 50.0 - place.km * 8
            if guidebook { fame += 30 }
            if named { fame += 24 }
            if best == nil || fame > best!.1 { best = (place, fame) }
        }
        guard let place = best?.0 else { return nil }
        let walk = max(20, min(40, Int((place.km * 1.3 / 4.5 * 60).rounded())))
        let key = NameMatch.normalize(place.name)
        return Spot(
            id: "reach-\(key.prefix(24))",
            name: place.name,
            genre: "history",
            guide: .sight,
            mealTier: .casual,
            mealTimes: [],
            soloOk: true,
            budgetYen: "—",
            hours: "終日（屋外）",
            blurb: SpotCopy.compose(name: place.name, guide: .sight, address: place.address),
            detail: "半日のときに、徒歩圏の外へ一箇所だけ足す場所。",
            walkMinutes: walk,
            secretWorthy: false,
            majorWorthy: false,
            lat: place.coordinate.latitude,
            lng: place.coordinate.longitude,
            coordTrust: .apple
        )
    }

    /// 製作所・薬局・タイムズ／リパークなど、初めての土地案内に載せないもの。
    private static func isNoisePlace(_ name: String) -> Bool {
        PlaceNoise.isNoise(name)
    }

    private static func fameScore(
        place: ApplePlace,
        guide: GuideKind,
        preferredMajors: [String],
        stationName: String
    ) -> Double {
        let n = place.name
        var score = 40.0 - place.km * 12
        if preferredMajors.contains(where: { NameMatch.score($0, n) >= 80 }) { score += 50 }
        if let category = place.category {
            switch category {
            case .museum, .park, .theater, .aquarium, .zoo: score += 28
            case .bakery: score += 28
            case .restaurant: score += 18
            case .cafe: score += guide == .rest ? 24 : 6
            case .brewery, .foodMarket: score += 10
            case .store: score -= 8
            case .pharmacy: score -= 40
            case .nightlife: score -= 6
            default:
                if #available(iOS 18.0, *), category == .nationalMonument { score += 32 }
            }
        }
        // 社寺はガイドブック級だけ加点。近所の寺はここに来る前に落とす。
        if FirstVisitFaces.isGuidebookWorship(n, stationName: stationName) {
            score += 42
        } else if n.contains("庭園") || n.contains("城") {
            score += 28
        }
        if FirstVisitFaces.isOrdinaryPublicFace(n) { score += 24 }
        if n.contains("園"), guide == .sight || guide == .rest { score += 22 }
        if n.contains("おにぎり") || n.contains("うどん") || n.contains("そば") || n.contains("蕎麦") || n.contains("食堂") {
            score += 26
        }
        if n.contains("寿司") || n.contains("すし") || n.contains("棒寿司") || n.contains("鯖寿司") {
            score += 30
        }
        if n.contains("朝日屋") { score += 36 }
        if n.contains("パン") || n.contains("進々堂") || n.contains("新進堂") || n.contains("満寿形") { score += 30 }
        if guide == .rest, CourseBuilder.isSitDownCafe(n) { score += 22 }
        else if n.contains("カフェ") || n.contains("茶房") || n.contains("喫茶") { score += 6 }
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

    /// 土地の顔5つ（名所・景色3 + 名物2 目安）に major 印。近さより有名度。
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
            if FirstVisitFaces.isGuidebookWorship(n) { score += 42 }
            else if n.contains("城") { score += 28 }
            if n.contains("デルタ") || n.contains("三角州") { score += 55 }
            if FirstVisitFaces.isOrdinaryPublicFace(n) || blob.contains("合流") { score += 48 }
            if n.contains("城跡") || n.contains("復元") || n.contains("参道") || n.contains("楼門") {
                score -= 25
            }
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
        for s in sights.prefix(MajorFaces.sightTarget) { ids.insert(s.id) }
        var foodAdded = 0
        for s in foodFaces {
            if foodAdded >= MajorFaces.foodTarget { break }
            if ids.insert(s.id).inserted { foodAdded += 1 }
        }
        for s in ranked where ids.count < MajorFaces.total {
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
                lat: spot.lat, lng: spot.lng, coordTrust: spot.coordTrust
            )
        }
    }

    private static func isLandmarkish(_ name: String) -> Bool {
        // 近所の寺は「名所っぽい」扱いにしない（長徳寺・法性寺・西園寺など）
        if FirstVisitFaces.isNeighborhoodWorship(name) { return false }
        return FirstVisitFaces.isGuidebookWorship(name)
            || FirstVisitFaces.isOrdinaryPublicFace(name)
            || name.contains("城") || name.contains("宮")
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
        let n = place.name
        // 喫茶・カフェは休むところ（ご飯の定食屋と混ぜない）
        if CourseBuilder.isSitDownCafe(n) { return .rest }
        if let category = place.category {
            switch category {
            case .cafe:
                return .rest
            case .restaurant, .bakery, .brewery, .foodMarket:
                return .meal
            case .museum, .theater, .aquarium, .zoo:
                return .sight
            case .park, .beach, .marina:
                return .rest
            case .publicTransport:
                return nil
            case .store, .pharmacy, .library, .nightlife:
                break
            default:
                if #available(iOS 18.0, *), category == .nationalMonument {
                    return .sight
                }
                break
            }
        }
        if n.hasSuffix("駅") { return nil }
        if FirstVisitFaces.isGuidebookWorship(n)
            || n.contains("庭園") || n.contains("城")
            || FirstVisitFaces.isOrdinaryPublicFace(n) {
            return .sight
        }
        // 近所の寺・小社は観光枠にも載せない
        if FirstVisitFaces.isNeighborhoodWorship(n) {
            return nil
        }
        if n.contains("園"), !n.contains("保育園"), !n.contains("幼稚園") { return .sight }
        if n.contains("食堂") || n.contains("レストラン") || n.contains("ラーメン")
            || n.contains("うどん") || n.contains("そば") || n.contains("寿司") || n.contains("パン")
            || n.contains("料理") {
            return .meal
        }
        if n.contains("餅") || n.contains("菓子") || n.contains("和菓子") || n.contains("銘菓")
            || n.contains("土産") || n.contains("みやげ") || n.contains("お土産")
            || n.contains("走井") || n.contains("授与") || n.contains("お守り") {
            return .souvenir
        }
        if n.contains("公園") || n.contains("河川敷") {
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
        SpotCopy.compose(name: name, guide: guide, address: address)
    }

    private struct BlendResult {
        /// 座標がロックまたは Apple で確定したもの。
        var ready: [Spot]
        /// 文案は残したいが、まだ Apple 座標が無いもの（AI lat/lng は使わない）。
        var needsApplePin: [Spot]
    }

    /// AI の文案・major 印を、Apple／ロックの同名へ移す。
    /// **AI の lat/lng は地図に載せない。** 未解決は needsApplePin へ回す。
    private static func blendAICopy(aiSpots: [Spot], appleSpots: [Spot], stationName: String) -> BlendResult {
        var result = appleSpots
        var needsApplePin: [Spot] = []
        let bare = SavedStationStore.bareName(stationName)
        let preferred = aiSpots.filter {
            if $0.name.hasSuffix("駅") { return false }
            if FirstVisitFaces.isNeighborhoodWorship($0.name, stationName: stationName) { return false }
            return $0.majorWorthy
                || LandmarkRegistry.isLocked($0, stationName: stationName)
                || isLandmarkish($0.name)
                || NameMatch.score($0.name, bare) >= 78
        }
        for ai in preferred + aiSpots {
            // 駅舎を名所として残さない／駅に神社を吸収させない
            if ai.name.hasSuffix("駅") { continue }
            if FirstVisitFaces.isNeighborhoodWorship(ai.name, stationName: stationName) {
                continue
            }
            if LandmarkRegistry.isLocked(ai, stationName: stationName) {
                let locked = LandmarkRegistry.apply(ai, stationName: stationName)
                if let idx = result.firstIndex(where: { NameMatch.score($0.name, locked.name) >= 85 }) {
                    result[idx] = locked.withCopy(from: ai).moved(
                        to: CLLocationCoordinate2D(latitude: locked.lat, longitude: locked.lng),
                        walkMinutes: locked.walkMinutes
                    )
                } else if !result.contains(where: { NameMatch.score($0.name, locked.name) >= 85 }) {
                    result.append(locked.withCopy(from: ai))
                }
                continue
            }
            if let idx = result.firstIndex(where: {
                !$0.name.hasSuffix("駅") && NameMatch.score($0.name, ai.name) >= 92
            }) {
                let apple = result[idx]
                result[idx] = apple.withCopy(from: ai).moved(
                    to: CLLocationCoordinate2D(latitude: apple.lat, longitude: apple.lng),
                    walkMinutes: apple.walkMinutes
                )
                continue
            }
            // Apple に無い土地の顔は名だけ残し、座標は後で Apple 名検索する（AI 仮座標は捨てる）
            let keep = ai.majorWorthy
                || isLandmarkish(ai.name)
                || (!ai.name.hasSuffix("駅") && NameMatch.score(ai.name, bare) >= 78)
                || ai.guide == .souvenir
                || CourseBuilder.isEdibleOmiyage(ai)
            if keep,
               !result.contains(where: { NameMatch.score($0.name, ai.name) >= 85 }),
               !needsApplePin.contains(where: { NameMatch.score($0.name, ai.name) >= 85 })
            {
                needsApplePin.append(ai)
            }
        }
        return BlendResult(
            ready: FirstVisitFaces.filterSpots(result, stationName: stationName),
            needsApplePin: needsApplePin
        )
    }

    /// 未解決スポットを店名で Apple 検索。見つからずロックも無いものは落とす（誤ピンを残さない）。
    private static func resolveMissingCoordinates(
        _ ready: [Spot],
        unresolved: [Spot],
        center: CLLocationCoordinate2D,
        stationName: String,
        allowApplePins: Bool
    ) async -> [Spot] {
        var result = ready
        for ai in unresolved {
            if Task.isCancelled { break }
            if result.contains(where: { NameMatch.score($0.name, ai.name) >= 85 }) { continue }

            if LandmarkRegistry.isLocked(ai, stationName: stationName) {
                result.append(LandmarkRegistry.apply(ai, stationName: stationName).withCopy(from: ai))
                continue
            }
            guard allowApplePins else { continue }

            let bare = SavedStationStore.bareName(stationName)
            var queries = [ai.name, "\(ai.name) \(bare)"]
            queries.append(contentsOf: landscapeFallbackQueries(for: ai.name, stationBare: bare))

            let hit = await bestMatch(
                queries: queries,
                want: ai.name,
                around: center,
                maxKm: appleMapMaxKm,
                stationOnly: false,
                minimumScore: 90
            )
            // B: 徒歩圏外の同名店は地図に載せない
            if let hit, hit.kmFromCenter <= appleMapMaxKm {
                let walk = max(1, min(90, Int((hit.kmFromCenter * 1.3 / 4.5 * 60).rounded())))
                result.append(
                    ai.moved(to: hit.coordinate, walkMinutes: walk, coordTrust: .apple)
                )
                continue
            }
            // Apple にもロックにも無い → 文案があってもピンは出さない（川端に仮置きしない）
            // 案内タブには残り、シートで「位置未確定」とマップ検索へ誘導する。
        }
        return result
    }

    /// 固有店名が外れたとき用。川・橋・公園・神社など広域ランドマークだけを足す。
    private static func landscapeFallbackQueries(for name: String, stationBare: String) -> [String] {
        let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard n.count >= 2 else { return [] }
        let kinds = ["川", "用水", "橋", "公園", "神社", "神宮", "寺", "堤防", "緑地", "遊歩道"]
        guard kinds.contains(where: { n.contains($0) }) else { return [] }
        return [
            "\(n) \(stationBare)",
            "\(stationBare) \(n)",
        ]
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
                    guard isRailwayStationHit(
                        name: name,
                        category: item.pointOfInterestCategory
                    ) else { continue }
                }
                // 検索文（店名＋駅名）ではなく、欲しい店名だけで採点する。
                // 駅名が入ったクエリだと、結果が駅や別の短い地名に吸われる。
                let score = NameMatch.score(want, name)
                guard score >= minimumScore else { continue }
                let wantN = NameMatch.normalize(want)
                let nameN = NameMatch.normalize(name)
                if nameN.count * 2 < wantN.count, score < 98 { continue }
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
        // 「○○」単体は神社・町に吸われやすいので、駅付きを先に。
        return ["\(bare)駅", "\(bare)駅 京阪", "\(bare)駅 電車"]
    }

    /// 駅中心に採用してよいヒットか。神社・寺だけは拒否。
    private static func isRailwayStationHit(
        name: String,
        category: MKPointOfInterestCategory?
    ) -> Bool {
        if isWorshipNotStation(name) { return false }
        if name.hasSuffix("駅") { return true }
        if category == .publicTransport, name.contains("駅") { return true }
        return false
    }

    private static func isWorshipNotStation(_ name: String) -> Bool {
        if name.contains("駅") { return false }
        return name.contains("神社")
            || name.contains("神宮")
            || name.contains("大社")
            || name.contains("寺")
            || name.hasSuffix("宮")
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
        // 藤森駅 ≠ 藤森神社。駅舎と門前の社寺・名所は別物として扱う。
        let aSta = a.hasSuffix("駅")
        let bSta = b.hasSuffix("駅")
        if aSta != bSta {
            let aWorship = FirstVisitFaces.isWorshipName(a) || FirstVisitFaces.isOrdinaryPublicFace(a)
            let bWorship = FirstVisitFaces.isWorshipName(b) || FirstVisitFaces.isOrdinaryPublicFace(b)
            if (aSta && bWorship) || (bSta && aWorship) {
                return 40
            }
        }
        let x = normalize(a), y = normalize(b)
        if x.isEmpty || y.isEmpty { return 0 }
        if x == y {
            // 正規化後だけ一致（藤森駅→藤森 と 藤森）は駅マッチ用。名所マージには使わせない。
            if aSta != bSta { return 72 }
            return 100
        }
        if x.contains(y) || y.contains(x) {
            let shorter = min(x.count, y.count)
            let longer = max(x.count, y.count)
            // 「淀」⊂「淀屋橋」のような短い包含は駅の取り違え。高得点にしない。
            if shorter * 2 < longer {
                return aSta != bSta ? 28 : 42
            }
            let raw = 70 + 25 * Double(shorter) / Double(longer)
            if aSta != bSta { return min(raw, 70) }
            return raw
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
        let raw = 65 * Double(longest) / Double(max(xs.count, y.count))
        if aSta != bSta { return min(raw, 70) }
        return raw
    }
}

extension Spot {
    func moved(to c: CLLocationCoordinate2D, walkMinutes: Int? = nil, coordTrust: CoordTrust? = nil) -> Spot {
        Spot(
            id: id, name: name, genre: genre, guide: guide, mealTier: mealTier, mealTimes: mealTimes,
            soloOk: soloOk, budgetYen: budgetYen, hours: hours, blurb: blurb, detail: detail,
            walkMinutes: walkMinutes ?? self.walkMinutes, secretWorthy: secretWorthy,
            majorWorthy: majorWorthy, lat: c.latitude, lng: c.longitude,
            coordTrust: coordTrust ?? self.coordTrust
        )
    }

    func withTrust(_ trust: CoordTrust) -> Spot {
        Spot(
            id: id, name: name, genre: genre, guide: guide, mealTier: mealTier, mealTimes: mealTimes,
            soloOk: soloOk, budgetYen: budgetYen, hours: hours, blurb: blurb, detail: detail,
            walkMinutes: walkMinutes, secretWorthy: secretWorthy, majorWorthy: majorWorthy,
            lat: lat, lng: lng, coordTrust: trust
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
            lng: lng,
            coordTrust: coordTrust == .unverified && ai.coordTrust != .unverified
                ? ai.coordTrust
                : coordTrust
        )
    }
}

extension Station {
    func relocated(center: CLLocationCoordinate2D, spots: [Spot]) -> Station {
        Station(
            id: id, name: name, nameReading: nameReading, line: line, prefecture: prefecture, region: region,
            mood: mood, radiiKm: radiiKm, stationIntro: stationIntro, areaAbout: areaAbout,
            walkGuide: walkGuide, historyNotes: historyNotes, sightseeingNotes: sightseeingNotes,
            storyNotes: storyNotes,
            bikeRental: bikeRental, tourTitle: tourTitle, catchCopy: catchCopy, emptyCopy: emptyCopy,
            railHint: railHint,
            lat: center.latitude, lng: center.longitude, spots: spots
        )
    }
}
