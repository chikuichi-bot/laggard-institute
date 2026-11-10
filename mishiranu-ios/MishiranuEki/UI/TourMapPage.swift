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
            CLLocationCoordinate2D(latitude: $0.spot.lat, longitude: $0.spot.lng)
        }
    }

    var body: some View {
        let spots = model.tourSpots
        let numbers = model.courseNumbers
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(station.name)駅 · 観光案内")
                    .font(.caption2)
                    .foregroundStyle(Palette.mist)
                Text(station.tourTitle)
                    .font(.mincho(.headline, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                Text(station.catchCopy)
                    .font(.mincho(.footnote))
                    .foregroundStyle(Palette.fog)
                    .lineLimit(2)
                Text("徒歩圏 約 \(formatKm(model.radiusKm)) km · 案内ピン \(spots.count) 件")
                    .font(.caption)
                    .foregroundStyle(Palette.river)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)

            ZStack(alignment: .topTrailing) {
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
                        Annotation(spot.name, coordinate: CLLocationCoordinate2D(latitude: spot.lat, longitude: spot.lng), anchor: .center) {
                            Button {
                                model.openSpot(spot)
                            } label: {
                                SpotPin(kind: spot.guide, number: numbers[spot.id], active: model.activeSpot?.id == spot.id)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("\(spot.guide.label) \(spot.name)")
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
                    withAnimation { position = camera() }
                } label: {
                    PictogramIcon(.train, size: 18)
                        .foregroundStyle(Palette.ink)
                        .padding(10)
                        .background(Circle().fill(Palette.paper))
                        .overlay(Circle().stroke(Palette.line, lineWidth: 1))
                }
                .padding(12)
                .accessibilityLabel("駅に戻る")
            }

            VStack(alignment: .leading, spacing: 8) {
                if let course = model.selectedCourse {
                    Text("地図の線は「\(course.title)」の歩き順（駅→\(course.stops.count)か所）です。")
                        .font(.caption)
                        .foregroundStyle(Palette.fog)
                }
                HStack(spacing: 12) {
                    ForEach(GuideKind.order) { kind in
                        HStack(spacing: 4) {
                            PictogramIcon(kind.pictogram, size: 14)
                                .foregroundStyle(kind.color)
                            Text(kind.label)
                                .font(.caption2)
                                .foregroundStyle(Palette.fog)
                                .lineLimit(1)
                                .fixedSize()
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

    private func camera() -> MapCameraPosition {
        let meters = model.radiusKm * 1000 * 2.3
        return .region(MKCoordinateRegion(center: stationCoordinate, latitudinalMeters: meters, longitudinalMeters: meters))
    }
}

private struct StationMarker: View {
    var body: some View {
        PictogramIcon(.train, size: 18)
            .foregroundStyle(Palette.paper)
            .padding(7)
            .background(Circle().fill(Palette.ink))
            .overlay(Circle().stroke(Palette.paper, lineWidth: 2))
            .shadow(color: .black.opacity(0.2), radius: 2, y: 1)
    }
}

struct SpotPin: View {
    let kind: GuideKind
    let number: Int?
    let active: Bool

    var body: some View {
        PictogramIcon(kind.pictogram, size: 16)
            .foregroundStyle(Palette.paper)
            .padding(6)
            .background(Circle().fill(kind.color))
            .overlay(Circle().stroke(active ? Palette.ink : Palette.paper, lineWidth: active ? 3 : 2))
            .overlay(alignment: .topTrailing) {
                if let number {
                    Text("\(number)")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Palette.paper)
                        .frame(width: 18, height: 18)
                        .background(Circle().fill(Palette.warm))
                        .overlay(Circle().stroke(Palette.paper, lineWidth: 1.5))
                        .offset(x: 8, y: -8)
                }
            }
            .shadow(color: .black.opacity(0.2), radius: 2, y: 1)
            .scaleEffect(active ? 1.15 : 1)
    }
}
