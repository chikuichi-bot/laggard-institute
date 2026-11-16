#!/usr/bin/env swift
// 見知らぬ駅: 全スポットを Apple マップ検索（MKLocalSearch）で照合し、
// mishiranu-app/data/mishiranu-coordinates.json の座標を Apple の地図と揃える。
//
//   swift mishiranu-ios/scripts/applemaps-geocode.swift            # 照合して書き込み
//   swift mishiranu-ios/scripts/applemaps-geocode.swift --dry-run  # レポートのみ
//
// 照合できないもの（川端・ホーム端など POI の無い場所）は既存座標を残し、レポートに出す。
// 確認済みで上書きしたくないものは "locked": true を付ける。
import Foundation
import MapKit

setvbuf(stdout, nil, _IOLBF, 0)
let args = CommandLine.arguments
let dryRun = args.contains("--dry-run")
let only = args.first { $0.hasPrefix("--station=") }.map { String($0.dropFirst("--station=".count)) }
let onlySpots = args.first { $0.hasPrefix("--spots=") }
    .map { Set($0.dropFirst("--spots=".count).split(separator: ",").map(String.init)) }

let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
let coordsURL = root.appendingPathComponent("mishiranu-app/data/mishiranu-coordinates.json")
let stationsURL = root.appendingPathComponent("mishiranu-ios/MishiranuEki/Resources/stations.json")
let reportURL = root.appendingPathComponent("mishiranu-app/data/mishiranu-coordinates-report.json")

struct SpotIn: Decodable { let id: String; let name: String; let walkMinutes: Int; let lat: Double; let lng: Double }
struct StationIn: Decodable { let id: String; let name: String; let prefecture: String; let lat: Double; let lng: Double; let spots: [SpotIn] }
struct FileIn: Decodable { let stations: [StationIn] }

let anchorsURL = root.appendingPathComponent("mishiranu-app/data/mishiranu-geo-anchors.json")
let anchors = ((try? JSONSerialization.jsonObject(with: Data(contentsOf: anchorsURL))) as? [String: Any])?["anchors"] as? [String: String] ?? [:]
let stations = try JSONDecoder().decode(FileIn.self, from: Data(contentsOf: stationsURL)).stations
var coords = try JSONSerialization.jsonObject(with: Data(contentsOf: coordsURL)) as! [String: Any]
var spotCoords = coords["spots"] as! [String: [String: Any]]

func normalize(_ s: String) -> String {
    var t = s.precomposedStringWithCompatibilityMapping.lowercased()
    for (from, to) in [("桝", "枡"), ("餘", "余"), ("ヶ", "ケ"), ("ヵ", "カ"), ("京都", "")] {
        t = t.replacingOccurrences(of: from, with: to)
    }
    t = t.replacingOccurrences(of: "[（(].*?[）)]", with: "", options: .regularExpression)
    t = t.replacingOccurrences(of: "(本店|本舗|店|駅前|駅|跡地|跡)$", with: "", options: .regularExpression)
    t = t.replacingOccurrences(of: "[\\s　・･/／「」『』\\-ー〜~、,.。]", with: "", options: .regularExpression)
    return t
}

/// 0–100。完全一致 100、包含 85、それ以外は最長共通部分の割合。
func nameScore(_ a: String, _ b: String) -> Double {
    let x = normalize(a), y = normalize(b)
    if x.isEmpty || y.isEmpty { return 0 }
    if x == y { return 100 }
    if x.contains(y) || y.contains(x) {
        let ratio = Double(min(x.count, y.count)) / Double(max(x.count, y.count))
        return 70 + 25 * ratio
    }
    let xs = Array(x)
    var best = 0
    for i in 0..<xs.count {
        var j = i + 2
        while j <= xs.count {
            if y.contains(String(xs[i..<j])) { best = max(best, j - i) }
            j += 1
        }
    }
    return 65 * Double(best) / Double(max(xs.count, y.count))
}

func km(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
    CLLocation(latitude: a.latitude, longitude: a.longitude)
        .distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude)) / 1000
}

