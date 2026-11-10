import Foundation

enum StationAPIError: Error, LocalizedError {
    case invalidURL
    case badStatus(Int, String)
    case decode
    case emptyName
    case cancelled

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "案内サーバーの設定がありません。"
        case .badStatus(_, let message):
            return message.isEmpty
                ? "案内を取得できませんでした。もう一度どうぞ。"
                : message
        case .decode:
            return "案内の形が読めませんでした。もう一度どうぞ。"
        case .emptyName:
            return "駅名を入力してください。"
        case .cancelled:
            return nil
        }
    }
}

enum StationAPIClient {
    private static let deviceToken = "mishiranu-ios-lagado-2026"

    /// DEBUG: まず Mac の開発サーバー。Release: Info の URL → 公開 Cursor App。
    static var baseURL: URL {
        #if DEBUG
        if let url = URL(string: "http://192.168.0.8:3011") {
            return url
        }
        #endif
        if let raw = Bundle.main.object(forInfoDictionaryKey: "MishiranuAPIBaseURL") as? String,
           let url = URL(string: raw), !raw.isEmpty {
            return url
        }
        return URL(string: "https://mishiranu-eki.apps.grok.bot")!
    }

    static func lookupStation(name: String) async throws -> Station {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw StationAPIError.emptyName }

        var request = URLRequest(url: baseURL.appendingPathComponent("api/mishiranu/station"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(deviceToken)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 120
        request.httpBody = try JSONSerialization.data(withJSONObject: ["name": trimmed])

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
            if !(200 ... 299).contains(status) {
                let message = (payload["message"] as? String)
                    ?? Self.fallbackMessage(status: status, error: payload["error"] as? String)
                throw StationAPIError.badStatus(status, message)
            }
            guard let stationObj = payload["station"] as? [String: Any] else {
                throw StationAPIError.decode
            }
            return try StationNormalizer.station(from: stationObj, sourceHint: payload["source"] as? String)
        } catch let error as StationAPIError {
            throw error
        } catch let urlError as URLError {
            throw StationAPIError.badStatus(
                urlError.errorCode,
                Self.networkFailureMessage(urlError)
            )
        }
    }

    private static func networkFailureMessage(_ error: URLError) -> String {
        switch error.code {
        case .timedOut:
            return "案内サーバーの応答が遅れています。もう一度どうぞ。"
        case .notConnectedToInternet:
            return "インターネットに接続されていません。Wi‑Fiを確認してください。"
        case .cannotConnectToHost, .cannotFindHost, .networkConnectionLost, .dnsLookupFailed:
            return "Macの案内サーバー（3011）に届きません。同じWi‑Fiか、サーバー起動を確認してください。"
        default:
            return "案内の通信に失敗しました。通信状況をみて、もう一度どうぞ。"
        }
    }

    private static func fallbackMessage(status: Int, error: String?) -> String {
        switch error {
        case "rate_limited":
            return "いま混み合っています。少し待ってから、もう一度どうぞ。"
        case "no_api_key":
            return "案内サーバー側の設定がまだです。しばらくしてから、または別の駅名でどうぞ。"
        case "not_a_station":
            return "鉄道の駅として確認できませんでした。別の駅名で試してください。"
        case "unauthorized":
            return "案内サーバーへの接続が拒否されました。"
        default:
            if status >= 500 {
                return "案内の応答が途切れました。もう一度どうぞ。"
            }
            return "その名前では案内をつくれませんでした。別の駅名でもう一度どうぞ。"
        }
    }
}

/// Web / Gemini JSON をネイティブ Station 形へ寄せる。
enum StationNormalizer {
    static func station(from raw: [String: Any], sourceHint: String?) throws -> Station {
        let rawName = string(raw["name"])
        let name = (rawName.hasSuffix("駅") ? String(rawName.dropLast()) : rawName)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { throw StationAPIError.decode }

        let lat = number(raw["lat"], fallback: 35)
        let lng = number(raw["lng"], fallback: 135)
        // 同じ駅名は毎回同じ id（端末保存の再利用用）。時刻付き id は作らない。
        let id = SavedStationStore.stableId(forName: name)

        let spotsRaw = raw["spots"] as? [[String: Any]] ?? []
        let spots: [Spot] = spotsRaw.enumerated().compactMap { index, spot in
            Self.spot(from: spot, index: index, stationLat: lat, stationLng: lng)
        }
        guard !spots.isEmpty else { throw StationAPIError.decode }

        let moodRaw = string(raw["mood"])
        let mood: StationMood = moodRaw == "empty" ? .empty : .story

        let radiiKm = [0.9, 1.0, 1.2]

        let empty: EmptyCopy? = {
            guard mood == .empty else { return nil }
            if let obj = raw["emptyCopy"] as? [String: Any] {
                return EmptyCopy(
                    headline: string(obj["headline"], fallback: "余白を、そのまま座る"),
                    body: string(obj["body"], fallback: "観光リストは短くていい。駅の静けさそのものが案内です。")
                )
            }
            return EmptyCopy(
                headline: string(raw["emptyHeadline"], fallback: "余白を、そのまま座る"),
                body: string(raw["emptyBody"], fallback: "観光リストは短くていい。駅の静けさそのものが案内です。")
            )
        }()

        _ = sourceHint
        return Station(
            id: id,
            name: name,
            nameReading: optionalString(raw["nameReading"]),
            line: string(raw["line"], fallback: "路線情報は要確認"),
            prefecture: string(raw["prefecture"], fallback: "日本"),
            region: string(raw["region"], fallback: "関東"),
            mood: mood,
            radiiKm: radiiKm,
            stationIntro: optionalString(raw["stationIntro"]),
            areaAbout: optionalString(raw["areaAbout"]),
            walkGuide: optionalString(raw["walkGuide"]),
            historyNotes: notes(raw["historyNotes"]),
            sightseeingNotes: notes(raw["sightseeingNotes"]),
            bikeRental: bike(raw["bikeRental"]),
            tourTitle: string(raw["tourTitle"], fallback: "\(name)の徒歩圏を、ゆるく歩く"),
            catchCopy: string(raw["catchCopy"], fallback: "降りた場所から、予定のない寄り道を。"),
            emptyCopy: empty,
            lat: lat,
            lng: lng,
            spots: spots
        )
    }

