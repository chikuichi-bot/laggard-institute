import MapKit
import SwiftUI

struct TourMapPage: View {
    @Environment(AppModel.self) private var model
    let station: Station
    @State private var position: MapCameraPosition = .automatic

    private var stationCoordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: station.lat, longitude: station.lng)
    }

    private var routeCoordinates: [CLLocationCoordinate2D] {
        guard let course = model.selectedCourse, !course.stops.isEmpty else { return [] }
        return [stationCoordinate] + course.stops.map {
            let pin = model.resolvedSpot($0.spot)
            return CLLocationCoordinate2D(latitude: pin.lat, longitude: pin.lng)
        }
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

                    if routeCoordinates.count > 1 {
                        MapPolyline(coordinates: routeCoordinates)
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

                    UserAnnotation()
                }
                .mapStyle(.standard(pointsOfInterest: .excludingAll))
                .mapControls {
                    MapCompass()
                    MapScaleView()
                }

                Button {
                    withAnimation {
                        position = .userLocation(followsHeading: false, fallback: camera())
                    }
                } label: {
                    Image(systemName: "location")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Palette.ink)
                        .frame(width: 18, height: 18)
                        .padding(10)
                        .background(Circle().fill(Palette.paper))
                        .overlay(Circle().stroke(Palette.line, lineWidth: 1))
                }
                .padding(12)
                .accessibilityLabel("現在地を表示")
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
                if let course = model.selectedCourse {
                    Text("線は「\(course.title)」の歩き順（駅→\(course.stops.count)か所）")
                        .font(.caption)
                        .foregroundStyle(Palette.fog)
                        .fixedSize(horizontal: false, vertical: true)
                }
                FlowLayout(spacing: 10) {
                    ForEach(GuideKind.order) { kind in
                        HStack(spacing: 5) {
                            PictogramIcon(kind.pictogram, size: 14)
                                .foregroundStyle(kind.color)
                            Text(kind.label)
                                .font(.caption2)
                                .foregroundStyle(Palette.fog)
                                .lineLimit(1)
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Palette.paper)
        }
        .onAppear { position = camera() }
        .onChange(of: station.id) { position = camera() }
        .onChange(of: model.stay) { position = camera() }
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
