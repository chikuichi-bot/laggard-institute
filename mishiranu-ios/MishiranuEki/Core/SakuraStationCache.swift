import CryptoKit
import Foundation

/// さくらの共有案内キャッシュ（静的 JSON）。外（5G）でも読める本番の正本。
/// Node `lib/mishiranu-station-cache.ts` と同じ鍵・寿命。
enum SakuraStationCache {
    static let baseURL = URL(string: "https://lagado.jp/mishiranu-cache")!
    private static let schema = "v1"
    private static let maxAgeMs: Double = 90 * 24 * 60 * 60 * 1000
    private static let userAgent =
        "MishiranuEkiCache/1.0 (+https://lagado.jp/mishiranu-cache; compatible; Mozilla/5.0)"

    /// 「出町柳駅」「 出町柳 」を同じ鍵にする（sha256 16進）。
    static func cacheKey(for rawName: String) -> String {
        var normalized = rawName.precomposedStringWithCompatibilityMapping
        if let regex = try? NSRegularExpression(pattern: "\\s+", options: []) {
            let range = NSRange(normalized.startIndex..., in: normalized)
            normalized = regex.stringByReplacingMatches(
                in: normalized,
                options: [],
                range: range,
                withTemplate: ""
            )
        }
        if normalized.hasSuffix("駅") {
            normalized = String(normalized.dropLast())
        }
        normalized = normalized.lowercased()
        let digest = SHA256.hash(data: Data(normalized.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    /// 当たれば駅案内。無い・古い・壊れているときは nil。
    static func readStation(name: String) async -> Station? {
        guard let entry = await readEntry(name: name) else { return nil }
        guard let stationObj = entry["station"] as? [String: Any] else { return nil }
        return try? StationNormalizer.station(from: stationObj, sourceHint: "sakura-cache")
    }

    /// 物語のゆかりだけ欲しいとき。
    static func readStoryNotes(name: String) async -> [HistoryNote]? {
        guard let entry = await readEntry(name: name) else { return nil }
        guard let stationObj = entry["station"] as? [String: Any] else { return nil }
        guard let arr = stationObj["storyNotes"] as? [[String: Any]] else { return nil }
        let notes: [HistoryNote] = arr.compactMap { row in
            let title = (row["title"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let body = (row["body"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !title.isEmpty, !body.isEmpty else { return nil }
            return HistoryNote(title: title, body: body)
        }
        return notes.isEmpty ? nil : notes
    }

    private static func readEntry(name: String) async -> [String: Any]? {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        let url = baseURL
            .appendingPathComponent(schema)
            .appendingPathComponent("\(cacheKey(for: trimmed)).json")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 8
        request.setValue(userAgent, forHTTPHeaderField: "User-Agent")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard (200 ... 299).contains(status) else { return nil }
            guard data.count <= 512 * 1024 else { return nil }
            guard let entry = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                return nil
            }
            guard (entry["schema"] as? String) == schema else { return nil }
            guard let savedAt = entry["savedAt"] as? Double ?? (entry["savedAt"] as? Int).map(Double.init)
            else { return nil }
            let ageMs = Date().timeIntervalSince1970 * 1000 - savedAt
            guard ageMs <= maxAgeMs else { return nil }
            return entry
        } catch {
            #if DEBUG
            print("[SakuraCache] miss \(trimmed): \(error)")
            #endif
            return nil
        }
    }
}
