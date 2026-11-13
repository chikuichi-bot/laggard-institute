import Foundation
import MapKit

/// コイン消費前の輪郭。降りる決断に効く材料だけ返す。
/// 薄いときは `isDecisionUseful == false`（定型の「気配」は出さない）。
enum StationSkeletonPreview {
    struct Result: Sendable {
        let station: Station
        let hints: [String]
        /// 決断用の具体文。薄いときは空。
        let contourLine: String
        /// false ならモーダルで偽の輪郭を出さず、詳しく調べる確認だけにする。
        let isDecisionUseful: Bool
    }

    private static let walkKm = 1.2

    static func build(name raw: String) async -> Result? {
        let bare = SavedStationStore.bareName(raw)
        guard !bare.isEmpty else { return nil }

        let locked = LandmarkRegistry.lockedStationCenter(name: bare)
        let seed = locked ?? CLLocationCoordinate2D(latitude: 35.0, longitude: 135.0)
        let stationHit = await searchStation(bare: bare, around: seed)
        let center: CLLocationCoordinate2D
        if let locked {
            center = locked
        } else if let stationHit {
            center = stationHit
        } else {
            return nil
        }

        async let landscapeTask = searchLandscape(bare: bare, around: center)
        async let densityTask = estimateShopDensity(around: center)
        let landscape = await landscapeTask
        let shopCount = await densityTask

        var spots: [Spot] = []
        var lines: [String] = []
        var named: [(kind: String, name: String, walk: Int)] = []
        for item in landscape {
            spots.append(item.spot)
            lines.append(item.line)
            named.append((item.kind, item.spot.name, item.spot.walkMinutes))
        }

        let decision = decisionCopy(bare: bare, named: named, shopCount: shopCount)
        let quiet = named.isEmpty && shopCount < 3

        let area: String = {
            if !lines.isEmpty {
                return (["地図で確かめた寄り道:"] + lines)
                    .joined(separator: "\n")
            }
            if shopCount >= 3 {
                return "地図上は店や街路の名前が続く徒歩圏です。順番と歩き方は、詳しい案内で開きます。"
            }
            return "地図だけでは、降りる判断材料が足りません。詳しい案内で散歩の口実を探します。"
        }()

        let empty: EmptyCopy? = quiet
            ? EmptyCopy(
                headline: "余白を、歩く",
                body: "店が目立たなくても、道や地形そのものが散歩の口実になります。"
            )
            : nil

        let station = Station(
            id: SavedStationStore.stableId(forName: bare),
            name: bare,
            nameReading: nil,
            line: "路線情報は要確認",
            prefecture: "日本",
            region: "関東",
            mood: quiet ? .empty : .story,
            radiiKm: [0.9, 1.0, 1.2],
            stationIntro: decision.isUseful
                ? "\(bare)駅の徒歩圏を、地図から先に開いています。"
                : "\(bare)駅の位置だけ、地図で開いています。",
            areaAbout: area,
            walkGuide: nil,
            historyNotes: [],
            sightseeingNotes: [],
            bikeRental: BikeRental(
                available: false,
                summary: "レンタサイクル情報は案内ができてからお知らせします。",
                places: nil
            ),
            tourTitle: "\(bare)の徒歩圏を、ゆるく歩く",
            catchCopy: quiet
                ? "店がなくても、風景を歩く口実はあります。"
                : "降りた場所から、予定のない寄り道を。",
            emptyCopy: empty,
            railHint: nil,
            lat: center.latitude,
            lng: center.longitude,
            spots: spots
        )

        let hints: [String] = {
            if decision.isUseful {
                return named.prefix(3).map { "\($0.name)（徒歩約\($0.walk)分）" }
            }
            return []
        }()

        return Result(
            station: station,
            hints: hints,
            contourLine: decision.line,
            isDecisionUseful: decision.isUseful
        )
    }

    // MARK: - Decision copy

    private struct DecisionCopy {
        let line: String
        let isUseful: Bool
    }

