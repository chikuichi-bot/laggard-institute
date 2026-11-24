import Foundation
import MapKit

/// 駅名検索の候補。カタログに無い駅も Apple 地図から拾う。
struct StationNameCandidate: Identifiable, Equatable {
    let id: String
    let name: String
    let detail: String
    /// 端末に案内があるときだけ。無ければ AI で調べる。
    let knownStation: Station?

    var bareName: String {
        name.hasSuffix("駅") ? String(name.dropLast()) : name
    }
}

enum StationCandidateSearch {
    /// カタログ／保存だけ（同期）。インライン候補の先出し用。
    static func localCandidates(
        for rawQuery: String,
        in stations: [Station],
        savedIds: Set<String>,
        limit: Int = 8
    ) -> [StationNameCandidate] {
        let q = rawQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return [] }
        var out: [StationNameCandidate] = []
        var seen = Set<String>()
        for station in TextMatch.filterStations(q, in: stations, savedIds: savedIds, limit: limit) {
            let k = key(station.name)
            guard !k.isEmpty, !seen.contains(k) else { continue }
            seen.insert(k)
            let saved = savedIds.contains(station.id)
            let label = station.name.hasSuffix("駅") ? station.name : "\(station.name)駅"
            out.append(
                StationNameCandidate(
                    id: station.id,
                    name: label,
                    detail: "\(station.prefecture) · \(station.line)" + (saved ? " · 保存済み" : ""),
                    knownStation: station
                )
            )
        }
        return out
    }

    /// 入力から候補を集める。保存・同梱を先に、足りなければ地図検索。
    static func candidates(
        for rawQuery: String,
        in stations: [Station],
        savedIds: Set<String>,
        limit: Int = 8
    ) async -> [StationNameCandidate] {
        let q = rawQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return [] }
        let bare = q.hasSuffix("駅") ? String(q.dropLast()) : q

        var out = localCandidates(for: q, in: stations, savedIds: savedIds, limit: limit)
        var seen = Set(out.map { key($0.name) })

        func append(name: String, detail: String, station: Station?) {
            let k = key(name)
            guard !k.isEmpty, !seen.contains(k) else { return }
            seen.insert(k)
            let label = name.hasSuffix("駅") ? name : "\(name)駅"
            out.append(
                StationNameCandidate(
                    id: station?.id ?? "cand-\(k)",
                    name: label,
                    detail: detail,
                    knownStation: station
                )
            )
        }

        if out.count < limit {
            let mapped = await mapCandidates(bare: bare, limit: limit - out.count)
            for item in mapped {
                append(name: item.name, detail: item.detail, station: nil)
            }
        }

        // どれも無いときだけ、入力そのものを候補にする（選ばせてから調べる）。
        if out.isEmpty {
            append(name: bare, detail: "入力した名前のまま調べる", station: nil)
        }

        return Array(out.prefix(limit))
    }

    /// 現在地のまわりの駅を Apple 地図から近い順に。保存駅が近くに無いとき用。
    /// POI だけでは空になる端末があるので、自然文検索も併用する。
    static func nearby(
        lat: Double,
        lng: Double,
        in stations: [Station] = [],
        limit: Int = 5
    ) async -> [StationNameCandidate] {
        let here = CLLocation(latitude: lat, longitude: lng)
        let center = here.coordinate
        let radiusMeters = 3500.0

        // 端末の保存・同梱カタログを先に距離で拾う（MapKit より確実）。
        var rows: [(name: String, km: Double, known: Station?)] = []
        var seen = Set<String>()
        for station in stations {
            let km = here.distance(from: CLLocation(latitude: station.lat, longitude: station.lng)) / 1000
            guard km <= nearbyStationKm else { continue }
            let label = station.name.hasSuffix("駅") ? station.name : "\(station.name)駅"
            let k = key(label)
            guard !k.isEmpty, !seen.contains(k) else { continue }
            seen.insert(k)
            rows.append((label, km, station))
        }

        async let poiItems = searchNearbyPOI(center: center, radiusMeters: radiusMeters)
        async let queryItems = searchNearbyQuery("駅", center: center, radiusMeters: radiusMeters)
        async let railItems = searchNearbyQuery("鉄道駅", center: center, radiusMeters: radiusMeters)
        let batches = await [poiItems, queryItems, railItems]

        for item in batches.flatMap({ $0 }) {
            guard let name = stationName(from: item) else { continue }
            let k = key(name)
            guard !k.isEmpty, !seen.contains(k) else { continue }
            let coord = item.placemark.coordinate
            let km = here.distance(from: CLLocation(latitude: coord.latitude, longitude: coord.longitude)) / 1000
            guard km <= nearbyStationKm else { continue }
            seen.insert(k)
            let known = stations.first { key($0.name) == k }
            rows.append((name, km, known))
        }
        return rows
            .sorted { $0.km < $1.km }
            .prefix(limit)
            .map {
                StationNameCandidate(
                    id: $0.known?.id ?? "near-\(key($0.name))",
                    name: $0.name,
                    detail: "現在地から\(Geo.distanceLabel(km: $0.km))",
                    knownStation: $0.known
                )
            }
    }

    private static func searchNearbyPOI(center: CLLocationCoordinate2D, radiusMeters: Double) async -> [MKMapItem] {
        let request = MKLocalPointsOfInterestRequest(center: center, radius: radiusMeters)
        request.pointOfInterestFilter = MKPointOfInterestFilter(including: [.publicTransport])
        return (try? await MKLocalSearch(request: request).start())?.mapItems ?? []
    }

    private static func searchNearbyQuery(
        _ query: String,
        center: CLLocationCoordinate2D,
        radiusMeters: Double
    ) async -> [MKMapItem] {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = query
        request.resultTypes = [.pointOfInterest]
        request.region = MKCoordinateRegion(
            center: center,
            latitudinalMeters: radiusMeters * 2,
            longitudinalMeters: radiusMeters * 2
        )
        return (try? await MKLocalSearch(request: request).start())?.mapItems ?? []
    }

    private static func stationName(from item: MKMapItem) -> String? {
        guard let full = item.name?.trimmingCharacters(in: .whitespacesAndNewlines), !full.isEmpty
        else { return nil }
        // 「出町柳駅（京阪）」の路線注記は外して一つにまとめる。
        let raw = full
            .replacingOccurrences(of: #"\s*[（(].*[)）]\s*$"#, with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        // バス停・タクシー乗り場（「出町柳駅前 - Eのりば」等）は除き、駅名そのものだけ。
        let notStation = ["のりば", "乗り場", "乗場", "バス", "タクシー", "停留所", "駅前"]
        guard raw.hasSuffix("駅"), raw.count > 1,
              !notStation.contains(where: { raw.contains($0) })
        else { return nil }
        return raw
    }

    private static func key(_ name: String) -> String {
        let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return (n.hasSuffix("駅") ? String(n.dropLast()) : n).lowercased()
    }

    private static func mapCandidates(bare: String, limit: Int) async -> [(name: String, detail: String)] {
        guard limit > 0, !bare.isEmpty else { return [] }
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = "\(bare)駅"
        request.resultTypes = [.pointOfInterest, .address]
        guard let response = try? await MKLocalSearch(request: request).start() else { return [] }

        var rows: [(name: String, detail: String, score: Int)] = []
        var seen = Set<String>()
        for item in response.mapItems {
            guard let raw = item.name?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty
            else { continue }
            // 駅っぽいものだけ。バス車庫などを避ける。
            let lower = raw.lowercased()
            let looksStation =
                raw.contains("駅")
                || item.pointOfInterestCategory == .publicTransport
                || lower.contains("station")
            guard looksStation else { continue }
            let bareName = raw.hasSuffix("駅") ? String(raw.dropLast()) : raw
            let k = bareName.lowercased()
            guard !seen.contains(k) else { continue }
            // 入力が駅名に含まれる／前方一致だけ。短い駅名が長い入力に吸われない。
            let score: Int
            if bareName == bare { score = 100 }
            else if bareName.hasPrefix(bare) { score = 80 }
            else if bareName.contains(bare) { score = 60 }
            else { continue }
            seen.insert(k)
            let locality = [
                item.placemark.locality,
                item.placemark.administrativeArea,
            ]
            .compactMap { $0 }
            .joined(separator: " · ")
            rows.append(
                (
                    raw.hasSuffix("駅") ? raw : "\(bareName)駅",
                    locality.isEmpty ? "地図の候補" : locality,
                    score
                )
            )
        }
        return rows
            .sorted { lhs, rhs in
                if lhs.score != rhs.score { return lhs.score > rhs.score }
                return lhs.name.count < rhs.name.count
            }
            .prefix(limit)
            .map { ($0.name, $0.detail) }
    }
}
