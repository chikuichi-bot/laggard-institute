import MapKit
import SwiftUI

/// 現在地専用色（地図の緑・ベージュと被らない青）
private let hereBlue = Color(hex: 0x1E7AFE)
private let hereBlueDeep = Color(hex: 0x0B5ED7)

struct TourMapPage: View {
    @Environment(AppModel.self) private var model
    let station: Station
    @State private var position: MapCameraPosition = .automatic
    /// 徒歩の道なり。意図して途切れた区間だけ別配列。頂点が離れていても同じ断片は一本。
    @State private var walkingLegs: [[CLLocationCoordinate2D]] = []
    @State private var routeTaskId: String = ""
    /// MapPolyline が初回描画されない癖への再マウント用
    @State private var pathRenderEpoch = 0
    @State private var focusingHere = false
    @State private var focusGeneration = 0
    @State private var locator = LocationService()

    private var stationCoordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: station.lat, longitude: station.lng)
    }

    /// 立ち寄り順の経由点（駅→1→2…→駅）。道なり化前の点列。終点も駅。
    private var waypointCoordinates: [CLLocationCoordinate2D] {
        guard let course = model.selectedCourse, !course.stops.isEmpty else { return [] }
        let mid = course.stops.map {
            let pin = model.resolvedSpot($0.spot)
            return CLLocationCoordinate2D(latitude: pin.lat, longitude: pin.lng)
        }
        let near = mid.filter { isNearStation($0.latitude, $0.longitude) }
        guard near.count >= 1 else { return [] }
        return [stationCoordinate] + near + [stationCoordinate]
    }

    private var routeKey: String {
        guard let course = model.selectedCourse else { return "" }
        let ids = course.stops.map(\.spot.id).joined(separator: ",")
        return "\(station.id)|\(course.id)|\(ids)"
    }

    /// 徒歩コースと同じ上限（3.2km）。二ノ瀬から出町柳は約7.5kmなので、8kmだと吸い寄せられる。
    private var maxPinKm: Double { DemachiTemplate.firstVisitMaxKm }

    private func isNearStation(_ lat: Double, _ lng: Double) -> Bool {
        if !DemachiTemplate.isDemachiStationName(station.name),
           DemachiTemplate.isOnDemachiPin(lat: lat, lng: lng) {
            return false
        }
        return Geo.haversineKm(
            lat1: station.lat, lng1: station.lng,
            lat2: lat, lng2: lng
        ) <= maxPinKm
    }

    private func belongsOnThisMap(_ spot: Spot) -> Bool {
        !DemachiTemplate.isForeignDemachiPlace(spot.name, stationName: station.name)
            && isNearStation(spot.lat, spot.lng)
    }

    /// 地図に出すピン。コースの立ち寄り、信頼ピンに加え、案内の店も出す。駅から遠すぎる点は捨てる。
    private var mapSpots: [Spot] {
        let shops = model.guideShopSpots.map(model.resolvedSpot).filter(belongsOnThisMap)
        let trusted = model.tourSpots.map(model.resolvedSpot).filter(belongsOnThisMap)
        if let course = model.selectedCourse, !course.stops.isEmpty {
            let coursePins = course.stops.map { model.resolvedSpot($0.spot) }.filter(belongsOnThisMap)
            let extras = (trusted + shops).filter { extra in
                !coursePins.contains { sameMapPin($0, extra) }
            }
            return coursePins + deduped(extras)
        }
        return deduped(trusted + shops)
    }

    private func sameMapPin(_ a: Spot, _ b: Spot) -> Bool {
        a.id == b.id || NameMatch.score(a.name, b.name) >= 85
    }

    private func deduped(_ spots: [Spot]) -> [Spot] {
        var kept: [Spot] = []
        for spot in spots where !kept.contains(where: { sameMapPin($0, spot) }) {
            kept.append(spot)
        }
        return kept
    }

    /// ピン表示用座標。線の経由点は実座標のまま。コース番号同士が近いときだけ表示を少し扇状に広げる。
    private var displayCoordinates: [String: CLLocationCoordinate2D] {
        var coords = Dictionary(uniqueKeysWithValues: mapSpots.map {
            ($0.id, CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lng))
        })
        guard let course = model.selectedCourse, course.stops.count >= 2 else { return coords }
        let resolved = course.stops.map { model.resolvedSpot($0.spot) }
        let order = resolved.map(\.id)
        // ロック座標（鴨川デルタ等）は動かさない。重なりはそれ以外をずらす。
        let anchored = Set(
            resolved
                .filter { $0.coordTrust == .lock || Self.isFixedLandmarkName($0.name) }
                .map(\.id)
        )
        coords = Self.spreadNearbyCoursePins(
            order: order,
            coordinates: coords,
            anchoredIds: anchored
        )
        return coords
    }

    private static func isFixedLandmarkName(_ name: String) -> Bool {
        name.contains("デルタ") || name.contains("三角州") || name.contains("下鴨神社")
            || name.contains("賀茂御祖")
    }

    /// 約40m以内の重なりを解消。`anchoredIds`（デルタ等の正本）は動かさず、相手側をずらす。
    private static func spreadNearbyCoursePins(
        order: [String],
        coordinates: [String: CLLocationCoordinate2D],
        anchoredIds: Set<String>
    ) -> [String: CLLocationCoordinate2D] {
        var result = coordinates
        let thresholdMeters = 40.0
        let stepMeters = 24.0

        func clashes(_ id: String, _ coord: CLLocationCoordinate2D) -> String? {
            for otherId in order where otherId != id {
                guard let other = result[otherId] else { continue }
                if metersBetween(coord, other) < thresholdMeters { return otherId }
            }
            return nil
        }

        // 1) 正本ピンは実座標のまま確定
        for id in order where anchoredIds.contains(id) {
            if let c = coordinates[id] { result[id] = c }
        }

        // 2) 正本以外だけずらす（正本と重なっても正本は動かない）
        for (index, id) in order.enumerated() where !anchoredIds.contains(id) {
            guard var coord = result[id] else { continue }
            let origin = coordinates[id] ?? coord
            for attempt in 0 ..< 10 {
                if clashes(id, coord) == nil { break }
                let angle = Double(index) * 55 + Double(attempt) * 36
                coord = offsetMeters(origin, distance: stepMeters + Double(attempt) * 6, degrees: angle)
            }
            result[id] = coord
        }

        // 3) 正本同士が稀に近いときだけ、後の方を最小限ずらす
        for (index, id) in order.enumerated() where anchoredIds.contains(id) {
            guard var coord = result[id], let origin = coordinates[id] else { continue }
            for attempt in 0 ..< 4 {
                guard let otherId = clashes(id, coord), anchoredIds.contains(otherId) else { break }
                let otherIndex = order.firstIndex(of: otherId) ?? 0
                if index <= otherIndex { break }
                let angle = Double(index) * 40 + Double(attempt) * 50
                coord = offsetMeters(origin, distance: 18 + Double(attempt) * 6, degrees: angle)
            }
            result[id] = coord
        }
        return result
    }

    private var walkingPath: [CLLocationCoordinate2D] {
        walkingLegs.flatMap { $0 }
    }

    /// C · 線上の矢羽。行きだけ、約200mおき。帰りには置かない。丸印にはしない。
    private func directionArrows(
        along legs: [[CLLocationCoordinate2D]],
        avoiding spots: [Spot],
        coords: [String: CLLocationCoordinate2D]
    ) -> [RouteArrow] {
        let outbound = outboundLegs(legs)
        guard !outbound.isEmpty else { return [] }
        let step = 200.0
        let inset = 70.0
        let tail = 40.0
        var arrows: [RouteArrow] = []
        for leg in outbound {
            guard leg.count >= 2 else { continue }
            var legLength = 0.0
            for index in 1 ..< leg.count {
                legLength += Self.metersBetween(leg[index - 1], leg[index])
            }
            guard legLength > inset + 16 else { continue }
            let limit = max(inset, legLength - tail)
            var walked = 0.0
            var next = inset
            for index in 1 ..< leg.count {
                let start = leg[index - 1]
                let end = leg[index]
                let segment = Self.metersBetween(start, end)
                if segment < 1 { continue }
                while next <= walked + segment, next <= limit + 0.5 {
                    let t = min(1, max(0, (next - walked) / segment))
                    let coordinate = CLLocationCoordinate2D(
                        latitude: start.latitude + (end.latitude - start.latitude) * t,
                        longitude: start.longitude + (end.longitude - start.longitude) * t
                    )
                    if !coversMarker(coordinate, spots: spots, coords: coords) {
                        arrows.append(RouteArrow(
                            id: arrows.count,
                            coordinate: coordinate,
                            degrees: Self.bearingDegrees(from: start, to: end)
                        ))
                    }
                    next += step
                }
                walked += segment
            }
        }
        return arrows
    }

    /// 最後の立ち寄りに着いた断片まで。その先の駅への戻りには矢羽を置かない。
    private func outboundLegs(_ legs: [[CLLocationCoordinate2D]]) -> [[CLLocationCoordinate2D]] {
        let stops = Array(waypointCoordinates.dropFirst().dropLast())
        guard let lastStop = stops.last, !legs.isEmpty else { return legs }
        var kept: [[CLLocationCoordinate2D]] = []
        var stopIndex = 0
        var sinceMatch = 999.0
        var walked = 0.0
        var bestLeg = -1
        var bestIndex = 0
        var best = Double.greatestFiniteMagnitude

        for (legIndex, leg) in legs.enumerated() {
            guard leg.count >= 2 else { continue }
            var cutAt: Int?
            for index in 1 ..< leg.count {
                let segment = Self.metersBetween(leg[index - 1], leg[index])
                walked += segment
                sinceMatch += segment
                if walked > 40 {
                    let dist = Self.metersBetween(leg[index], lastStop)
                    if dist < best {
                        best = dist
                        bestLeg = legIndex
                        bestIndex = index
                    }
                }
                guard sinceMatch > 25 else { continue }
                guard stopIndex < stops.count else { continue }
                guard Self.metersBetween(leg[index], stops[stopIndex]) < 70 else { continue }
                if stopIndex == stops.count - 1 {
                    cutAt = index
                    break
                }
                stopIndex += 1
                sinceMatch = 0
            }
            if let cutAt {
                kept.append(Array(leg[...cutAt]))
                return kept
            }
            kept.append(leg)
        }
        if best < 120, bestLeg >= 0 {
            return Array(legs[...bestLeg]).enumerated().map { offset, leg in
                offset == bestLeg ? Array(leg[...bestIndex]) : leg
            }
        }
        return legs
    }

    private func coversMarker(
        _ coordinate: CLLocationCoordinate2D,
        spots: [Spot],
        coords: [String: CLLocationCoordinate2D]
    ) -> Bool {
        if Self.metersBetween(coordinate, stationCoordinate) < 26 { return true }
        for spot in spots {
            let pin = coords[spot.id] ?? CLLocationCoordinate2D(latitude: spot.lat, longitude: spot.lng)
            if Self.metersBetween(coordinate, pin) < 24 { return true }
        }
        return false
    }

    /// 北を 0 度、時計回り。矢印の上向きと揃える。地図は北が上。
    private static func bearingDegrees(
        from start: CLLocationCoordinate2D,
        to end: CLLocationCoordinate2D
    ) -> Double {
        let lat1 = start.latitude * .pi / 180
        let lat2 = end.latitude * .pi / 180
        let dLng = (end.longitude - start.longitude) * .pi / 180
        let y = sin(dLng) * cos(lat2)
        let x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dLng)
        let degrees = atan2(y, x) * 180 / .pi
        return degrees < 0 ? degrees + 360 : degrees
    }

    private static func metersBetween(
        _ a: CLLocationCoordinate2D,
        _ b: CLLocationCoordinate2D
    ) -> Double {
        CLLocation(latitude: a.latitude, longitude: a.longitude)
            .distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude))
    }

    private static func offsetMeters(
        _ origin: CLLocationCoordinate2D,
        distance: Double,
        degrees: Double
    ) -> CLLocationCoordinate2D {
        let rad = degrees * .pi / 180
        let north = distance * cos(rad)
        let east = distance * sin(rad)
        let dLat = north / 111_320
        let cosLat = cos(origin.latitude * .pi / 180)
        let dLng = east / (111_320 * max(cosLat, 0.2))
        return CLLocationCoordinate2D(
            latitude: origin.latitude + dLat,
            longitude: origin.longitude + dLng
        )
    }

    var body: some View {
        let spots = mapSpots
        let numbers = model.courseNumbers
        let coords = displayCoordinates
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .bottomTrailing) {
                Map(position: $position) {
                    MapCircle(center: stationCoordinate, radius: model.radiusKm * 1000)
                        .foregroundStyle(Palette.river.opacity(0.08))
                        .stroke(Palette.river.opacity(0.45), lineWidth: 1)

                    ForEach(Array(walkingLegs.enumerated()), id: \.offset) { _, leg in
                        if leg.count >= 2 {
                            MapPolyline(coordinates: leg)
                                .stroke(
                                    Palette.warm,
                                    style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round, dash: [8, 6])
                                )
                        }
                    }

                    ForEach(directionArrows(along: walkingLegs, avoiding: spots, coords: coords)) { arrow in
                        Annotation("", coordinate: arrow.coordinate, anchor: .center) {
                            RouteDirectionArrow(degrees: arrow.degrees)
                        }
                        .annotationTitles(.hidden)
                    }

                    Annotation(station.name, coordinate: stationCoordinate, anchor: .center) {
                        StationMarker(showDeparture: model.selectedCourse != nil)
                    }

                    ForEach(spots) { pin in
                        let coordinate = coords[pin.id]
                            ?? CLLocationCoordinate2D(latitude: pin.lat, longitude: pin.lng)
                        Annotation(
                            pin.name,
                            coordinate: coordinate,
                            anchor: .center
                        ) {
                            Button {
                                model.openSpot(pin)
                            } label: {
                                SpotPin(
                                    kind: pin.guide,
                                    number: numbers[pin.id],
                                    active: model.activeSpot?.id == pin.id
                                )
                            }
                            .buttonStyle(PlainHapticButtonStyle())
                            .accessibilityLabel(
                                numbers[pin.id].map { "\($0)番 \(pin.guide.label) \(pin.name)" }
                                    ?? "\(pin.guide.label) \(pin.name)"
                            )
                        }
                        .annotationTitles(.hidden)
                    }

                    UserAnnotation {
                        HereYouAreMarker(emphasized: focusingHere)
                    }
                }
                // 線の初回描画だけ載せ直す。コース切替で地図ごと捨てると、日本全体の初期表示に戻る。
                .id("tour-map-\(pathRenderEpoch)")
                .mapStyle(.standard(pointsOfInterest: .excludingAll))
                .mapControls {
                    MapCompass()
                    MapScaleView()
                }

                Button {
                    focusOnHere()
                } label: {
                    Image(systemName: focusingHere ? "location.fill" : "location")
                        .font(.body.weight(.bold))
                        .foregroundStyle(focusingHere ? Color.white : hereBlue)
                        .frame(width: 22, height: 22)
                        .padding(12)
                        .background(
                            Circle()
                                .fill(focusingHere ? hereBlue : Palette.paper)
                        )
                        .overlay(
                            Circle()
                                .stroke(focusingHere ? hereBlueDeep : hereBlue, lineWidth: focusingHere ? 2.5 : 2)
                        )
                        .shadow(color: hereBlue.opacity(focusingHere ? 0.45 : 0.2), radius: focusingHere ? 6 : 2, y: 1)
                }
                .padding(12)
                .accessibilityLabel("現在地を表示")
                .accessibilityHint("地図を自分の位置に寄せます")
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(station.catchCopy)
                    .font(.mincho(.callout))
                    .foregroundStyle(Palette.fog)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                Text("徒歩圏 約 \(formatKm(model.radiusKm)) km")
                    .font(.caption)
                    .foregroundStyle(Palette.river)
                if model.stay == .halfDay {
                    Text("半日は、この円の外に1か所だけ足します。")
                        .font(.caption)
                        .foregroundStyle(Palette.fog)
                }
                if let course = model.selectedCourse {
                    Text("線は「\(course.title)」の道です。駅を出て番号の順に寄り、駅へ戻ります。")
                        .font(.caption)
                        .foregroundStyle(Palette.fog)
                        .fixedSize(horizontal: false, vertical: true)
                }
                // 地図ピンと同じ色丸＋白アイコンで、凡例とピンを対応させる
                FlowLayout(spacing: 8) {
                    ForEach(GuideKind.order) { kind in
                        HStack(spacing: 7) {
                            ZStack {
                                Circle()
                                    .fill(kind.color)
                                    .frame(width: 26, height: 26)
                                Circle()
                                    .stroke(Palette.paper, lineWidth: 1.5)
                                    .frame(width: 26, height: 26)
                                PictogramIcon(kind.pictogram, size: 14)
                                    .foregroundStyle(Palette.paper)
                            }
                            .shadow(color: .black.opacity(0.12), radius: 1, y: 1)
                            Text(kind.label)
                                .font(.readable(.caption, weight: .semibold))
                                .foregroundStyle(Palette.ink)
                                .lineLimit(1)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 5)
                        .background(
                            Capsule(style: .continuous)
                                .fill(kind.color.opacity(0.12))
                        )
                        .overlay(
                            Capsule(style: .continuous)
                                .stroke(kind.color.opacity(0.35), lineWidth: 1)
                        )
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Palette.paper)
        }
        .onAppear {
            model.syncWalkCourse()
            position = camera()
            // 道なり待ちでも、経由点の仮線をすぐ出す（空のまま待たない）
            publishLegs(stubLegs(from: waypointCoordinates), key: routeKey, bumpRender: true)
            refreshWalkingPath()
        }
        .onChange(of: station.id) {
            model.syncWalkCourse()
            position = camera()
            publishLegs(stubLegs(from: waypointCoordinates), key: routeKey, bumpRender: true)
            refreshWalkingPath()
        }
        .onChange(of: model.stay) { position = camera() }
        .onChange(of: routeKey) {
            position = camera()
            publishLegs(stubLegs(from: waypointCoordinates), key: routeKey, bumpRender: true)
            refreshWalkingPath()
        }
        .task(id: routeKey) {
            await loadWalkingPath()
        }
    }

    private func refreshWalkingPath() {
        // task(id:) が走るまでのあいだ、古い線を消すのはやめる。
        // 代わりに経由点仮線を残し、道なりが来たら差し替える。
        if routeKey != routeTaskId, walkingLegs.isEmpty {
            let stub = stubLegs(from: waypointCoordinates)
            if !stub.isEmpty {
                walkingLegs = stub
            }
        }
    }

    /// 道なり待ちの仮線。隣り合う経由点ごとに一本（全体を無理につなげない）。
    private func stubLegs(from points: [CLLocationCoordinate2D]) -> [[CLLocationCoordinate2D]] {
        guard points.count >= 2 else { return [] }
        return (0..<(points.count - 1)).compactMap { index in
            let a = points[index]
            let b = points[index + 1]
            guard isNearStation(a.latitude, a.longitude), isNearStation(b.latitude, b.longitude) else {
                return nil
            }
            return [a, b]
        }
    }

    /// 線を載せ、必要なら Map を再マウントして初回描画を確実にする。
    /// 前の駅（出町柳など）の計算が遅れて戻ってきたときは、今の駅の線を上書きしない。
    private func publishLegs(
        _ legs: [[CLLocationCoordinate2D]],
        key: String,
        bumpRender: Bool
    ) {
        guard key == routeKey else { return }
        let usable = legs.filter { leg in
            leg.count >= 2 && leg.allSatisfy { isNearStation($0.latitude, $0.longitude) }
        }
        guard !usable.isEmpty else {
            walkingLegs = []
            routeTaskId = key
            if bumpRender {
                pathRenderEpoch += 1
                position = camera()
            }
            return
        }
        let flat = usable.flatMap { $0 }
        let previous = walkingPath
        let changed = previous.count != flat.count
            || zip(previous, flat).contains {
                abs($0.latitude - $1.latitude) > 0.00001
                    || abs($0.longitude - $1.longitude) > 0.00001
            }
        walkingLegs = usable
        routeTaskId = key
        if bumpRender, changed {
            pathRenderEpoch += 1
            position = camera()
        }
    }

    /// 現在地へ寄せ、青い「いまここ」を強調する。
    private func focusOnHere() {
        focusGeneration += 1
        let generation = focusGeneration
        focusingHere = true
        withAnimation(.easeInOut(duration: 0.35)) {
            position = .userLocation(followsHeading: false, fallback: camera())
        }
        Task { @MainActor in
            do {
                let location = try await locator.requestOnce()
                guard generation == focusGeneration else { return }
                let region = MKCoordinateRegion(
                    center: location.coordinate,
                    latitudinalMeters: 450,
                    longitudinalMeters: 450
                )
                withAnimation(.easeInOut(duration: 0.4)) {
                    position = .region(region)
                }
            } catch {
                // 許可オフ等でも userLocation フォールバックは既に試している
            }
            try? await Task.sleep(nanoseconds: 2_600_000_000)
            guard generation == focusGeneration else { return }
            focusingHere = false
        }
    }

    @MainActor
    private func loadWalkingPath() async {
        let key = routeKey
        let points = waypointCoordinates
        guard points.count >= 2 else {
            publishLegs([], key: key, bumpRender: true)
            return
        }
        // 先に経由点線 → 道なり算出後に差し替え（地図タブを開いた瞬間から線が見える）
        publishLegs(stubLegs(from: points), key: key, bumpRender: walkingLegs.isEmpty)
        let legs = await WalkRouteBuilder.walkingLegs(through: points)
        guard !Task.isCancelled, routeTaskId == key else { return }
        publishLegs(legs, key: key, bumpRender: true)
    }

    /// 駅とピンが収まる範囲。日本全国までは開かない。
    private func camera() -> MapCameraPosition {
        let spots = mapSpots.filter { isNearStation($0.lat, $0.lng) }
        let neighborhood = MKCoordinateRegion(
            center: stationCoordinate,
            latitudinalMeters: min(model.radiusKm * 1000 * 2.3, 12_000),
            longitudinalMeters: min(model.radiusKm * 1000 * 2.3, 12_000)
        )
        guard spots.count >= 2 else { return .region(neighborhood) }
        let lats = [station.lat] + spots.map(\.lat)
        let lngs = [station.lng] + spots.map(\.lng)
        let minLat = lats.min()!, maxLat = lats.max()!
        let minLng = lngs.min()!, maxLng = lngs.max()!
        let rawLat = (maxLat - minLat) * 1.6
        let rawLng = (maxLng - minLng) * 1.6
        // 約6km。二ノ瀬と上京区（約7.5km）は同じ画面に収めない。
        let cap = 0.055
        guard rawLat <= cap, rawLng <= cap else { return .region(neighborhood) }
        let center = CLLocationCoordinate2D(latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2)
        let span = MKCoordinateSpan(
            latitudeDelta: max(rawLat, 0.008),
            longitudeDelta: max(rawLng, 0.008)
        )
        return .region(MKCoordinateRegion(center: center, span: span))
    }
}