    private static func spot(from raw: [String: Any], index: Int, stationLat: Double, stationLng: Double) -> Spot? {
        let name = string(raw["name"])
        let blurb = string(raw["blurb"])
        guard !name.isEmpty, !blurb.isEmpty else { return nil }

        let guide = GuideKind(rawValue: string(raw["guide"])) ?? inferredGuide(genre: string(raw["genre"]))
        let mealTier = MealTier(rawValue: string(raw["mealTier"])) ?? .casual
        let mealTimes: [MealTime] = {
            let arr = (raw["mealTimes"] as? [Any])?.compactMap { MealTime(rawValue: "\($0)") } ?? []
            return arr.isEmpty ? [.lunch] : arr
        }()
        let walk = max(1, min(45, Int(number(raw["walkMinutes"], fallback: 10).rounded())))
        let lat = number(raw["lat"], fallback: stationLat + Double(index) * 0.0004)
        let lng = number(raw["lng"], fallback: stationLng + Double(index) * 0.0003)
        let id = string(raw["id"], fallback: "ai-spot-\(index + 1)")

        return Spot(
            id: id,
            name: name,
            genre: string(raw["genre"], fallback: "odd"),
            guide: guide,
            mealTier: guide == .meal ? mealTier : .casual,
            mealTimes: guide == .meal ? mealTimes : [.lunch],
            soloOk: (raw["soloOk"] as? Bool) ?? (mealTier != .upscale),
            budgetYen: string(raw["budgetYen"], fallback: mealTier == .upscale ? "¥3,000〜" : "〜¥1,500"),
            hours: optionalString(raw["hours"]),
            blurb: blurb,
            detail: optionalString(raw["detail"]),
            walkMinutes: walk,
            secretWorthy: (raw["secretWorthy"] as? Bool) ?? false,
            majorWorthy: (raw["majorWorthy"] as? Bool) ?? false,
            lat: lat,
            lng: lng
        )
    }

    private static func inferredGuide(genre: String) -> GuideKind {
        switch genre {
        case "gourmet": return .meal
        case "nature": return .rest
        case "history": return .sight
        default: return .tip
        }
    }

    private static func notes(_ raw: Any?) -> [HistoryNote] {
        guard let arr = raw as? [[String: Any]] else { return [] }
        return arr.compactMap { row in
            let title = string(row["title"])
            let body = string(row["body"])
            guard !title.isEmpty, !body.isEmpty else { return nil }
            return HistoryNote(title: title, body: body)
        }
    }

    private static func bike(_ raw: Any?) -> BikeRental {
        guard let obj = raw as? [String: Any] else {
            return BikeRental(
                available: false,
                summary: "この駅周辺のレンタサイクルは、まだ確認中です。現地の観光案内所や駅掲示もあわせて見てください。",
                places: nil
            )
        }
        let places = (obj["places"] as? [[String: Any]])?.compactMap { row -> BikeRentalPlace? in
            let name = string(row["name"])
            guard !name.isEmpty else { return nil }
            let walk = row["walkMinutes"] as? Int
            let kind = BikeRentalKind(rawValue: string(row["kind"]))
            return BikeRentalPlace(
                name: name,
                kind: kind,
                walkMinutes: walk,
                note: optionalString(row["note"])
            )
        }
        return BikeRental(
            available: (obj["available"] as? Bool) ?? false,
            summary: string(obj["summary"], fallback: "レンタサイクル情報は現地でもご確認ください。"),
            places: places
        )
    }

    private static func string(_ any: Any?, fallback: String = "") -> String {
        if let s = any as? String { return s.trimmingCharacters(in: .whitespacesAndNewlines) }
        return fallback
    }

    private static func optionalString(_ any: Any?) -> String? {
        let s = string(any)
        return s.isEmpty ? nil : s
    }

    private static func number(_ any: Any?, fallback: Double) -> Double {
        if let n = any as? NSNumber { return n.doubleValue }
        if let d = any as? Double { return d }
        if let i = any as? Int { return Double(i) }
        return fallback
    }
}
