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

        var out: [StationNameCandidate] = []
        var seen = Set<String>()

        func key(_ name: String) -> String {
            let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
            return (n.hasSuffix("駅") ? String(n.dropLast()) : n).lowercased()
        }

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

        let local = TextMatch.filterStations(q, in: stations, savedIds: savedIds, limit: limit)
        for station in local {
            let saved = savedIds.contains(station.id)
            append(
                name: station.name,
                detail: "\(station.prefecture) · \(station.line)" + (saved ? " · 保存済み" : ""),
                station: station
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

    private static func mapCandidates(bare: String, limit: Int) async -> [(name: String, detail: String)] {
        guard limit > 0, !bare.isEmpty else { return [] }
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = "\(bare)駅"
        request.resultTypes = [.pointOfInterest, .address]
        guard let response = try? await MKLocalSearch(request: request).start() else { return [] }

        var rows: [(name: String, detail: String)] = []
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
            // 入力と無関係な遠い駅名は落とす
            guard bareName.contains(bare) || bare.contains(bareName) || raw.contains(bare)
            else { continue }
            seen.insert(k)
            let locality = [
                item.placemark.locality,
                item.placemark.administrativeArea,
            ]
            .compactMap { $0 }
            .joined(separator: " · ")
            rows.append((raw.hasSuffix("駅") ? raw : "\(bareName)駅", locality.isEmpty ? "地図の候補" : locality))
            if rows.count >= limit { break }
        }
        return rows
    }
}