private struct RouteArrow: Identifiable {
    let id: Int
    let coordinate: CLLocationCoordinate2D
    let degrees: Double
}

/// 線上の矢羽。墨の三角に紙の縁を付け、線に溶けないようにする。丸印にはしない。
private struct RouteDirectionArrow: View {
    var degrees: Double

    var body: some View {
        ZStack {
            Image(systemName: "arrowtriangle.up.fill")
                .font(.system(size: 15, weight: .black))
                .foregroundStyle(Palette.paper)
            Image(systemName: "arrowtriangle.up.fill")
                .font(.system(size: 10, weight: .black))
                .foregroundStyle(Palette.warm)
        }
        .rotationEffect(.degrees(degrees))
        .accessibilityHidden(true)
    }
}

private struct StationMarker: View {
    var showDeparture: Bool = false
    private let size: CGFloat = 32
    private let badgeSize: CGFloat = 22
    private let departureBadgeWidth: CGFloat = 58

    var body: some View {
        let topPad = showDeparture ? badgeSize + 6 : 0
        ZStack {
            Circle()
                .fill(Palette.ink)
                .frame(width: size, height: size)
            Circle()
                .stroke(Palette.paper, lineWidth: 2)
                .frame(width: size, height: size)
            PictogramIcon(.train, size: 18)
                .foregroundStyle(Palette.paper)
            if showDeparture {
                Text("start")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.white)
                    .lineLimit(1)
                    .frame(width: departureBadgeWidth, height: badgeSize)
                    .background(Capsule().fill(Palette.river))
                    .overlay(Capsule().stroke(Color.white, lineWidth: 2))
                    .shadow(color: .black.opacity(0.25), radius: 2, y: 1)
                    .offset(y: -(size / 2 + badgeSize / 2 + 4))
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
        }
        .frame(
            width: max(size, showDeparture ? departureBadgeWidth : badgeSize) + 8,
            height: size + topPad * 2
        )
        .shadow(color: .black.opacity(0.2), radius: 2, y: 1)
        .accessibilityLabel(showDeparture ? "駅・出発" : "駅")
    }
}