    /// 具体名か、店密度の分岐だけ。曖昧な「気配」は出さない。
    private static func decisionCopy(
        bare: String,
        named: [(kind: String, name: String, walk: Int)],
        shopCount: Int
    ) -> DecisionCopy {
        if let first = named.first {
            let second = named.dropFirst().first
            if let second {
                return DecisionCopy(
                    line: "\(first.name)まで徒歩約\(first.walk)分、\(second.name)まで約\(second.walk)分。すぐ駅に戻れます。",
                    isUseful: true
                )
            }
            let tone: String = {
                switch first.kind {
                case "川", "用水", "堀", "橋", "堤防":
                    return "水辺を歩いてすぐ駅に戻れます。"
                case "神社", "神宮", "大社":
                    return "門前を短く歩いてすぐ駅に戻れます。"
                case "公園", "緑地":
                    return "緑のまわりを歩いてすぐ駅に戻れます。"
                default:
                    return "歩いてすぐ駅に戻れます。"
                }
            }()
            return DecisionCopy(
                line: "\(first.name)まで徒歩約\(first.walk)分。\(tone)",
                isUseful: true
            )
        }

        if shopCount >= 6 {
            return DecisionCopy(
                line: "地図上は店や街路が続く都市の徒歩圏です。半日でも短くても歩ける密度があります。",
                isUseful: true
            )
        }
        if shopCount >= 3 {
            return DecisionCopy(
                line: "地図上は店の名前がいくつか続く徒歩圏です。順番は詳しい案内で開けます。",
                isUseful: true
            )
        }

        // 薄い：偽の輪郭文は返さない
        _ = bare
        return DecisionCopy(line: "", isUseful: false)
    }

    // MARK: - MapKit

    private static func searchStation(
        bare: String,
        around seed: CLLocationCoordinate2D
    ) async -> CLLocationCoordinate2D? {
        for query in ["\(bare)駅", "\(bare)駅 電車"] {
            let request = MKLocalSearch.Request()
            request.naturalLanguageQuery = query
            request.region = MKCoordinateRegion(
                center: seed,
                latitudinalMeters: 80_000,
                longitudinalMeters: 80_000
            )
            request.resultTypes = [.pointOfInterest]
            request.pointOfInterestFilter = MKPointOfInterestFilter(including: [.publicTransport])
            guard let response = try? await MKLocalSearch(request: request).start() else { continue }
            let want = NameMatch.normalize(bare)
            for item in response.mapItems {
                guard let name = item.name else { continue }
                if name.contains("神社") || name.contains("寺") || name.contains("神宮") { continue }
                guard name.contains("駅") || item.pointOfInterestCategory == .publicTransport else { continue }
                let got = NameMatch.normalize(name)
                guard !got.isEmpty, got == want || got.hasPrefix(want) else { continue }
                return coordinateOf(item)
            }
        }
        return nil
    }

    private struct LandscapeHit {
        let spot: Spot
        let line: String
        let kind: String
    }

    private static func searchLandscape(
        bare: String,
        around center: CLLocationCoordinate2D
    ) async -> [LandscapeHit] {
        // 商業・駅名そのものは採らない。降りる口実になる地形・信仰・緑だけ。
        let queries: [(q: String, kind: String, guide: GuideKind, genre: String)] = [
            ("\(bare) 川", "川", .rest, "nature"),
            ("\(bare) 用水", "用水", .rest, "nature"),
            ("\(bare) 堤防", "堤防", .rest, "nature"),
            ("\(bare) 橋", "橋", .rest, "nature"),
            ("\(bare) 公園", "公園", .rest, "nature"),
            ("\(bare) 緑地", "緑地", .rest, "nature"),
            ("\(bare) 神社", "神社", .sight, "history"),
        ]

        var out: [LandscapeHit] = []
        var seen = Set<String>()
        let origin = CLLocation(latitude: center.latitude, longitude: center.longitude)
        let bareN = NameMatch.normalize(bare)

        for (index, item) in queries.enumerated() {
            if out.count >= 3 { break }
            let request = MKLocalSearch.Request()
            request.naturalLanguageQuery = item.q
            request.region = MKCoordinateRegion(
                center: center,
                latitudinalMeters: walkKm * 2_400,
                longitudinalMeters: walkKm * 2_400
            )
            request.resultTypes = [.pointOfInterest]
            guard let response = try? await MKLocalSearch(request: request).start() else { continue }

            for mapItem in response.mapItems.prefix(4) {
                guard let name = mapItem.name?.trimmingCharacters(in: .whitespacesAndNewlines),
                      !name.isEmpty
                else { continue }
                let key = NameMatch.normalize(name)
                guard !key.isEmpty, !seen.contains(key) else { continue }
                guard isDecisionWorthyPlace(name: name, kind: item.kind, stationBareNormalized: bareN)
                else { continue }

                let coord = coordinateOf(mapItem)
                let km = origin.distance(
                    from: CLLocation(latitude: coord.latitude, longitude: coord.longitude)
                ) / 1000
                guard km <= MapPinTrust.appleMapMaxKm else { continue }

                seen.insert(key)
                let walk = max(1, min(25, Int((km * 1.3 / 4.5 * 60).rounded())))
                let spot = Spot(
                    id: "preview-\(index)-\(key.prefix(12))",
                    name: name,
                    genre: item.genre,
                    guide: item.guide,
                    mealTier: .casual,
                    mealTimes: [.lunch],
                    soloOk: true,
                    budgetYen: "〜¥1,500",
                    hours: nil,
                    blurb: "地図で確認できた寄り道です。",
                    detail: nil,
                    walkMinutes: walk,
                    secretWorthy: false,
                    majorWorthy: true,
                    lat: coord.latitude,
                    lng: coord.longitude,
                    coordTrust: .apple
                )
                out.append(
                    LandscapeHit(
                        spot: spot,
                        line: "・\(name)（徒歩約\(walk)分）",
                        kind: item.kind
                    )
                )
                break
            }
        }
        return out
    }

