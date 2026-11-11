import Foundation
import MapKit

/// 駅→立ち寄り→駅を、徒歩の道なり（MKDirections）で結ぶ。
/// 直線だと川の上を横切るので使わない。
/// 帰りは往路と同じ道をなるべく避ける。
enum WalkRouteBuilder {
    /// 連続する地点を徒歩ルートで結び、道の座標列を返す。
    /// `points` の先頭と末尾が駅（同じ座標）の周回を想定。
    static func walkingPath(through points: [CLLocationCoordinate2D]) async -> [CLLocationCoordinate2D] {
        guard points.count >= 2 else { return points }
        var path: [CLLocationCoordinate2D] = []
        var outboundSamples: [CLLocationCoordinate2D] = []

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

            if let segment, segment.count >= 2 {
                if path.isEmpty {
                    path.append(contentsOf: segment)
                } else {
                    path.append(contentsOf: segment.dropFirst())
                }
                if !isReturnLeg {
                    outboundSamples.append(contentsOf: sample(segment, everyMeters: 40))
                }
            } else {
                if path.isEmpty { path.append(a) }
                path.append(b)
                if !isReturnLeg {
                    outboundSamples.append(contentsOf: [a, b])
                }
            }
        }
        return path
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
        if outbound.isEmpty {
            return routes[0]
        }
        let ranked = routes.map { route -> (score: Double, route: [CLLocationCoordinate2D]) in
            let samples = sample(route, everyMeters: 40)
            var hits = 0
            for p in samples {
                if outbound.contains(where: { near($0, p, meters: 55) }) {
                    hits += 1
                }
            }
            let overlap = samples.isEmpty ? 1.0 : Double(hits) / Double(samples.count)
            return (overlap, route)
        }
        .sorted { $0.score < $1.score }
        return ranked.first?.route
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