/// 地図上の「いまここ」。青く大きく、押したあとが一目で分かる。
private struct HereYouAreMarker: View {
    var emphasized: Bool
    @State private var pulse = false

    var body: some View {
        ZStack {
            Circle()
                .fill(hereBlue.opacity(emphasized ? 0.32 : 0.2))
                .frame(width: emphasized ? 76 : 54, height: emphasized ? 76 : 54)
                .scaleEffect(emphasized && pulse ? 1.18 : 1)
            Circle()
                .stroke(hereBlue.opacity(0.65), lineWidth: 2.5)
                .frame(width: emphasized ? 54 : 38, height: emphasized ? 54 : 38)
            Circle()
                .fill(hereBlue)
                .frame(width: emphasized ? 24 : 18, height: emphasized ? 24 : 18)
            Circle()
                .stroke(Color.white, lineWidth: 3)
                .frame(width: emphasized ? 24 : 18, height: emphasized ? 24 : 18)
            if emphasized {
                Text("いまここ")
                    .font(.readable(.caption2, weight: .bold))
                    .foregroundStyle(Color.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(hereBlueDeep))
                    .overlay(Capsule().stroke(Color.white, lineWidth: 1.5))
                    .shadow(color: .black.opacity(0.25), radius: 3, y: 1)
                    .offset(y: -38)
            }
        }
        .frame(width: 96, height: 96)
        .shadow(color: hereBlue.opacity(0.4), radius: emphasized ? 8 : 3, y: 1)
        .accessibilityLabel("現在地")
        .onChange(of: emphasized) { _, on in
            pulse = false
            guard on else { return }
            withAnimation(.easeInOut(duration: 0.85).repeatForever(autoreverses: true)) {
                pulse = true
            }
        }
        .onAppear {
            guard emphasized else { return }
            withAnimation(.easeInOut(duration: 0.85).repeatForever(autoreverses: true)) {
                pulse = true
            }
        }
    }
}

