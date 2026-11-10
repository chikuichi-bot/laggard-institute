import SwiftUI

struct TourView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        VStack(spacing: 0) {
            if let station = model.station {
                TourHeader(station: station)
                Group {
                    switch model.tourTab {
                    case .map: TourMapPage(station: station)
                    case .place: PlacePage(station: station)
                    case .walk: WalkPage()
                    case .guide: GuidePage()
                    case .more: MorePage(station: station)
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

private struct TourHeader: View {
    @Environment(AppModel.self) private var model
    let station: Station

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Button {
                model.startArrival()
            } label: {
                Text("← 駅を探し直す")
                    .font(.footnote)
                    .foregroundStyle(Palette.mist)
            }
            .padding(.bottom, 2)
            Text("\(station.prefecture) · \(station.line) · \(model.dayPart.label) · \(model.stay.label)")
                .font(.caption2)
                .foregroundStyle(Palette.mist)
                .lineLimit(1)
            Text(station.name)
                .font(.system(size: 28, weight: .semibold, design: .serif))
                .foregroundStyle(Palette.ink)
            Text(model.selectedCourse?.title ?? station.tourTitle)
                .font(.mincho(.subheadline))
                .foregroundStyle(Palette.fog)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.top, 6)
        .padding(.bottom, 12)
        .background(Palette.paper)
        .overlay(alignment: .bottom) { Divider().overlay(Palette.line) }
    }
}

struct TourTabBar: View {
    @Binding var selection: TourTab

    var body: some View {
        HStack(spacing: 0) {
            ForEach(TourTab.allCases) { tab in
                let active = selection == tab
                Button {
                    selection = tab
                } label: {
                    VStack(spacing: 4) {
                        PictogramIcon(tab.pictogram, size: 24)
                        Text(tab.label)
                            .font(.caption2.weight(active ? .semibold : .regular))
                    }
                    .foregroundStyle(active ? Palette.warm : Palette.mist)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 8)
                    .padding(.bottom, 4)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tab.label)
                .accessibilityAddTraits(active ? .isSelected : [])
            }
        }
        .background(Palette.paper.ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) { Divider().overlay(Palette.line) }
    }
}

struct SpotSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let spot: Spot

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 6) {
                    PictogramIcon(spot.guide.pictogram, size: 18)
                        .foregroundStyle(spot.guide.color)
                    Text(metaLine)
                        .font(.caption)
                        .foregroundStyle(Palette.mist)
                }
                if spot.guide == .meal {
                    Text(mealMetaLine(spot))
                        .font(.caption)
                        .foregroundStyle(Palette.warm)
                }
                if let number = model.courseNumbers[spot.id] {
                    Text("コースの \(number) か所目")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Palette.paper)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(Palette.warm))
                }
                Text(spot.name)
                    .font(.mincho(.title2, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                Text(spot.blurb)
                    .font(.mincho(.body))
                    .lineSpacing(5)
                    .foregroundStyle(Palette.fog)
                if let detail = spot.detail {
                    Text(detail)
                        .font(.mincho(.callout))
                        .lineSpacing(5)
                        .foregroundStyle(Palette.mist)
                }
                Button("閉じる") { dismiss() }
                    .buttonStyle(PrimaryButtonStyle())
                    .padding(.top, 8)
            }
            .padding(24)
        }
    }

    private var metaLine: String {
        var parts = ["\(spot.guide.label)", "徒歩約 \(spot.walkMinutes) 分"]
        if let hours = spot.hours { parts.append(hours) }
        return parts.joined(separator: " · ")
    }
}

func mealMetaLine(_ spot: Spot) -> String {
    "\(spot.soloLabel) · \(spot.budgetYen) · \(spot.mealTier.label)"
}
