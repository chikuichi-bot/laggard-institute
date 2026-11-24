import CoreLocation
import Foundation

/// 駅ごとに「歩いた軌跡」を端末内だけに残す（G3）。予定ルートではない。
/// キーは駅 id ではなく正規化名（`ai-中書島` など）。id が変わっても消えない。
enum WalkTrailStore {
    private struct File: Codable {
        var version: Int
        var stationName: String?
        var points: [Point]
    }

    struct Point: Codable, Hashable {
        var lat: Double
        var lng: Double
        var at: String?
    }

    /// 保存・読込の共通キー。id ゆれに耐える。
    static func storageKey(stationId: String, stationName: String) -> String {
        let bare = SavedStationStore.bareName(stationName)
        if !bare.isEmpty {
            return SavedStationStore.stableId(forName: bare)
        }
        let id = stationId.trimmingCharacters(in: .whitespacesAndNewlines)
        return id.isEmpty ? "unknown" : id
    }

    private static func fileURL(key: String) -> URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let folder = dir
            .appendingPathComponent("MishiranuEki", isDirectory: true)
            .appendingPathComponent("walk-trails", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let safe = key
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: ":", with: "_")
        return folder.appendingPathComponent("\(safe).json")
    }

    static func load(stationId: String, stationName: String) -> [CLLocationCoordinate2D] {
        let key = storageKey(stationId: stationId, stationName: stationName)
        guard !key.isEmpty else { return [] }
        // 新キー → 旧 id ファイルの順で探す（移行）
        for candidate in [key, stationId] where !candidate.isEmpty {
            guard let data = try? Data(contentsOf: fileURL(key: candidate)),
                  let file = try? JSONDecoder().decode(File.self, from: data)
            else { continue }
            let pts = file.points.map {
                CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lng)
            }
            // 旧 id だけにあったら新キーへ写す
            if candidate != key, !pts.isEmpty {
                save(stationId: stationId, stationName: stationName, coordinates: pts)
            }
            return pts
        }
        return []
    }

    static func save(
        stationId: String,
        stationName: String,
        coordinates: [CLLocationCoordinate2D]
    ) {
        let key = storageKey(stationId: stationId, stationName: stationName)
        guard !key.isEmpty else { return }
        let capped = Array(coordinates.suffix(2_500))
        let file = File(
            version: 2,
            stationName: SavedStationStore.bareName(stationName),
            points: capped.map {
                Point(lat: $0.latitude, lng: $0.longitude, at: nil)
            }
        )
        do {
            let data = try JSONEncoder().encode(file)
            try data.write(to: fileURL(key: key), options: [.atomic])
        } catch {
            print("MishiranuEki: walk-trail write failed: \(error)")
        }
    }

    static func clear(stationId: String, stationName: String) {
        let key = storageKey(stationId: stationId, stationName: stationName)
        guard !key.isEmpty else { return }
        try? FileManager.default.removeItem(at: fileURL(key: key))
        if !stationId.isEmpty, stationId != key {
            try? FileManager.default.removeItem(at: fileURL(key: stationId))
        }
    }
}
