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

    /// 立ち寄り順の経由点（駅→1→2…）。道なり化前の点列。
    private var waypointCoordinates: [CLLocationCoordinate2D] {
        guard let course = model.selectedCourse, !course.stops.isEmpty else { return [] }
        return [stationCoordinate] + course.stops.map {
            let pin = model.resolvedSpot($0.spot)
            return CLLocationCoordinate2D(latitude: pin.lat, longitude: pin.lng)
        }
    }

    private var routeKey: String {
        guard let course = model.selectedCourse else { return "" }
        let ids = course.stops.map(\.spot.id).joined(separator: ",")
        return "\(station.id)|\(course.id)|\(ids)"
    }

    var body: some View {
        let spots = model.tourSpots
        let numbers = model.courseNumbers
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
                        StationMarker()
                    }

                    ForEach(spots) { spot in
                        let pin = model.resolvedSpot(spot)
                        Annotation(
                            pin.name,
                            coordinate: CLLocationCoordinate2D(latitude: pin.lat, longitude: pin.lng),
                            // 円の中心＝座標。番号バッジは描画だけ外に出す。
                            anchor: .center
                        ) {
                            Button {
                                model.openSpot(pin)
                            } label: {
                                SpotPin(kind: pin.guide, number: numbers[pin.id], active: model.activeSpot?.id == pin.id)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("\(pin.guide.label) \(pin.name)")
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
                    Text("線は「\(course.title)」の徒歩ルート（道なり・駅→\(course.stops.count)か所）")
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
        let spots = model.tourSpots
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
    private let size: CGFloat = 32

    var body: some View {
        ZStack {
            Circle()
                .fill(Palette.ink)
                .frame(width: size, height: size)
            Circle()
                .stroke(Palette.paper, lineWidth: 2)
                .frame(width: size, height: size)
            PictogramIcon(.train, size: 18)
                .foregroundStyle(Palette.paper)
        }
        .frame(width: size, height: size)
        .shadow(color: .black.opacity(0.2), radius: 2, y: 1)
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

    var body: some View {
        // 固定枠の中心が座標。番号は枠外に描くだけでレイアウトを広げない。
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
                    .font(.readable(.caption2, weight: .bold))
                    .foregroundStyle(Palette.paper)
                    .frame(width: 18, height: 18)
                    .background(Circle().fill(Palette.warm))
                    .overlay(Circle().stroke(Palette.paper, lineWidth: 1.5))
                    .offset(x: size * 0.38, y: -size * 0.38)
                    .allowsHitTesting(false)
            }
        }
        .frame(width: size, height: size)
        .compositingGroup()
        .shadow(color: .black.opacity(0.2), radius: 2, y: 1)
    }
}
