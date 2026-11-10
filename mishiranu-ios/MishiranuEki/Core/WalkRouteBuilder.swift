import Foundation
import MapKit

/// 駅→立ち寄りを、徒歩の道なり（MKDirections）で結ぶ。
/// 直線だと川の上を横切るので使わない。
enum WalkRouteBuilder {
    /// 連続する地点を徒歩ルートで結び、道の座標列を返す。
    static func walkingPath(through points: [CLLocationCoordinate2D]) async -> [CLLocationCoordinate2D] {
        guard points.count >= 2 else { return points }
        var path: [CLLocationCoordinate2D] = []
        for i in 0..<(points.count - 1) {
            let a = points[i]
            let b = points[i + 1]
            if let segment = await walkingSegment(from: a, to: b), segment.count >= 2 {
                if path.isEmpty {
                    path.append(contentsOf: segment)
                } else {
                    // 接続点の重複を落とす
                    path.append(contentsOf: segment.dropFirst())
                }
            } else {
                // ルートが取れない区間だけ直線（川越えは稀に失敗する）
                if path.isEmpty { path.append(a) }
                path.append(b)
            }
        }
        return path
    }

    private static func walkingSegment(
        from: CLLocationCoordinate2D,
        to: CLLocationCoordinate2D
    ) async -> [CLLocationCoordinate2D]? {
        let request = MKDirections.Request()
        request.source = MKMapItem(placemark: MKPlacemark(coordinate: from))
        request.destination = MKMapItem(placemark: MKPlacemark(coordinate: to))
        request.transportType = .walking
        request.requestsAlternateRoutes = false
        do {
            let response = try await MKDirections(request: request).calculate()
            guard let route = response.routes.first else { return nil }
            return coordinates(of: route.polyline)
        } catch {
            return nil
        }
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
