import Foundation

private struct StationFile: Decodable {
    let version: Int
    let stations: [Station]
}

enum StationStore {
    static func decode(_ data: Data) throws -> [Station] {
        try JSONDecoder().decode(StationFile.self, from: data).stations
    }

    /// アプリに同梱した stations.json（scripts/export-stations.mjs で生成）。
    static func loadBundled() -> [Station] {
        guard
            let url = Bundle.main.url(forResource: "stations", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let stations = try? decode(data)
        else {
            assertionFailure("stations.json を読めませんでした")
            return []
        }
        return stations
    }

    /// 同梱の種＋端末に保存した駅。
    static func loadCatalog() -> [Station] {
        SavedStationStore.merge(bundled: loadBundled(), saved: SavedStationStore.load())
    }
}