/// MKLocalSearch は 1 分あたりの回数に上限がある。間隔を空け、throttle なら待って再試行。
func search(_ query: String, center: CLLocationCoordinate2D, meters: Double) -> [MKMapItem] {
    for attempt in 0..<6 {
        let req = MKLocalSearch.Request()
        req.naturalLanguageQuery = query
        req.region = MKCoordinateRegion(center: center, latitudinalMeters: meters, longitudinalMeters: meters)
        req.resultTypes = [.pointOfInterest, .address]
        var out: [MKMapItem] = []
        var failure: Error?
        let done = DispatchSemaphore(value: 0)
        MKLocalSearch(request: req).start { res, err in
            out = res?.mapItems ?? []
            failure = err
            done.signal()
        }
        while done.wait(timeout: .now()) == .timedOut {
            RunLoop.current.run(until: Date().addingTimeInterval(0.05))
        }
        Thread.sleep(forTimeInterval: 1.4)
        // 混雑時はエラーなしで空が返ることがあるので、空なら一度だけ間を置いて引き直す。
        if failure == nil, out.isEmpty, attempt == 0 {
            Thread.sleep(forTimeInterval: 4)
            continue
        }
        guard let failure else { return out }
        let code = (failure as NSError).code
        if code == MKError.placemarkNotFound.rawValue { return [] }
        let wait = 20.0 * Double(attempt + 1)
        FileHandle.standardError.write("    … 検索を待機 \(Int(wait))s（\(query) · code \(code)）\n".data(using: .utf8)!)
        Thread.sleep(forTimeInterval: wait)
    }
    return []
}

/// 「進々堂 百万遍店」の「百万遍店」。支店名が違う候補は別の店として捨てる。
func branchToken(_ s: String) -> String? {
    let n = s.precomposedStringWithCompatibilityMapping
    guard let r = n.range(of: "[^\\s　]{1,8}店$", options: .regularExpression) else { return nil }
    let token = String(n[r])
    return token == "本店" ? nil : token
}

func isWrongBranch(spot: String, candidate: String) -> Bool {
    guard let want = branchToken(spot) else { return false }
    let c = candidate.precomposedStringWithCompatibilityMapping
    if c.contains(want) { return false }
    return c.range(of: "店", options: .backwards) != nil
}

func isStationOnly(spot: String, candidate: String) -> Bool {
    let c = normalize(candidate)
    guard candidate.hasSuffix("駅") || c.hasSuffix("駅") else { return false }
    return !(spot.contains("駅") || spot.contains("ホーム") || spot.contains("ケーブル") || spot.contains("ロープウェ"))
}

/// 「出町ふたばの豆餅（土産）」→「出町ふたば」のように、検索語の候補を作る。
func queries(for name: String) -> [String] {
    var list = [name]
    let noParen = name.replacingOccurrences(of: "[（(].*?[）)]", with: "", options: .regularExpression)
        .trimmingCharacters(in: .whitespaces)
    if noParen != name { list.append(noParen) }
    if let r = noParen.range(of: "の") {
        let head = String(noParen[..<r.lowerBound])
        if head.count >= 2 { list.append(head) }
    }
    for sep in ["・", "（", " "] {
        if let r = noParen.range(of: sep) {
            let head = String(noParen[..<r.lowerBound])
            if head.count >= 2 { list.append(head) }
        }
    }
    var seen = Set<String>()
    return list.filter { seen.insert($0).inserted }
}

struct Row: Encodable {
    let stationId: String, station: String, spotId: String, spot: String
    let status: String
    let matched: String?
    let score: Double?
    let movedMeters: Int?
    let distanceFromStationKm: Double?
}

var rows: [Row] = []
var updated = 0

