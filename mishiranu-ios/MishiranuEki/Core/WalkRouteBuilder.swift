import Foundation
import MapKit

/// 駅→立ち寄り→駅を、徒歩の道なり（MKDirections）で結ぶ。
/// 直線だと川の上を横切るので使わない。
/// 帰りは往路と同じ道をなるべく避ける。
///
/// 思想: 最短より、土地らしい無駄な寄り道（例: 同志社へは相国寺の中を通る）。
enum WalkRouteBuilder {
    /// 出町→同志社: 相国寺境内を東から西へ通る経由（南の最短回りを避ける。無駄OK）。
    private static let demachiShokokujiTraverse: [CLLocationCoordinate2D] = [
        CLLocationCoordinate2D(latitude: 35.03305, longitude: 135.76420),
        LandmarkRegistry.demachiShokokuji,
        CLLocationCoordinate2D(latitude: 35.03255, longitude: 135.76135),
    ]

    /// 同志社ピンへ向かう直前に、相国寺境内の経由を挟む。
    static func expandDemachiPreferredVias(
        _ points: [CLLocationCoordinate2D]
    ) -> [CLLocationCoordinate2D] {
        guard points.count >= 2 else { return points }
        var out: [CLLocationCoordinate2D] = []
        for i in 0..<points.count {
            let p = points[i]
            out.append(p)
            guard i + 1 < points.count else { continue }
            let next = points[i + 1]
            let towardDoshisha = near(next, LandmarkRegistry.demachiDoshisha, meters: 140)
            let alreadyInTemple = near(p, LandmarkRegistry.demachiShokokuji, meters: 220)
                || demachiShokokujiTraverse.contains(where: { near(p, $0, meters: 80) })
            // 東側・川側から同志社へ向かうときだけ境内を挟む（帰りや西からの接近は触らない）
            if towardDoshisha, !alreadyInTemple, p.longitude > 135.762 {
                for via in demachiShokokujiTraverse {
                    if let last = out.last, near(last, via, meters: 60) { continue }
                    out.append(via)
                }
            }
        }
        return out
    }

    /// 全駅: 区間の mid が A→B のあいだにあれば、最短を避けて path 経由を挟む。
    static func expandPreferredCorridorVias(
        _ points: [CLLocationCoordinate2D],
        corridors: [AtmosphereCorridor]
    ) -> [CLLocationCoordinate2D] {
        guard points.count >= 2, !corridors.isEmpty else { return points }
        var out: [CLLocationCoordinate2D] = []
        for i in 0..<points.count {
            let p = points[i]
            out.append(p)
            guard i + 1 < points.count else { continue }
            let next = points[i + 1]
            for corridor in corridors {
                let path = corridor.mapCoordinates
                guard path.count >= 2 else { continue }
                let mid = path[path.count / 2]
                // すでに区間内にいる／経由済みなら触らない
                if near(p, mid, meters: 120) { continue }
                if path.contains(where: { near(p, $0, meters: 70) }) { continue }
                guard midLiesBetween(p, next, mid: mid) else { continue }
                for via in path {
                    if near(via, next, meters: 55) { continue }
                    if let last = out.last, near(last, via, meters: 55) { continue }
                    out.append(via)
                }
            }
        }
        return out
    }