struct SpotPin: View {
    let kind: GuideKind
    let number: Int?
    let active: Bool

    private var size: CGFloat { active ? 34 : 30 }
    private let badgeSize: CGFloat = 22

    var body: some View {
        // ピン円の中心＝座標。番号は真上に離して置き、アイコンと重ならないようにする。
        let topPad = number == nil ? 0 : badgeSize + 6
        ZStack {
            Circle()
                .fill(kind.color)
                .frame(width: size, height: size)
            Circle()
                .stroke(active ? Palette.ink : Palette.paper, lineWidth: active ? 3 : 2)
                .frame(width: size, height: size)
            PictogramIcon(kind.pictogram, size: 16)
                .foregroundStyle(Palette.paper)
            if let number {
                Text("\(number)")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.white)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                    .frame(width: badgeSize, height: badgeSize)
                    .background(Circle().fill(Palette.warm))
                    .overlay(Circle().stroke(Color.white, lineWidth: 2))
                    .shadow(color: .black.opacity(0.25), radius: 2, y: 1)
                    .offset(y: -(size / 2 + badgeSize / 2 + 4))
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
        }
        // 上下対称に余白を取り、Map の center アンカーがピン円のままになるようにする
        .frame(width: max(size, badgeSize) + 8, height: size + topPad * 2)
        .shadow(color: .black.opacity(0.2), radius: 2, y: 1)
    }
}

