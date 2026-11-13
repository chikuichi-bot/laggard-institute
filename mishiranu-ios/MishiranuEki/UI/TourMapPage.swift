import MapKit
import SwiftUI

/// 現在地専用色（地図の緑・ベージュと被らない青）
private let hereBlue = Color(hex: 0x1E7AFE)
private let hereBlueDeep = Color(hex: 0x0B5ED7)

/// 案内図（標準）と写真地図（ハイブリッド）。選んだ方を端末に覚える。
private enum TourMapBaseStyle: String, CaseIterable {
    case guide
    case photo

    var title: String {
        switch self {
        case .guide: return "案内図"
        case .photo: return "写真"
        }
    }

    var accessibilityHint: String {
        switch self {
        case .guide: return "道路の案内図に切り替えます"
        case .photo: return "航空写真の地図に切り替えます"
        }
    }

    var mapStyle: MapStyle {
        switch self {
        case .guide:
            return .standard(pointsOfInterest: .excludingAll)
        case .photo:
            // 写真＋道路名。純粋な衛星だけだと歩きにくい。
            return .hybrid(pointsOfInterest: .excludingAll)
        }
    }

    var toggleSymbol: String {
        switch self {
        case .guide: return "globe.americas.fill"
        case .photo: return "map"
        }
    }

    /// 押したあとになる方（案内図のとき写真へ、写真のとき案内図へ）
    var toggled: TourMapBaseStyle {
        self == .guide ? .photo : .guide
    }
}

struct TourMapPage: View {
    @Environment(AppModel.self) private var model
    let station: Station
    @AppStorage("mishiranu.tourMapBaseStyle") private var mapBaseStyleRaw = TourMapBaseStyle.guide.rawValue
    @State private var position: MapCameraPosition = .automatic
    /// 徒歩の道なり。意図して途切れた区間だけ別配列。頂点が離れていても同じ断片は一本。
    @State private var walkingLegs: [[CLLocationCoordinate2D]] = []
    @State private var routeTaskId: String = ""
    /// MapPolyline が初回描画されない癖への再マウント用
    @State private var pathRenderEpoch = 0
    @State private var focusingHere = false
    @State private var focusGeneration = 0
    @State private var locator = LocationService()

    private var mapBaseStyle: TourMapBaseStyle {
        TourMapBaseStyle(rawValue: mapBaseStyleRaw) ?? .guide
    }