for station in stations where only == nil || station.id == only {
    var center = CLLocationCoordinate2D(latitude: station.lat, longitude: station.lng)
    var stationCoords = coords["stations"] as! [String: [String: Any]]
    if (stationCoords[station.id]?["locked"] as? Bool) != true {
        let want = "\(station.name)駅"
        let hit = search(want, center: center, meters: 6000)
            .compactMap { item -> (CLLocationCoordinate2D, Double, String)? in
                guard let name = item.name, item.pointOfInterestCategory == .publicTransport || name.hasSuffix("駅") else { return nil }
                let s = nameScore(want, name)
                return s >= 85 ? (item.location.coordinate, s - km(center, item.location.coordinate) * 10, name) : nil
            }
            .max { $0.1 < $1.1 }
        if let (c, _, name) = hit {
            let moved = Int((km(center, c) * 1000).rounded())
            center = c
            stationCoords[station.id] = [
                "lat": (c.latitude * 1e6).rounded() / 1e6, "lng": (c.longitude * 1e6).rounded() / 1e6,
                "source": "apple-maps", "name": name,
            ]
            coords["stations"] = stationCoords
            print("■ \(station.name) → \(name)（駅 \(moved)m 補正）")
        } else {
            print("■ \(station.name)（駅は既存座標のまま）")
        }
    }
    var stationAnchorCount = 0
    for spot in station.spots {
        if let onlySpots, !onlySpots.contains(spot.id) { continue }
        let entry = spotCoords[spot.id] ?? [:]
        if (entry["locked"] as? Bool) == true {
            rows.append(Row(stationId: station.id, station: station.name, spotId: spot.id, spot: spot.name, status: "locked", matched: nil, score: nil, movedMeters: nil, distanceFromStationKm: nil))
            print("  🔒 \(spot.name)")
            continue
        }
        let anchor = anchors[spot.id]
        if anchor == "@station" {
            // 駅そのものの場所。駅ピンと重ならないよう、駅のまわり 35m の輪に少しずつ散らす。
            let angle = Double(stationAnchorCount) * 2.4 + 0.6
            stationAnchorCount += 1
            let r = 35.0 / 111_000
            let lat = center.latitude + r * sin(angle)
            let lng = center.longitude + r * cos(angle) / cos(center.latitude * .pi / 180)
            spotCoords[spot.id] = [
                "lat": (lat * 1e6).rounded() / 1e6, "lng": (lng * 1e6).rounded() / 1e6,
                "source": "station-anchor", "name": "\(station.name)駅",
            ]
            updated += 1
            rows.append(Row(stationId: station.id, station: station.name, spotId: spot.id, spot: spot.name, status: "station", matched: "\(station.name)駅", score: nil, movedMeters: nil, distanceFromStationKm: 0.04))
            print("  ◎ \(spot.name) → 駅")
            continue
        }
        let maxKm = anchor != nil ? 8 : max(1.2, Double(spot.walkMinutes) / 60 * 4.8 * 1.6)
        let want = anchor ?? spot.name
        var best: (item: MKMapItem, score: Double, km: Double, query: String)?
        for q in anchor.map({ [$0] }) ?? queries(for: spot.name) {
            for item in search(q, center: center, meters: maxKm * 2400) {
                guard let name = item.name else { continue }
                let c = item.location.coordinate
                let d = km(center, c)
                guard d <= maxKm else { continue }
                if isWrongBranch(spot: want, candidate: name) { continue }
                if isStationOnly(spot: want, candidate: name) { continue }
                var s = anchor != nil ? nameScore(want, name) : max(nameScore(spot.name, name), nameScore(q, name) - 4)
                // 目印の表は手で確かめた検索語なので、Apple の先頭候補は別名表記でも採る。
                if anchor != nil, best == nil, s >= 30, s < 72 { s = 72 }
                let ranked = s - d * 2
                if best == nil || ranked > best!.score - best!.km * 2 {
                    best = (item, s, d, q)
                }
            }
            if let b = best, b.score >= 85 { break }
        }
        let old = CLLocationCoordinate2D(latitude: spot.lat, longitude: spot.lng)
        if let b = best, b.score >= 72 {
            let c = b.item.location.coordinate
            let moved = Int((km(old, c) * 1000).rounded())
            spotCoords[spot.id] = [
                "lat": (c.latitude * 1e6).rounded() / 1e6,
                "lng": (c.longitude * 1e6).rounded() / 1e6,
                "source": "apple-maps",
                "name": b.item.name ?? spot.name,
                "query": b.query,
            ]
            updated += 1
            rows.append(Row(stationId: station.id, station: station.name, spotId: spot.id, spot: spot.name, status: "matched", matched: b.item.name, score: b.score, movedMeters: moved, distanceFromStationKm: (b.km * 100).rounded() / 100))
            print("  ✓ \(spot.name) → \(b.item.name ?? "") (\(Int(b.score))点, \(moved)m移動)")
        } else {
            var stale = spotCoords[spot.id] ?? ["lat": spot.lat, "lng": spot.lng]
            stale["unverified"] = true
            spotCoords[spot.id] = stale
            rows.append(Row(stationId: station.id, station: station.name, spotId: spot.id, spot: spot.name, status: "unmatched", matched: best?.item.name, score: best?.score, movedMeters: nil, distanceFromStationKm: best.map { ($0.km * 100).rounded() / 100 }))
            print("  ✗ \(spot.name)\(best.map { " （候補: \($0.item.name ?? "") \(Int($0.score))点）" } ?? "")")
        }
    }
}

let enc = JSONEncoder()
enc.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
try enc.encode(rows).write(to: reportURL)

if !dryRun {
    coords["spots"] = spotCoords
    coords["updatedAt"] = ISO8601DateFormatter().string(from: Date())
    let data = try JSONSerialization.data(withJSONObject: coords, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes])
    try (String(data: data, encoding: .utf8)! + "\n").write(to: coordsURL, atomically: true, encoding: .utf8)
}
let unmatched = rows.filter { $0.status == "unmatched" }.count
print("\n照合 \(updated) / 未照合 \(unmatched) / 合計 \(rows.count)\(dryRun ? "（dry-run）" : "")")
