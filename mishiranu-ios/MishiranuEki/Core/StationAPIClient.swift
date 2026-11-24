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

    /// Cursor Apps ホスト（ログイン壁あり）。生成用の将来ホスト／plist 参照用に残す。
    private static let publicProductionURL = URL(string: "https://mishiranu-eki.apps.grok.bot")!

    /// Release / 設定上の本番 URL（Info.plist `MishiranuAPIBaseURL` があればそれ）。
    static var productionURL: URL {
        if let raw = Bundle.main.object(forInfoDictionaryKey: "MishiranuAPIBaseURL") as? String,
           let url = URL(string: raw), !raw.isEmpty {
            return url
        }
        return publicProductionURL
    }

    /// 屋外の正本はさくら。DEBUG の生成先は Mac LAN。
    static var baseURL: URL {
        #if DEBUG
        return debugLanCandidates().first ?? SakuraStationCache.baseURL
        #else
        return SakuraStationCache.baseURL
        #endif
    }

    private static func isLanURL(_ url: URL) -> Bool {
        let host = url.host ?? ""
        return host.hasPrefix("192.168.")
            || host.hasPrefix("172.")
            || host.hasPrefix("10.")
            || host == "localhost"
            || host == "127.0.0.1"
    }

    #if DEBUG
    private static func debugLanCandidates() -> [URL] {
        // plist が LAN なら先頭。届かない先は短時間で諦める。
        // ※ grok.bot は sign_in_required で外から不通なので候補に入れない。
        var urls: [URL] = []
        func appendUnique(_ url: URL) {
            guard !urls.contains(where: { $0.absoluteString == url.absoluteString }) else { return }
            urls.append(url)
        }
        if let raw = Bundle.main.object(forInfoDictionaryKey: "MishiranuAPIBaseURL") as? String,
           let override = URL(string: raw), !raw.isEmpty, isLanURL(override) {
            appendUnique(override)
        }
        for raw in [
            "http://192.168.0.5:3010",
            "http://192.168.0.8:3010",
            "http://172.20.10.7:3010",
        ] {
            if let url = URL(string: raw) { appendUnique(url) }
        }
        return urls
    }
    #endif

    /// 端末トークン。LAN の Next は Bearer も併用。
    private static func applyDeviceAuth(to request: inout URLRequest, base: URL) {
        request.setValue(deviceToken, forHTTPHeaderField: "x-mishiranu-device-token")
        if isLanURL(base) {
            request.setValue("Bearer \(deviceToken)", forHTTPHeaderField: "Authorization")
        }
    }

    /// - Parameter userAi: 買い切り BYOK のときだけ渡す。ホストの Gemini は使わない。
    /// - Parameter forceRefresh: true なら共有キャッシュを無視して作り直す（要 Mac 3010）。
    static func lookupStation(
        name: String,
        userAi: BillingStore.UserAiPayload? = nil,
        forceRefresh: Bool = false
    ) async throws -> Station {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw StationAPIError.emptyName }

        // 外（5G）の本線: さくらの静的 JSON。Mac なしでも既キャッシュ駅は開く。
        if !forceRefresh, let cached = await SakuraStationCache.readStation(name: trimmed) {
            #if DEBUG
            print("[MishiranuAPI] sakura hit \(trimmed)")
            #endif
            return cached
        }

        #if DEBUG
        if let lan = await resolveLanBaseURL() {
            do {
                return try await lookupStationOnce(
                    name: trimmed,
                    base: lan,
                    userAi: userAi,
                    forceRefresh: forceRefresh,
                    timeout: 120
                )
            } catch {
                if let cached = await SakuraStationCache.readStation(name: trimmed) {
                    return cached
                }
                throw error
            }
        }
        #endif

        if let cached = await SakuraStationCache.readStation(name: trimmed) {
            return cached
        }

        throw StationAPIError.badStatus(
            503,
            "この駅の案内はまだ共有サーバーにありません。一度同じ Wi‑Fi で Mac の案内サーバーから開くと、外でも使えます。"
        )
    }

    /// コイン不要。物語のゆかりだけ（さくら → 正本／grounded は Mac 3010）。
    static func lookupStoryNotes(
        name: String,
        userAi: BillingStore.UserAiPayload? = nil
    ) async throws -> [HistoryNote] {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw StationAPIError.emptyName }

        if let cached = await SakuraStationCache.readStoryNotes(name: trimmed) {
            return cached
        }

        #if DEBUG
        guard let base = await resolveLanBaseURL() else {
            throw StationAPIError.badStatus(
                503,
                "物語のゆかりはまだ共有サーバーにありません。Wi‑Fi で Mac の案内サーバーから一度開いてください。"
            )
        }
        var request = URLRequest(url: base.appendingPathComponent("api/mishiranu/story"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        applyDeviceAuth(to: &request, base: base)
        request.timeoutInterval = 60
        var payload: [String: Any] = ["name": trimmed]
        if let userAi {
            var ai: [String: Any] = [
                "provider": userAi.provider,
                "apiKey": userAi.apiKey,
            ]
            if let baseUrl = userAi.baseUrl { ai["baseUrl"] = baseUrl }
            if let model = userAi.model { ai["model"] = model }
            payload["userAi"] = ai
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            let body = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
            if !(200 ... 299).contains(status) {
                let message = (body["message"] as? String)
                    ?? Self.fallbackMessage(status: status, error: body["error"] as? String, base: base)
                throw StationAPIError.badStatus(status, message)
            }
            return parseStoryNotes(body["storyNotes"])
        } catch let error as StationAPIError {
            throw error
        } catch let urlError as URLError {
            throw StationAPIError.badStatus(
                urlError.errorCode,
                Self.networkFailureMessage(urlError, base: base)
            )
        }
        #else
        throw StationAPIError.badStatus(
            503,
            "物語のゆかりはまだ共有サーバーにありません。別の駅で試すか、しばらくしてからどうぞ。"
        )
        #endif
    }

    private static func parseStoryNotes(_ raw: Any?) -> [HistoryNote] {
        guard let arr = raw as? [[String: Any]] else { return [] }
        return arr.compactMap { row in
            let title = (row["title"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let body = (row["body"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !title.isEmpty, !body.isEmpty else { return nil }
            return HistoryNote(title: title, body: body)
        }
    }

    /// 土地案内 xVoice（xAI TTS）。MP3。失敗時は呼び出し側で AVSpeech にフォールバック。
    static func synthesizeXvoice(text: String) async throws -> Data {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw StationAPIError.badStatus(400, "empty_text")
        }

        #if DEBUG
        if let lan = await resolveLanBaseURL() {
            do {
                return try await synthesizeXvoiceOnce(text: trimmed, endpoint: lan.appendingPathComponent("api/mishiranu/tts"))
            } catch {
                #if DEBUG
                print("[MishiranuAPI] xvoice LAN failed: \(error)")
                #endif
            }
        }
        #endif

        // 屋外 / LAN 不通: さくらの tts.php
        let sakura = SakuraStationCache.baseURL.appendingPathComponent("tts.php")
        return try await synthesizeXvoiceOnce(text: trimmed, endpoint: sakura)
    }

    private static func synthesizeXvoiceOnce(text: String, endpoint: URL) async throws -> Data {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        applyDeviceAuth(to: &request, base: endpoint)
        request.timeoutInterval = 45
        let payload: [String: Any] = [
            "text": text,
            "voice": "eve",
            // 土地案内: 落ち着きを残しつつ句点後が間延びしない速度
            "speed": 1.05,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            let ctype = (response as? HTTPURLResponse)?
                .value(forHTTPHeaderField: "Content-Type")?
                .lowercased() ?? ""
            if !(200 ... 299).contains(status) {
                let body = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
                let message = (body["message"] as? String)
                    ?? Self.fallbackMessage(status: status, error: body["error"] as? String, base: endpoint)
                throw StationAPIError.badStatus(status, message)
            }
            if data.count < 64 {
                throw StationAPIError.badStatus(502, "empty_audio")
            }
            // JSON エラーを誤って再生しない
            if ctype.contains("application/json") || data.first == 0x7B || data.first == 0x5B {
                throw StationAPIError.badStatus(502, "tts_failed")
            }
            return data
        } catch let error as StationAPIError {
            throw error
        } catch let urlError as URLError {
            throw StationAPIError.badStatus(
                urlError.errorCode,
                Self.networkFailureMessage(urlError, base: endpoint)
            )
        }
    }

    /// 死んだ LAN は 2 秒で捨て、生きている Mac だけ本生成に使う。
    private static func resolveLanBaseURL() async -> URL? {
        #if DEBUG
        for candidate in debugLanCandidates() {
            let ok = await isReachable(candidate, timeout: 2)
            print("[MishiranuAPI] probe \(candidate.absoluteString) -> \(ok)")
            if ok {
                return candidate
            }
        }
        #endif
        return nil
    }

    private static func isReachable(_ base: URL, timeout: TimeInterval) async -> Bool {
        var request = URLRequest(url: base)
        request.httpMethod = "GET"
        request.timeoutInterval = timeout
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            // 401/403/404 を「届いた」と誤判定しない。
            return (200 ... 299).contains(status)
        } catch {
            #if DEBUG
            print("[MishiranuAPI] probe error \(base.absoluteString): \(error)")
            #endif
            return false
        }
    }

    private static func lookupStationOnce(
        name: String,
        base: URL,
        userAi: BillingStore.UserAiPayload?,
        forceRefresh: Bool,
        timeout: TimeInterval
    ) async throws -> Station {
        var request = URLRequest(url: base.appendingPathComponent("api/mishiranu/station"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        applyDeviceAuth(to: &request, base: base)
        request.timeoutInterval = timeout
        var payload: [String: Any] = ["name": name]
        if forceRefresh {
            payload["forceRefresh"] = true
        }
        if let userAi {
            var ai: [String: Any] = [
                "provider": userAi.provider,
                "apiKey": userAi.apiKey,
            ]
            if let baseUrl = userAi.baseUrl { ai["baseUrl"] = baseUrl }
            if let model = userAi.model { ai["model"] = model }
            payload["userAi"] = ai
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
            if !(200 ... 299).contains(status) {
                let message = (payload["message"] as? String)
                    ?? Self.fallbackMessage(status: status, error: payload["error"] as? String, base: base)
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
                Self.networkFailureMessage(urlError, base: base)
            )
        }
    }

    private static func networkFailureMessage(_ error: URLError, base: URL) -> String {
        switch error.code {
        case .timedOut:
            return "案内サーバーの応答が遅れています。もう一度どうぞ。"
        case .notConnectedToInternet:
            return "インターネットに接続されていません。通信状況を確認してください。"
        case .cannotConnectToHost, .cannotFindHost, .networkConnectionLost, .dnsLookupFailed:
            if isLanURL(base) {
                return "Macの案内サーバー（3010）に届きません。同じWi‑Fiか、サーバー起動を確認してください。"
            }
            return "案内サーバーに届きません。共有サーバー（さくら）か通信状況を確認してください。"
        default:
            return "案内の通信に失敗しました。通信状況をみて、もう一度どうぞ。"
        }
    }

    private static func fallbackMessage(status: Int, error: String?, base: URL) -> String {
        let sakuraHint =
            "案内の生成サーバーにはいま届きません。共有キャッシュにある駅なら外でも開けます。未登録の駅は Wi‑Fi で Mac から一度開いてください。"
        switch error {
        case "rate_limited":
            return "いま混み合っています。少し待ってから、もう一度どうぞ。"
        case "no_api_key":
            return "案内サーバー側の設定がまだです。しばらくしてから、または別の駅名でどうぞ。"
        case "not_a_station":
            return "鉄道の駅として確認できませんでした。別の駅名で試してください。"
        case "unauthorized", "sign_in_required":
            if isLanURL(base) {
                return "案内サーバーへの接続が拒否されました。Macの開発サーバー（3010）が同じWi‑Fiで起動しているか確認してください。"
            }
            return sakuraHint
        default:
            if status == 401 || status == 403 {
                if isLanURL(base) {
                    return "案内サーバーへの接続が拒否されました。Macの開発サーバー（3010）が同じWi‑Fiで起動しているか確認してください。"
                }
                return sakuraHint
            }
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
        let landChars =
            string(raw["areaAbout"]).count
            + string(raw["stationIntro"]).count
            + string(raw["walkGuide"]).count
        // 真の空白駅は店スポット0でも土地文があれば通す
        guard !spots.isEmpty || landChars >= 80 else { throw StationAPIError.decode }

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

        let railHint = sanitizeRailHint(optionalString(raw["railHint"]))

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
            storyNotes: notes(raw["storyNotes"]),
            bikeRental: bike(raw["bikeRental"]),
            tourTitle: string(raw["tourTitle"], fallback: "\(name)の徒歩圏を、ゆるく歩く"),
            catchCopy: string(raw["catchCopy"], fallback: "降りた場所から、予定のない寄り道を。"),
            emptyCopy: empty,
            railHint: railHint,
            lat: lat,
            lng: lng,
            spots: spots,
            atmosphereCorridors: mergePreferredDetours(
                raw["preferredDetours"],
                into: corridors(raw["corridors"] ?? raw["atmosphereCorridors"], stationLat: lat, stationLng: lng),
                stationLat: lat,
                stationLng: lng
            )
        )
    }

    /// API の corridors。最終の sanitize / 名もなき補完は AtmosphereCorridorCanon。
    private static func corridors(_ raw: Any?, stationLat: Double, stationLng: Double) -> [AtmosphereCorridor] {
        guard let arr = raw as? [Any] else { return [] }
        var out: [AtmosphereCorridor] = []
        var names = Set<String>()
        for (index, item) in arr.enumerated() {
            guard let obj = item as? [String: Any] else { continue }
            let name = string(obj["name"])
            guard !name.isEmpty, !AtmosphereCorridorCanon.isInventedTouristName(name) else { continue }
            guard !names.contains(name) else { continue }
            let pathArr = (obj["path"] as? [Any]) ?? []
            var path: [AtmosphereCorridor.Coord] = pathArr.compactMap { p in
                guard let c = p as? [String: Any] else { return nil }
                let plat = number(c["lat"], fallback: .nan)
                let plng = number(c["lng"], fallback: .nan)
                guard plat.isFinite, plng.isFinite else { return nil }
                return .init(lat: plat, lng: plng)
            }
            if path.count < 2 {
                let mid = path.first ?? .init(lat: stationLat + 0.0007, lng: stationLng + 0.0004)
                path = [mid, mid, mid]
            }
            let related = ((obj["relatedSpotNames"] as? [Any]) ?? []).compactMap { $0 as? String }
            let weaveBefore = ((obj["weaveBeforeKeys"] as? [Any]) ?? []).compactMap { $0 as? String }
                .filter { $0.count >= 2 }
            var kind = string(obj["kind"], fallback: "road")
            if !["arcade", "streetscape", "riverside", "road"].contains(kind) {
                kind = "road"
            }
            names.insert(name)
            out.append(
                AtmosphereCorridor(
                    id: string(obj["id"], fallback: "ai-corridor-\(index + 1)"),
                    name: name,
                    kind: kind,
                    blurb: string(
                        obj["blurb"],
                        fallback: "名前のない道を通り、足元の傾斜と風だけを感じて駅へ戻る。"
                    ),
                    path: Array(path.prefix(6)),
                    relatedSpotNames: related,
                    walkMinutes: max(3, min(15, Int(number(obj["walkMinutes"], fallback: 6).rounded()))),
                    weaveBeforeKeys: weaveBefore
                )
            )
            if out.count >= 5 { break }
        }
        // preferredDetours → corridors（API が別配列で返したとき）
        return out
    }

    /// preferredDetours を空気の道として足す（コース織り込み・道なり経由用）。
    private static func mergePreferredDetours(
        _ raw: Any?,
        into corridors: [AtmosphereCorridor],
        stationLat: Double,
        stationLng: Double
    ) -> [AtmosphereCorridor] {
        guard let arr = raw as? [Any] else { return corridors }
        var out = corridors
        var names = Set(out.map(\.name))
        for (index, item) in arr.enumerated() {
            guard let obj = item as? [String: Any] else { continue }
            let name = string(obj["name"])
            guard name.count >= 2, !names.contains(name) else { continue }
            let before = ((obj["beforeKeys"] as? [Any]) ?? []).compactMap { $0 as? String }
                .filter { $0.count >= 2 }
            guard !before.isEmpty else { continue }
            let lat = number(obj["lat"], fallback: .nan)
            let lng = number(obj["lng"], fallback: .nan)
            guard lat.isFinite, lng.isFinite else { continue }
            let pathArr = (obj["path"] as? [Any]) ?? []
            var path: [AtmosphereCorridor.Coord] = pathArr.compactMap { p in
                guard let c = p as? [String: Any] else { return nil }
                let plat = number(c["lat"], fallback: .nan)
                let plng = number(c["lng"], fallback: .nan)
                guard plat.isFinite, plng.isFinite else { return nil }
                return .init(lat: plat, lng: plng)
            }
            if path.count < 2 {
                path = [
                    .init(lat: lat + 0.00035, lng: lng + 0.0002),
                    .init(lat: lat, lng: lng),
                    .init(lat: lat - 0.00025, lng: lng - 0.00035),
                ]
            }
            let corridorName = "\(name)から\(before[0])へ"
            guard !names.contains(corridorName) else { continue }
            names.insert(corridorName)
            names.insert(name)
            out.insert(
                AtmosphereCorridor(
                    id: string(obj["id"], fallback: "preferred-\(index + 1)"),
                    name: corridorName,
                    kind: "streetscape",
                    blurb: string(obj["blurb"], fallback: "\(name)を通る寄り道。最短より、土地らしい。"),
                    path: Array(path.prefix(6)),
                    relatedSpotNames: [name] + before,
                    walkMinutes: max(4, min(18, Int(number(obj["walkMinutes"], fallback: 8).rounded()))),
                    weaveBeforeKeys: before
                ),
                at: 0
            )
            if out.count >= 5 { break }
        }
        _ = stationLat
        _ = stationLng
        return out
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
        // 欠けた lat/lng を駅から斜めにずらすと、川端・府道上に「それっぽい誤ピン」が並ぶ。
        // 仮置きは駅座標のままにし、LandmarkRegistry / Apple 採取で上書きする。
        let lat = number(raw["lat"], fallback: stationLat)
        let lng = number(raw["lng"], fallback: stationLng)
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

    /// 運行目安。短い・確信っぽいものだけ。
    private static func sanitizeRailHint(_ raw: String?) -> String? {
        guard var t = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !t.isEmpty else {
            return nil
        }
        t = t.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        guard t.count >= 6, t.count <= 48 else { return nil }
        if t.range(of: "http|www\\.|予約|ランキング|必見|絶対", options: .regularExpression) != nil {
            return nil
        }
        let ok = t.range(
            of: "本数|時刻|ローカル|近郊|都市|閑散|終電|帰る|運行|単線|電鉄|電車",
            options: .regularExpression
        ) != nil
        return ok ? t : nil
    }
}