    /// 駅名・商業施設・曖昧ヒットを落とす。
    private static func isDecisionWorthyPlace(
        name: String,
        kind: String,
        stationBareNormalized: String
    ) -> Bool {
        let n = NameMatch.normalize(name)
        if n.isEmpty { return false }
        // 駅名そのもの／駅名＋商業
        if n == stationBareNormalized { return false }
        if name.hasSuffix("駅") || name.contains("バス") { return false }
        if name.contains("ショッピング") || name.contains("モール") || name.contains("デパート")
            || name.contains("パーキング") || name.localizedCaseInsensitiveContains("odona")
            || name.contains("ビル") || name.contains("ホテル") || name.contains("銀行")
            || name.contains("郵便局") || name.contains("コンビニ") || name.contains("スーパー")
            || name.contains("クリニック") || name.contains("病院") || name.contains("学校")
            || name.contains("大学") || name.contains("庁舎") || name.contains("警察")
        {
            return false
        }

        switch kind {
        case "川", "用水", "堀":
            return name.contains("川") || name.contains("用水") || name.contains("堀")
        case "堤防":
            return name.contains("堤") || name.contains("川")
        case "橋":
            return name.contains("橋") && !name.contains("駅")
        case "公園", "緑地":
            return name.contains("公園") || name.contains("緑地") || name.contains("広場")
        case "神社", "神宮", "大社":
            return name.contains("神社") || name.contains("神宮") || name.contains("大社")
        default:
            return false
        }
    }

    /// 店密度だけ数える（名前は出さない）。
    private static func estimateShopDensity(around center: CLLocationCoordinate2D) async -> Int {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = "レストラン"
        request.region = MKCoordinateRegion(
            center: center,
            latitudinalMeters: 900,
            longitudinalMeters: 900
        )
        request.resultTypes = [.pointOfInterest]
        if #available(iOS 13.0, *) {
            request.pointOfInterestFilter = MKPointOfInterestFilter(including: [
                .restaurant, .cafe, .bakery, .store,
            ])
        }
        guard let response = try? await MKLocalSearch(request: request).start() else { return 0 }
        let origin = CLLocation(latitude: center.latitude, longitude: center.longitude)
        var count = 0
        var seen = Set<String>()
        for item in response.mapItems {
            guard let name = item.name else { continue }
            let key = NameMatch.normalize(name)
            guard !key.isEmpty, !seen.contains(key) else { continue }
            let coord = coordinateOf(item)
            let km = origin.distance(
                from: CLLocation(latitude: coord.latitude, longitude: coord.longitude)
            ) / 1000
            guard km <= 0.9 else { continue }
            seen.insert(key)
            count += 1
            if count >= 8 { break }
        }
        return count
    }

    private static func coordinateOf(_ item: MKMapItem) -> CLLocationCoordinate2D {
        if #available(iOS 26.0, *) { return item.location.coordinate }
        return item.placemark.coordinate
    }
}
