import MapKit
import SwiftUI

/// 現在地専用色（地図の緑・ベージュと被らない青）
private let hereBlue = Color(hex: 0x1E7AFE)
private let hereBlueDeep = Color(hex: 0x0B5ED7)

struct TourMapPage: View {
    @Environment(AppModel.self) private var model
    let station: Station
    @State private var position: MapCameraPosition = .automatic
    /// 徒歩の道なり座標（直線は川の上を横切るので使わない）
    @State private var walkingPath: [CLLocationCoordinate2D] = []
    @State private var routeTaskId: String = ""
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
        return [stationCoordinate] + mid + [stationCoordinate]
    }

    private var routeKey: String {
        guard let course = model.selectedCourse else { return "" }
        let ids = course.stops.map(\.spot.id).joined(separator: ",")
        return "\(station.id)|\(course.id)|\(ids)"
    }

    /// 地図に出すピン。コース選択中は番号付きの立ち寄りだけ（信頼ピンが無くても道順は出す）。
    private var mapSpots: [Spot] {
        let numbers = model.courseNumbers
        if !numbers.isEmpty, let course = model.selectedCourse {
            // tourSpots は信頼ピンのみなので、コース立ち寄りを正本にする
            return course.stops.map { model.resolvedSpot($0.spot) }
        }
        return model.tourSpots.map(model.resolvedSpot)
    }

    /// 近いピンの表示座標だけずらす（道なりルートの実座標は変えない）。
    private var displayCoordinates: [String: CLLocationCoordinate2D] {
        Self.spreadDisplayCoordinates(mapSpots)
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

                    if walkingPath.count > 1 {
                        MapPolyline(coordinates: walkingPath)
                            .stroke(
                                Palette.warm,
                                style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round, dash: [8, 6])
                            )
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
                    Text("線は「\(course.title)」の周回（道なり・駅出発→\(course.stops.count)か所→駅）。なるべく同じ道は帰りません。")
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
            position = camera()
            refreshWalkingPath()
        }
        .onChange(of: station.id) {
            position = camera()
            refreshWalkingPath()
        }
        .onChange(of: model.stay) { position = camera() }
        .onChange(of: routeKey) { refreshWalkingPath() }
        .task(id: routeKey) {
            await loadWalkingPath()
        }
    }

    private func refreshWalkingPath() {
        // task(id:) が走るまでのあいだ、古い線を消す
        if routeKey != routeTaskId {
            walkingPath = []
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
            walkingPath = []
            routeTaskId = key
            return
        }
        routeTaskId = key
        let path = await WalkRouteBuilder.walkingPath(through: points)
        guard !Task.isCancelled, routeTaskId == key else { return }
        walkingPath = path
    }

    /// 駅とピンが収まる範囲。ピンが少ないときは徒歩圏の円を目安にする。
    private func camera() -> MapCameraPosition {
        let spots = mapSpots
        guard spots.count >= 2 else {
            let meters = model.radiusKm * 1000 * 2.3
            return .region(MKCoordinateRegion(center: stationCoordinate, latitudinalMeters: meters, longitudinalMeters: meters))
        }
        let lats = [station.lat] + spots.map(\.lat)
        let lngs = [station.lng] + spots.map(\.lng)
        let minLat = lats.min()!, maxLat = lats.max()!
        let minLng = lngs.min()!, maxLng = lngs.max()!
        let center = CLLocationCoordinate2D(latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2)
        let span = MKCoordinateSpan(
            latitudeDelta: max((maxLat - minLat) * 1.6, 0.008),
            longitudeDelta: max((maxLng - minLng) * 1.6, 0.008)
        )
        return .region(MKCoordinateRegion(center: center, span: span))
    }
}

private struct StationMarker: View {
    var showDeparture: Bool = false
    private let size: CGFloat = 32
    private let badgeSize: CGFloat = 22

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
                Text("出")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.white)
                    .frame(width: badgeSize, height: badgeSize)
                    .background(Circle().fill(Palette.warm))
                    .overlay(Circle().stroke(Color.white, lineWidth: 2))
                    .shadow(color: .black.opacity(0.25), radius: 2, y: 1)
                    .offset(y: -(size / 2 + badgeSize / 2 + 4))
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
        }
        .frame(width: max(size, badgeSize) + 8, height: size + topPad * 2)
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

extension TourMapPage {
    /// 約70m以内のピンを扇状に少しずらして、番号が重ならないようにする。
    fileprivate static func spreadDisplayCoordinates(
        _ spots: [Spot]
    ) -> [String: CLLocationCoordinate2D] {
        let minKm = 0.07
        var placed: [(id: String, lat: Double, lng: Double)] = []
        for (index, spot) in spots.enumerated() {
            var lat = spot.lat
            var lng = spot.lng
            for step in 0..<8 {
                let clashes = placed.contains {
                    Geo.haversineKm(
                        lat1: lat, lng1: lng,
                        lat2: $0.lat, lng2: $0.lng
                    ) < minKm
                }
                if !clashes { break }
                let angle = Double(index) * 2.2 + Double(step) * 1.1
                lat += 0.00032 * cos(angle) // ~35m
                lng += 0.00038 * sin(angle)
            }
            placed.append((spot.id, lat, lng))
        }
        return Dictionary(
            uniqueKeysWithValues: placed.map {
                ($0.id, CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lng))
            }
        )
    }
}
