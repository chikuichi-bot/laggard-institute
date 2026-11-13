import MapKit
import SwiftUI

struct TourView: View {
    @Environment(AppModel.self) private var model
    @Environment(ThemeStore.self) private var theme

    var body: some View {
        @Bindable var model = model
        // skin を読んで Palette を追従（Root の .id(skin) なしでも色が変わる）
        let _ = theme.skin
        VStack(spacing: 0) {
            if let station = model.station {
                StationChromeHeader(station: station)
                // 地図はタブ切替で破棄しない（導線の MKDirections を先に走らせ、polyline の初回描画欠けも避ける）
                ZStack {
                    TourMapPage(station: station)
                        // MapKit は opacity 0 でも触りを取ることがあるので、非表示タブでは奥へ退かす。
                        .opacity(model.tourTab == .map ? 1 : 0)
                        .allowsHitTesting(model.tourTab == .map)
                        .accessibilityHidden(model.tourTab != .map)
                        .offset(x: model.tourTab == .map ? 0 : 2500)
                        .zIndex(model.tourTab == .map ? 1 : 0)

                    Group {
                        switch model.tourTab {
                        case .map:
                            EmptyView()
                        case .place:
                            PlacePage(station: station)
                        case .walk:
                            WalkPage()
                        case .guide:
                            GuidePage(station: station)
                        case .more:
                            SettingsPage(station: station)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    .id(model.tourTab == .map ? "map-slot" : model.tourTab.rawValue)
                    .opacity(model.tourTab == .map ? 0 : 1)
                    .allowsHitTesting(model.tourTab != .map)
                    .accessibilityHidden(model.tourTab == .map)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            }
        }
        .background(Palette.canvas.ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) {
            TourTabBar(selection: $model.tourTab)
        }
        .onChange(of: model.station?.id) { _, _ in
            model.syncWalkCourse()
        }
        .onChange(of: model.tourTab) { _, tab in
            if tab == .walk || tab == .map {
                model.syncWalkCourse()
            }
        }
        .onAppear {
            model.syncWalkCourse()
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
                                cornerRadius: theme.skin == .ma ? 4 : (theme.skin == .board ? 10 : 8),
                                style: .continuous
                            )
                            .stroke(Palette.warm, lineWidth: theme.skin == .ma ? 1.5 : 2)
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

    private var mapTrusted: Bool {
        spot.coordTrust == .lock || spot.coordTrust == .apple
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
                if let detail = SpotCopy.nonStoryDetail(spot.detail),
                   !SpotCopy.blurb(for: spot, in: model.station).contains(detail) {
                    Text(detail)
                        .font(.mincho(.callout))
                        .lineSpacing(5)
                        .foregroundStyle(Palette.mist)
                }
                if let station = model.station, let trace = StationLore.trace(for: spot, in: station) {
                    LoreTrace(text: trace, size: .callout)
                }
                // 観光のあとに、物語の紹介を別ブロックで出す（〔物語〕を本文に埋め込まない）
                let stories = SpotCopy.storyNotes(for: spot, in: model.station)
                if !stories.isEmpty {
                    Text("物語のゆかり")
                        .font(.mincho(.subheadline, weight: .semibold))
                        .foregroundStyle(Palette.ink)
                        .padding(.top, 6)
                    ForEach(Array(stories.enumerated()), id: \.offset) { _, note in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(note.title)
                                .font(.mincho(.callout, weight: .semibold))
                                .foregroundStyle(Palette.ink)
                            Text(note.body)
                                .font(.mincho(.callout))
                                .lineSpacing(5)
                                .foregroundStyle(Palette.fog)
                        }
                    }
                }

                if SpotHours.isShopLike(spot) {
                    Text("※営業状況は現地またはマップでご確認ください")
                        .font(.caption)
                        .foregroundStyle(Palette.mist)
                        .fixedSize(horizontal: false, vertical: true)
                }

                if !mapTrusted {
                    Text("地図上の正確な位置は未確定です。案内の文章と、マップ検索をあわせてご確認ください。")
                        .font(.caption)
                        .foregroundStyle(Palette.mist)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Text("場所")
                    .font(.mincho(.subheadline, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                    .padding(.top, 4)

                if mapTrusted {
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
                    .simultaneousGesture(DragGesture(minimumDistance: 0))
                    .accessibilityLabel("\(spot.name)の地図。指で動かしたり拡大できます")
                }

                Button(mapTrusted ? "Appleマップで開く" : "Appleマップで名前を検索") {
                    openInAppleMaps()
                }
                .buttonStyle(PrimaryButtonStyle(filled: false))

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
        var parts = ["\(spot.guide.label)", SpotDistance.caption(walkMinutes: spot.walkMinutes)]
        if let hours = SpotHours.display(for: spot) {
            parts.append("営業 \(hours)")
        }
        return parts.joined(separator: " · ")
    }

    private func openInAppleMaps() {
        if mapTrusted {
            let placemark = MKPlacemark(coordinate: coordinate)
            let item = MKMapItem(placemark: placemark)
            item.name = spot.name
            item.openInMaps()
            return
        }
        var comps = URLComponents(string: "http://maps.apple.com/")
        let near: String = {
            if let s = model.station {
                return "\(spot.name) \(s.name)駅"
            }
            return spot.name
        }()
        comps?.queryItems = [URLQueryItem(name: "q", value: near)]
        if let url = comps?.url {
            UIApplication.shared.open(url)
        }
    }
}

func mealMetaLine(_ spot: Spot) -> String {
    "\(spot.soloLabel) · \(spot.budgetYen) · \(spot.mealTier.label)"
}