    private static func midLiesBetween(
        _ a: CLLocationCoordinate2D,
        _ b: CLLocationCoordinate2D,
        mid: CLLocationCoordinate2D
    ) -> Bool {
        let ab = CLLocation(latitude: a.latitude, longitude: a.longitude)
            .distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude))
        guard ab > 90 else { return false }
        let am = CLLocation(latitude: a.latitude, longitude: a.longitude)
            .distance(from: CLLocation(latitude: mid.latitude, longitude: mid.longitude))
        let mb = CLLocation(latitude: mid.latitude, longitude: mid.longitude)
            .distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude))
        guard am > 45, mb > 45 else { return false }
        // 寄り道は少し長くてよい（無駄OK）。極端な遠回りだけ却下。
        return am + mb < ab * 1.85
    }

    /// 連続する道なりの断片。意図してつながらない区間だけ別配列にする。
    /// 道なりの頂点が 160m 離れていても、同じ断片なら一本の線として描く。
    static func walkingLegs(
        through points: [CLLocationCoordinate2D],
        preferredCorridors: [AtmosphereCorridor] = []
    ) async -> [[CLLocationCoordinate2D]] {
        var points = expandPreferredCorridorVias(points, corridors: preferredCorridors)
        points = expandDemachiPreferredVias(points)
        guard points.count >= 2 else { return points.isEmpty ? [] : [points] }
        var legs: [[CLLocationCoordinate2D]] = []
        var current: [CLLocationCoordinate2D] = []
        var outboundSamples: [CLLocationCoordinate2D] = []

        func flush() {
            if current.count >= 2 { legs.append(current) }
            current = []
        }

        func appendConnected(_ segment: [CLLocationCoordinate2D]) {
            guard segment.count >= 2 else { return }
            if current.isEmpty {
                current = segment
            } else if let last = current.last, let first = segment.first, near(last, first, meters: 160) {
                current.append(contentsOf: segment.dropFirst())
            } else {
                flush()
                current = segment
            }
        }

        for i in 0..<(points.count - 1) {
            let a = points[i]
            let b = points[i + 1]
            let isReturnLeg = i == points.count - 2 && points.count >= 3
                && roughlySame(points[0], points[points.count - 1])

            let segment: [CLLocationCoordinate2D]?
            if isReturnLeg {
                segment = await returnSegmentAvoiding(from: a, to: b, outbound: outboundSamples)
            } else {
                segment = await walkingSegment(from: a, to: b, preferAlternates: false)
            }

            if var segment, segment.count >= 2 {
                if let first = segment.first, !near(first, a, meters: 18), near(first, a, meters: 45) {
                    segment.insert(a, at: 0)
                }
                if let last = segment.last, !near(last, b, meters: 18), near(last, b, meters: 45) {
                    segment.append(b)
                }
                appendConnected(segment)
                if !isReturnLeg {
                    outboundSamples.append(contentsOf: sample(segment, everyMeters: 40))
                }
            } else if near(a, b, meters: 90) {
                appendConnected([a, b])
                if !isReturnLeg {
                    outboundSamples.append(contentsOf: [a, b])
                }
            } else {
                // 道なりが取れず、山を直線で結ばない。ここで線を切る。
                flush()
            }
        }
        flush()
        return legs
    }

    /// 表示用に平坦化した道なり。切れ目の情報は `walkingLegs` を使う。
    static func walkingPath(
        through points: [CLLocationCoordinate2D],
        preferredCorridors: [AtmosphereCorridor] = []
    ) async -> [CLLocationCoordinate2D] {
        await walkingLegs(through: points, preferredCorridors: preferredCorridors).flatMap { $0 }
    }

    private static func roughlySame(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Bool {
        abs(a.latitude - b.latitude) < 0.00015 && abs(a.longitude - b.longitude) < 0.00015
    }

    private static func returnSegmentAvoiding(
        from: CLLocationCoordinate2D,
        to: CLLocationCoordinate2D,
        outbound: [CLLocationCoordinate2D]
    ) async -> [CLLocationCoordinate2D]? {
        let routes = await walkingRouteCandidates(from: from, to: to, alternates: true)
        guard !routes.isEmpty else {
            return await walkingSegment(from: from, to: to, preferAlternates: false)
        }
        let primary = routes[0]
        let primaryLength = lengthMeters(primary)
        if outbound.isEmpty { return primary }
        let ranked = routes.map { route -> (overlap: Double, length: Double, route: [CLLocationCoordinate2D]) in
            let samples = sample(route, everyMeters: 40)
            var hits = 0
            for point in samples {
                if outbound.contains(where: { near($0, point, meters: 55) }) {
                    hits += 1
                }
            }
            let overlap = samples.isEmpty ? 1.0 : Double(hits) / Double(samples.count)
            return (overlap, lengthMeters(route), route)
        }
        // 谷に道が一本のとき、山側の別経路は採らない。十分に別れて、長くなりすぎない道だけ。
        let different = ranked
            .filter { $0.overlap < 0.45 && $0.length <= primaryLength * 1.35 }
            .sorted { $0.overlap < $1.overlap }
        return different.first?.route ?? primary
    }

    private static func walkingSegment(
        from: CLLocationCoordinate2D,
        to: CLLocationCoordinate2D,
        preferAlternates: Bool
    ) async -> [CLLocationCoordinate2D]? {
        let routes = await walkingRouteCandidates(from: from, to: to, alternates: preferAlternates)
        return routes.first
    }

    private static func walkingRouteCandidates(
        from: CLLocationCoordinate2D,
        to: CLLocationCoordinate2D,
        alternates: Bool = true
    ) async -> [[CLLocationCoordinate2D]] {
        let request = MKDirections.Request()
        request.source = MKMapItem(placemark: MKPlacemark(coordinate: from))
        request.destination = MKMapItem(placemark: MKPlacemark(coordinate: to))
        request.transportType = .walking
        request.requestsAlternateRoutes = alternates
        do {
            let response = try await MKDirections(request: request).calculate()
            return response.routes.map { coordinates(of: $0.polyline) }.filter { $0.count >= 2 }
        } catch {
            return []
        }
    }

    private static func lengthMeters(_ coords: [CLLocationCoordinate2D]) -> Double {
        guard coords.count >= 2 else { return 0 }
        var sum = 0.0
        for index in 1..<coords.count {
            let previous = coords[index - 1]
            let current = coords[index]
            sum += CLLocation(latitude: previous.latitude, longitude: previous.longitude)
                .distance(from: CLLocation(latitude: current.latitude, longitude: current.longitude))
        }
        return sum
    }

    private static func sample(
        _ coords: [CLLocationCoordinate2D],
        everyMeters: Double
    ) -> [CLLocationCoordinate2D] {
        guard let first = coords.first else { return [] }
        var out = [first]
        var acc = 0.0
        for i in 1..<coords.count {
            let prev = coords[i - 1]
            let cur = coords[i]
            let d = CLLocation(latitude: prev.latitude, longitude: prev.longitude)
                .distance(from: CLLocation(latitude: cur.latitude, longitude: cur.longitude))
            acc += d
            if acc >= everyMeters {
                out.append(cur)
                acc = 0
            }
        }
        if let last = coords.last, let oLast = out.last, !near(oLast, last, meters: 1) {
            out.append(last)
        }
        return out
    }

    private static func near(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D, meters: Double) -> Bool {
        CLLocation(latitude: a.latitude, longitude: a.longitude)
            .distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude)) <= meters
    }

    private static func coordinates(of polyline: MKPolyline) -> [CLLocationCoordinate2D] {
        var coords = Array(
            repeating: CLLocationCoordinate2D(latitude: 0, longitude: 0),
            count: polyline.pointCount
        )
        polyline.getCoordinates(&coords, range: NSRange(location: 0, length: polyline.pointCount))
        return coords
    }
}
