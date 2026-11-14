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

    private static func isGroundsCorridor(_ corridor: AtmosphereCorridor) -> Bool {
        corridor.kind == "grounds"
            || corridor.name.contains("城跡")
            || corridor.name.contains("石垣")
            || corridor.name.contains("内堀")
            || corridor.name.contains("境内")
    }

    private static func isRiversideCorridor(_ corridor: AtmosphereCorridor) -> Bool {
        corridor.kind == "riverside"
            || corridor.name.contains("疏水")
            || corridor.name.contains("疎水")
            || corridor.name.contains("水路")
            || corridor.name.contains("川")
    }

    private static func nearGroundsBand(
        _ point: CLLocationCoordinate2D,
        corridors: [AtmosphereCorridor],
        meters limit: Double = 140
    ) -> Bool {
        for corridor in corridors where isGroundsCorridor(corridor) {
            if corridor.mapCoordinates.contains(where: { near(point, $0, meters: limit) }) {
                return true
            }
        }
        return false
    }

    /// 道なりが園内帯から大きく外れていないか（外周道路への逃走を検知）。
    private static func routeStaysNearGrounds(
        _ route: [CLLocationCoordinate2D],
        corridors: [AtmosphereCorridor],
        maxAwayMeters: Double = 95
    ) -> Bool {
        let samples = sample(route, everyMeters: 35)
        guard !samples.isEmpty else { return false }
        var hits = 0
        for p in samples {
            if nearGroundsBand(p, corridors: corridors, meters: maxAwayMeters) {
                hits += 1
            }
        }
        return Double(hits) / Double(samples.count) >= 0.55
    }

    /// 園内どうしの区間だけ。駅など園外からの直線は禁止（道なり MK に任せる）。
    static func groundsStrollWaypoints(
        from: CLLocationCoordinate2D,
        to: CLLocationCoordinate2D,
        corridors: [AtmosphereCorridor]
    ) -> [CLLocationCoordinate2D]? {
        guard nearGroundsBand(from, corridors: corridors),
              nearGroundsBand(to, corridors: corridors)
        else { return nil }
        var best: (path: [CLLocationCoordinate2D], score: Double)?
        for corridor in corridors where isGroundsCorridor(corridor) {
            let path = corridor.mapCoordinates
            guard path.count >= 2 else { continue }
            guard let iFrom = nearestIndex(of: from, in: path),
                  let iTo = nearestIndex(of: to, in: path)
            else { continue }
            var along = slicePath(path, from: iFrom, to: iTo)
            if along.first.map({ !near($0, from, meters: 12) }) == true {
                along.insert(from, at: 0)
            }
            if along.last.map({ !near($0, to, meters: 12) }) == true {
                along.append(to)
            }
            guard along.count >= 2 else { continue }
            let score = lengthMeters(along)
            if best == nil || score < best!.score {
                best = (along, score)
            }
        }
        return best?.path
    }

    private static func nearestIndex(
        of point: CLLocationCoordinate2D,
        in path: [CLLocationCoordinate2D]
    ) -> Int? {
        guard !path.isEmpty else { return nil }
        return path.indices.min(by: { meters(path[$0], point) < meters(path[$1], point) })
    }

    /// 園内一周 path 上で from→to。短い方（時計／反時計）を取る。
    private static func slicePath(
        _ path: [CLLocationCoordinate2D],
        from: Int,
        to: Int
    ) -> [CLLocationCoordinate2D] {
        guard from >= 0, to >= 0, from < path.count, to < path.count else { return [] }
        if from == to { return [path[from]] }
        var forward: [CLLocationCoordinate2D] = []
        var i = from
        while true {
            forward.append(path[i])
            if i == to { break }
            i = (i + 1) % path.count
            if forward.count > path.count + 1 { break }
        }
        var backward: [CLLocationCoordinate2D] = []
        i = from
        while true {
            backward.append(path[i])
            if i == to { break }
            i = (i - 1 + path.count) % path.count
            if backward.count > path.count + 1 { break }
        }
        return lengthMeters(forward) <= lengthMeters(backward) ? forward : backward
    }

    /// 全駅: 区間の mid が A→B のあいだにあれば、最短を避けて path 経由を挟む。
    /// デルタのように立ち寄りが近い場所で、複数コリドーの全点を挟むと網目になるので抑える。
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
            let ab = meters(p, next)
            // 園内 grounds は近い立ち寄り同士でも挟む（城跡↔神社）。他は 200m 超だけ。
            let hasGrounds = corridors.contains(where: isGroundsCorridor)
            guard ab > (hasGrounds ? 55 : 200) else { continue }

            var best: (path: [CLLocationCoordinate2D], mid: CLLocationCoordinate2D, score: Double)?
            for corridor in corridors {
                let path = corridor.mapCoordinates
                guard path.count >= 2 else { continue }
                let mid = path[path.count / 2]
                let grounds = isGroundsCorridor(corridor)
                let riverside = isRiversideCorridor(corridor)
                // コース上にすでにこの空気の中心があれば挟まない（デルタ立ち寄り＋川辺コリドーの二重）
                // 園内 grounds はピンが園内でも一周させたいので、この抑制を外す。
                if !grounds {
                    if points.contains(where: { near($0, mid, meters: 140) }) { continue }
                    if near(p, mid, meters: 120) { continue }
                    if path.contains(where: { near(p, $0, meters: 70) }) { continue }
                }
                // 川辺・疏水: 一端が帯の近くなら挟む。
                // 園内 grounds: 少なくとも「到着側」が園内（駅→城は入口経由を挟む）。
                // 出発だけ園外で到着も園外なら挟まない（街区を直線で切らない）。
                let startNear = path.contains(where: { near(p, $0, meters: 220) })
                let endNear = path.contains(where: { near(next, $0, meters: 260) })
                if riverside, startNear || endNear {
                    let score = meters(p, mid) + meters(mid, next)
                    if best == nil || score < best!.score {
                        best = (path, mid, score)
                    }
                    continue
                }
                if grounds, endNear {
                    let score = meters(p, mid) + meters(mid, next)
                    if best == nil || score < best!.score {
                        best = (path, mid, score - 80)
                    }
                    continue
                }
                guard midLiesBetween(p, next, mid: mid) else { continue }
                let score = meters(p, mid) + meters(mid, next)
                if best == nil || score < best!.score {
                    best = (path, mid, score)
                }
            }
            guard let pick = best else { continue }
            // 園内 grounds は全点を挟む（外周道路を避ける）。短い川辺は mid 1点。
            let pathSpan = meters(pick.path.first!, pick.path.last!)
            let groundsPick = corridors.contains {
                isGroundsCorridor($0) && !$0.mapCoordinates.isEmpty
                    && near($0.mapCoordinates[$0.mapCoordinates.count / 2], pick.mid, meters: 30)
            }
            let vias: [CLLocationCoordinate2D] = {
                if groundsPick { return pick.path }
                if pick.path.count <= 3 && pathSpan < 200 { return [pick.mid] }
                return pick.path
            }()
            for via in vias {
                if near(via, next, meters: 40) { continue }
                if let last = out.last, near(last, via, meters: 40) { continue }
                out.append(via)
            }
        }
        return out
    }

    /// 近い経由が続くと道なりが網目になる。中間点だけ間引く（始終は残す）。
    static func collapseNearbyWaypoints(
        _ points: [CLLocationCoordinate2D],
        meters threshold: Double = 85
    ) -> [CLLocationCoordinate2D] {
        guard points.count >= 3 else { return points }
        var out: [CLLocationCoordinate2D] = [points[0]]
        let end = points[points.count - 1]
        for index in 1 ..< (points.count - 1) {
            let p = points[index]
            if let last = out.last, near(p, last, meters: threshold) { continue }
            if near(p, end, meters: threshold) { continue }
            out.append(p)
        }
        out.append(end)
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
        points = collapseNearbyWaypoints(points)
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

            // 園内どうし: まず道なり。外周に逃げたら園内ウェイポイントを道なりで細かく結ぶ。
            // 駅→園はここに入らない（nearGroundsBand が駅で false → 下の MKDirections）。
            if nearGroundsBand(a, corridors: preferredCorridors),
               nearGroundsBand(b, corridors: preferredCorridors) {
                if let mk = await walkingSegment(from: a, to: b, preferAlternates: true),
                   mk.count >= 2,
                   routeStaysNearGrounds(mk, corridors: preferredCorridors) {
                    appendConnected(mk)
                    if !isReturnLeg {
                        outboundSamples.append(contentsOf: sample(mk, everyMeters: 40))
                    }
                    continue
                }
                if let waypoints = groundsStrollWaypoints(from: a, to: b, corridors: preferredCorridors),
                   waypoints.count >= 2 {
                    var chain: [CLLocationCoordinate2D] = []
                    for j in 0..<(waypoints.count - 1) {
                        let wa = waypoints[j]
                        let wb = waypoints[j + 1]
                        if let micro = await walkingSegment(from: wa, to: wb, preferAlternates: true),
                           micro.count >= 2,
                           routeStaysNearGrounds(micro, corridors: preferredCorridors)
                            || lengthMeters(micro) < 90 {
                            if chain.isEmpty {
                                chain = micro
                            } else {
                                chain.append(contentsOf: micro.dropFirst())
                            }
                        } else if near(wa, wb, meters: 85) {
                            if chain.isEmpty {
                                chain = [wa, wb]
                            } else {
                                chain.append(wb)
                            }
                        }
                    }
                    if chain.count >= 2 {
                        appendConnected(chain)
                        if !isReturnLeg {
                            outboundSamples.append(contentsOf: sample(chain, everyMeters: 40))
                        }
                        continue
                    }
                }
            }

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
            } else if near(a, b, meters: 35) {
                // 同一広場の数メートルだけ直線可。川・橋を跨ぐ直線は禁止。
                appendConnected([a, b])
                if !isReturnLeg {
                    outboundSamples.append(contentsOf: [a, b])
                }
            } else {
                // 道なりが取れないときは直線で川を切らず、ここで線を切る。
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

    private static func meters(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        CLLocation(latitude: a.latitude, longitude: a.longitude)
            .distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude))
    }

    private static func near(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D, meters: Double) -> Bool {
        self.meters(a, b) <= meters
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
