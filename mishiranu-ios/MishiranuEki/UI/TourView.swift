import MapKit
import SwiftUI

struct TourView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        VStack(spacing: 0) {
            if let station = model.station {
                StationChromeHeader(station: station)
                Group {
                    switch model.tourTab {
                    case .map: TourMapPage(station: station)
                    case .place: PlacePage(station: station)
                    case .walk: WalkPage()
                    case .guide: GuidePage(station: station)
                    case .more: SettingsPage(station: station)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .id(model.tourTab)
            }
        }
        .background(Palette.canvas.ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) {
            TourTabBar(selection: $model.tourTab)
        }
        .sheet(item: $model.activeSpot) { spot in
            SpotSheet(spot: spot)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
                .presentationBackground(Palette.paper)
        }
    }
}

struct TourTabBar: View {
    @Binding var selection: TourTab
    @Environment(ThemeStore.self) private var theme
    @Namespace private var tabFrame

    var body: some View {
        HStack(spacing: 2) {
            ForEach(TourTab.allCases) { tab in
                let active = selection == tab
                Button {
                    withAnimation(.easeInOut(duration: 0.22)) {
                        selection = tab
                    }
                } label: {
                    VStack(spacing: 3) {
                        PictogramIcon(tab.pictogram, size: 22)
                        Text(tab.label)
                            .font(.caption2.weight(.regular))
                            .lineLimit(1)
                    }
                    // アイコンの濃さは揃える。選択は枠だけが動く。
                    .foregroundStyle(Palette.ink)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background {
                        if active {
                            RoundedRectangle(
                                cornerRadius: theme.skin == .board ? 10 : 8,
                                style: .continuous
                            )
                            .stroke(Palette.warm, lineWidth: 2)
                            .padding(.horizontal, 3)
                            .padding(.vertical, 2)
                            .matchedGeometryEffect(id: "tour-tab-frame", in: tabFrame)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(PlainHapticButtonStyle())
                .accessibilityLabel(tab.label)
                .accessibilityAddTraits(active ? .isSelected : [])
                .accessibilityValue(active ? "表示中" : "オフ")
            }
        }
        .padding(.horizontal, 4)
        .padding(.top, 4)
        .padding(.bottom, 2)
        .background(Palette.paper.ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) { Divider().overlay(Palette.line) }
    }
}

struct SpotSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let spot: Spot
    @State private var mapPosition: MapCameraPosition

    init(spot: Spot) {
        self.spot = spot
        let coord = CLLocationCoordinate2D(latitude: spot.lat, longitude: spot.lng)
        _mapPosition = State(
            initialValue: .camera(MapCamera(centerCoordinate: coord, distance: 700, heading: 0, pitch: 0))
        )
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 6) {
                    PictogramIcon(spot.guide.pictogram, size: 18)
                        .foregroundStyle(spot.guide.color)
                    Text(metaLine)
                        .font(.callout)
                        .foregroundStyle(Palette.mist)
                }
                if spot.guide == .meal {
                    Text(mealMetaLine(spot))
                        .font(.callout)
                        .foregroundStyle(Palette.warm)
                }
                if let number = model.courseNumbers[spot.id] {
                    Text("まわりの \(number) か所目")
                        .font(.callout.weight(.semibold))
                        .foregroundStyle(Palette.paper)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Capsule().fill(Palette.warm))
                }
                Text(spot.name)
                    .font(.mincho(.title2, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                Text(SpotCopy.blurb(for: spot, in: model.station))
                    .font(.mincho(.body))
                    .lineSpacing(6)
                    .foregroundStyle(Palette.fog)
                if let detail = spot.detail {
                    Text(detail)
                        .font(.mincho(.callout))
                        .lineSpacing(5)
                        .foregroundStyle(Palette.mist)
                }
                if let station = model.station, let trace = StationLore.trace(for: spot, in: station) {
                    LoreTrace(text: trace, size: .callout)
                }

                Text("場所")
                    .font(.mincho(.subheadline, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                    .padding(.top, 4)
                Map(position: $mapPosition, interactionModes: [.pan, .zoom]) {
                    Annotation(spot.name, coordinate: coordinate, anchor: .center) {
                        SpotPin(kind: spot.guide, number: model.courseNumbers[spot.id], active: true)
                    }
                    .annotationTitles(.hidden)
                }
                .mapStyle(.standard(pointsOfInterest: .excludingAll))
                .frame(height: 220)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(Palette.line, lineWidth: 1)
                )
                // ScrollView にジェスチャを奪われないよう、地図操作を優先
                .simultaneousGesture(DragGesture(minimumDistance: 0))
                .accessibilityLabel("\(spot.name)の地図。指で動かしたり拡大できます")

                Button("閉じる") { dismiss() }
                    .buttonStyle(PrimaryButtonStyle())
                    .padding(.top, 8)
            }
            .padding(24)
        }
    }

    private var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: spot.lat, longitude: spot.lng)
    }

    private var metaLine: String {
        var parts = ["\(spot.guide.label)", "徒歩約 \(spot.walkMinutes) 分"]
        if let hours = SpotHours.display(for: spot) {
            parts.append("営業 \(hours)")
        }
        return parts.joined(separator: " · ")
    }
}

func mealMetaLine(_ spot: Spot) -> String {
    "\(spot.soloLabel) · \(spot.budgetYen) · \(spot.mealTier.label)"
}