    private var stationCoordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: station.lat, longitude: station.lng)
    }

    /// 立ち寄り順の経由点（駅→1→2…→駅）。道なり化前の点列。終点も駅。
    /// コースに入れた点は距離で落とさない（半日の「円外に1か所」も線と番号に残す）。
    private var waypointCoordinates: [CLLocationCoordinate2D] {
        guard let course = model.selectedCourse, !course.stops.isEmpty else { return [] }
        let mid = course.stops.compactMap { stop -> CLLocationCoordinate2D? in
            let pin = model.resolvedSpot(stop.spot)
            if DemachiTemplate.isForeignDemachiPlace(pin.name, stationName: station.name) {
                return nil
            }
            guard pin.lat != 0 || pin.lng != 0 else { return nil }
            return CLLocationCoordinate2D(latitude: pin.lat, longitude: pin.lng)
        }
        guard mid.count >= 1 else { return [] }
        return [stationCoordinate] + mid + [stationCoordinate]
    }

    private var routeKey: String {
        guard let course = model.selectedCourse else { return "" }
        let ids = course.stops.map(\.spot.id).joined(separator: ",")
        return "\(station.id)|\(course.id)|\(ids)"
    }

    /// 地図下の一行。徒歩圏と、あればコース名だけ。
    private var mapFootLine: String {
        var parts = ["徒歩圏 約 \(formatKm(model.radiusKm)) km"]
        if model.stay == .halfDay {
            parts.append("半日は円外に1か所")
        }
        if let course = model.selectedCourse {
            parts.append("\(course.title) · 番号順")
        }
        return parts.joined(separator: " · ")
    }

    private func mapLegendLabel(_ kind: GuideKind) -> String {
        switch kind {
        case .rest: return "休む"
        default: return kind.label
        }
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

    /// 地図に出すピン。コースの立ち寄りは必ず残す（円外の1か所も含む）。
    /// 店・その他だけ、駅から遠すぎる／出町混入を落とす。
    private var mapSpots: [Spot] {
        let shops = model.guideShopSpots.map(model.resolvedSpot).filter(belongsOnThisMap)
        let trusted = model.tourSpots.map(model.resolvedSpot).filter(belongsOnThisMap)
        if let course = model.selectedCourse, !course.stops.isEmpty {
            let coursePins = course.stops.map { model.resolvedSpot($0.spot) }.filter {
                !DemachiTemplate.isForeignDemachiPlace($0.name, stationName: station.name)
                    && ($0.lat != 0 || $0.lng != 0)
            }
            let extras = (trusted + shops).filter { extra in
                !coursePins.contains { sameMapPin($0, extra) }
            }
            return coursePins + deduped(extras)
        }
        return deduped(trusted + shops)
    }

    private func sameMapPin(_ a: Spot, _ b: Spot) -> Bool {
        // 満寿形屋（ご飯）と枡形商店街（観光）は別。似た名でも潰さない。
        if StoryMapSpots.areDistinctMasugataPlaces(a.name, b.name) { return false }
        // ご飯／土産と観光が違う屋号なら、近い座標でも別ピン
        if StoryMapSpots.areConflictingEstablishments(a, b) { return false }
        return StoryMapSpots.samePlace(a, b) || NameMatch.score(a.name, b.name) >= 85
    }

    /// 同場所は落とさず合体（物語×観光／ご飯など）。
    private func deduped(_ spots: [Spot]) -> [Spot] {
        var kept: [Spot] = []
        for spot in spots {
            if let idx = kept.firstIndex(where: { sameMapPin($0, spot) }) {
                kept[idx] = StoryMapSpots.merge(
                    kept[idx],
                    with: spot,
                    stationName: station.name
                )
            } else {
                kept.append(spot)
            }
        }
        return kept
    }

    /// ピンの地図座標は正本のまま。近い店はアイコンだけ画面上でずらす。
    private var displayCoordinates: [String: CLLocationCoordinate2D] {
        Dictionary(uniqueKeysWithValues: mapSpots.map {
            ($0.id, CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lng))
        })
    }

    /// 同じ場所のご飯／土産が観光ピンに隠れるとき、アイコンだけ少しずらす（座標は動かさない）。
    private var iconNudges: [String: CGSize] {
        let spots = mapSpots
        var nudges: [String: CGSize] = [:]
        var shopIndex = 0
        for spot in spots where spot.guide == .meal || spot.guide == .souvenir {
            let crowded = spots.contains { other in
                guard other.id != spot.id else { return false }
                return Self.metersBetween(
                    CLLocationCoordinate2D(latitude: spot.lat, longitude: spot.lng),
                    CLLocationCoordinate2D(latitude: other.lat, longitude: other.lng)
                ) < 28
            }
            guard crowded else { continue }
            nudges[spot.id] = CGSize(
                width: -18 - CGFloat(shopIndex) * 8,
                height: -16 - CGFloat(shopIndex) * 6
            )
            shopIndex += 1
        }
        return nudges
    }

    private var walkingPath: [CLLocationCoordinate2D] {
        walkingLegs.flatMap { $0 }
    }

    /// C · 線上の矢羽。行きだけ、約140mおき。帰りには置かない。丸印にはしない。
    private func directionArrows(
        along legs: [[CLLocationCoordinate2D]],
        avoiding spots: [Spot],
        coords: [String: CLLocationCoordinate2D]
    ) -> [RouteArrow] {
        let outbound = outboundLegs(legs)
        guard !outbound.isEmpty else { return [] }
        let step = 140.0
        let inset = 55.0
        let tail = 35.0
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

    /// 進行方向の小さな矢羽（左翼→先端→右翼）。地図の線として描き、画面オーバーレイにしない。
    private static func chevronCoordinates(
        at center: CLLocationCoordinate2D,
        degrees: Double
    ) -> [CLLocationCoordinate2D] {
        let tip = offsetMeters(center, distance: 11, degrees: degrees)
        let left = offsetMeters(center, distance: 10, degrees: degrees + 155)
        let right = offsetMeters(center, distance: 10, degrees: degrees - 155)
        return [left, tip, right]
    }

    var body: some View {
        let spots = mapSpots
        let numbers = model.courseNumbers
        let coords = displayCoordinates
        let nudges = iconNudges
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

                    // 矢羽は MapPolyline（地図ネイティブ）。Canvas+continuous はパンのたび全再描画で重い。
                    // 色は線(warm)と違う墨＋紙縁。Annotation にしない（間引き／負荷の両面）。
                    ForEach(directionArrows(along: walkingLegs, avoiding: spots, coords: coords)) { arrow in
                        let chevron = Self.chevronCoordinates(
                            at: arrow.coordinate, degrees: arrow.degrees
                        )
                        MapPolyline(coordinates: chevron)
                            .stroke(Palette.paper, style: StrokeStyle(lineWidth: 5, lineCap: .round, lineJoin: .round))
                        MapPolyline(coordinates: chevron)
                            .stroke(Palette.ink, style: StrokeStyle(lineWidth: 2.4, lineCap: .round, lineJoin: .round))
                    }

                    Annotation(station.name, coordinate: stationCoordinate, anchor: .center) {
                        StationMarker(showDeparture: model.selectedCourse != nil)
                    }

                    ForEach(spots.sorted { lhs, rhs in
                        let lhsShop = lhs.guide == .meal || lhs.guide == .souvenir
                        let rhsShop = rhs.guide == .meal || rhs.guide == .souvenir
                        if lhsShop == rhsShop { return false }
                        return !lhsShop && rhsShop
                    }) { pin in
                        let coordinate = coords[pin.id]
                            ?? CLLocationCoordinate2D(latitude: pin.lat, longitude: pin.lng)
                        let nudge = nudges[pin.id] ?? .zero
                        Annotation(
                            LandscapeSpotName.clarified(pin.name),
                            coordinate: coordinate,
                            anchor: .center
                        ) {
                            // offset だけだと当たりが元の座標に残り、見た目のピンを押せない。
                            // 枠を広げ、当たりはずらした円だけにする。
                            Button {
                                model.openSpot(pin)
                            } label: {
                                SpotPin(
                                    kind: pin.guide,
                                    number: numbers[pin.id],
                                    active: model.activeSpot?.id == pin.id
                                )
                                .offset(nudge)
                            }
                            .buttonStyle(PlainHapticButtonStyle())
                            .frame(
                                width: 36 + abs(nudge.width) * 2,
                                height: 36 + abs(nudge.height) * 2
                            )
                            .contentShape(NudgeHitCircle(nudge: nudge, diameter: 40))
                            .accessibilityLabel(
                                numbers[pin.id].map {
                                    "\($0)番 \(pin.guide.label) \(LandscapeSpotName.clarified(pin.name))"
                                }
                                    ?? "\(pin.guide.label) \(LandscapeSpotName.clarified(pin.name))"
                            )
                        }
                        .annotationTitles(.hidden)
                    }

                    UserAnnotation {
                        HereYouAreMarker(emphasized: focusingHere)
                    }
                }
                // 線の初回描画だけ載せ直す。コースや見た目の切替で Map を捨てると日本全体に戻る。
                .id("tour-map-\(pathRenderEpoch)")
                .mapStyle(mapBaseStyle.mapStyle)
                .mapControls {
                    MapCompass()
                    MapScaleView()
                }

                VStack(spacing: 10) {
                    Button {
                        mapBaseStyleRaw = mapBaseStyle.toggled.rawValue
                    } label: {
                        Image(systemName: mapBaseStyle.toggleSymbol)
                            .font(.body.weight(.bold))
                            .foregroundStyle(Palette.ink)
                            .frame(width: 22, height: 22)
                            .padding(12)
                            .background(Circle().fill(Palette.paper))
                            .overlay(
                                Circle().stroke(Palette.line, lineWidth: 1.5)
                            )
                            .shadow(color: .black.opacity(0.15), radius: 2, y: 1)
                    }
                    .accessibilityLabel(mapBaseStyle.toggled.title)
                    .accessibilityHint(mapBaseStyle.toggled.accessibilityHint)

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
                    .accessibilityLabel("現在地を表示")
                    .accessibilityHint("地図を自分の位置に寄せます")
                }
                .padding(12)
            }

            VStack(alignment: .leading, spacing: 8) {
                // 地図のすぐ下は凡例と一行だけ。キャッチや長い説明は土地へ。
                FlowLayout(spacing: 6) {
                    ForEach(GuideKind.order) { kind in
                        HStack(spacing: 5) {
                            ZStack {
                                Circle()
                                    .fill(kind.color)
                                    .frame(width: 22, height: 22)
                                Circle()
                                    .stroke(Palette.paper, lineWidth: 1.5)
                                    .frame(width: 22, height: 22)
                                PictogramIcon(kind.pictogram, size: 12)
                                    .foregroundStyle(Palette.paper)
                            }
                            Text(mapLegendLabel(kind))
                                .font(.readable(.caption2, weight: .semibold))
                                .foregroundStyle(Palette.ink)
                                .lineLimit(1)
                        }
                        .padding(.horizontal, 7)
                        .padding(.vertical, 4)
                        .background(
                            Capsule(style: .continuous)
                                .fill(kind.color.opacity(0.12))
                        )
                        .overlay(
                            Capsule(style: .continuous)
                                .stroke(kind.color.opacity(0.35), lineWidth: 1)
                        )
                        .accessibilityLabel(kind.label)
                    }
                }
                Text(mapFootLine)
                    .font(.caption)
                    .foregroundStyle(Palette.fog)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Palette.paper)
        }
        .onAppear {
            model.syncWalkCourse()
            if let spot = model.activeSpot {
                focusOnSpot(spot, animated: false)
            } else {
                position = camera()
            }
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
            // 場所シートで地点を選んでいるときは、全体フィットで上書きしない
            if model.activeSpot == nil {
                position = camera()
            }
            publishLegs(stubLegs(from: waypointCoordinates), key: routeKey, bumpRender: true)
            refreshWalkingPath()
        }
        .onChange(of: model.activeSpot?.id) { _, _ in
            guard let spot = model.activeSpot else { return }
            focusOnSpot(spot, animated: true)
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
        // コース経由点は距離で切らない。隣どうしを仮線でつなぐ。
        return (0..<(points.count - 1)).map { index in
            [points[index], points[index + 1]]
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
        // コースの円外1か所へ向かう線も残す（頂点が駅から少し遠くても切らない）。
        let usable = legs.filter { $0.count >= 2 }
        guard !usable.isEmpty else {
            walkingLegs = []
            routeTaskId = key
            if bumpRender {
                pathRenderEpoch += 1
                if model.activeSpot == nil {
                    position = camera()
                }
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
            if model.activeSpot == nil {
                position = camera()
            }
        }
    }

    /// 歩く／案内の「地図」から選んだ地点へ寄せる。
    private func focusOnSpot(_ spot: Spot, animated: Bool) {
        let resolved = model.resolvedSpot(spot)
        guard resolved.lat != 0 || resolved.lng != 0 else { return }
        focusingHere = false
        focusGeneration += 1
        let region = MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: resolved.lat, longitude: resolved.lng),
            latitudinalMeters: 520,
            longitudinalMeters: 520
        )
        if animated {
            withAnimation(.easeInOut(duration: 0.4)) {
                position = .region(region)
            }
        } else {
            position = .region(region)
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
    /// コースの円外1か所は、吸い込み防止の上限内なら画面に入れる。
    private func camera() -> MapCameraPosition {
        let courseSpots = (model.selectedCourse?.stops ?? []).map { model.resolvedSpot($0.spot) }
        let nearExtras = mapSpots.filter { isNearStation($0.lat, $0.lng) }
        let spots = deduped(courseSpots + nearExtras).filter { $0.lat != 0 || $0.lng != 0 }
        let neighborhood = MKCoordinateRegion(
            center: stationCoordinate,
            latitudinalMeters: min(max(model.radiusKm * 1000 * 2.3, 2_500), 12_000),
            longitudinalMeters: min(max(model.radiusKm * 1000 * 2.3, 2_500), 12_000)
        )
        guard spots.count >= 1 else { return .region(neighborhood) }
        let lats = [station.lat] + spots.map(\.lat)
        let lngs = [station.lng] + spots.map(\.lng)
        let minLat = lats.min()!, maxLat = lats.max()!
        let minLng = lngs.min()!, maxLng = lngs.max()!
        let rawLat = (maxLat - minLat) * 1.6
        let rawLng = (maxLng - minLng) * 1.6
        // 約8km。コースの円外1か所は許しつつ、二ノ瀬→出町級の吸い込みは防ぐ。
        let cap = 0.072
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

/// 地図ピンを画面上でずらしたとき、当たり判定をその円に合わせる。
private struct NudgeHitCircle: Shape {
    var nudge: CGSize
    var diameter: CGFloat

    func path(in rect: CGRect) -> Path {
        let center = CGPoint(x: rect.midX + nudge.width, y: rect.midY + nudge.height)
        let box = CGRect(
            x: center.x - diameter / 2,
            y: center.y - diameter / 2,
            width: diameter,
            height: diameter
        )
        return Path(ellipseIn: box)
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

