import SwiftUI
import UIKit

private struct PageScroll<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                content
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

/// 句点で区切って、画面上の段落にする（土地ページの読みやすさ用）。
private func readingLines(_ text: String?) -> [String] {
    paragraphs(text).flatMap { block -> [String] in
        var lines: [String] = []
        var current = ""
        for character in block {
            current.append(character)
            if "。！？".contains(character) {
                let trimmed = current.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty { lines.append(trimmed) }
                current = ""
            }
        }
        let rest = current.trimmingCharacters(in: .whitespacesAndNewlines)
        if !rest.isEmpty { lines.append(rest) }
        return lines.isEmpty ? [block] : lines
    }
}

private struct ReadingText: View {
    let lines: [String]
    /// 土地案内の本文。Dynamic Type 下限で十分大きくなるので body 基準。
    var size: Font.TextStyle = .body
    /// 土地案内の本文は、真っ黒・太字にせず和紙に馴染ませる。
    var color: Color = Palette.body
    var weight: Font.Weight = .regular
    var lineSpacing: CGFloat = 7
    var paragraphSpacing: CGFloat = 14

    var body: some View {
        VStack(alignment: .leading, spacing: paragraphSpacing) {
            ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                Text(line)
                    .font(.mincho(size, weight: weight))
                    .lineSpacing(lineSpacing)
                    .foregroundStyle(color)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

private struct PlaceBoardNote: View {
    let index: Int
    let note: HistoryNote

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Text(String(format: "%02d", index))
                .font(.caption.weight(.semibold))
                .tracking(0.5)
                .foregroundStyle(Palette.warm)
                .monospacedDigit()
                .frame(width: 26, alignment: .leading)
            VStack(alignment: .leading, spacing: 8) {
                Text(note.title)
                    .font(.mincho(.headline, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                ReadingText(
                    lines: readingLines(note.body),
                    size: .body,
                    color: Palette.body,
                    lineSpacing: 7,
                    paragraphSpacing: 12
                )
            }
        }
    }
}

private enum PlaceBoardSection: String, Hashable {
    case intro, walk, history, sight
}

// MARK: - 土地（A · 駅前案内板）

struct PlacePage: View {
    @Environment(AppModel.self) private var model
    let station: Station
    @State private var narrator = PlaceNarrator()

    var body: some View {
        let intro = readingLines(station.stationIntro)
        let walk = readingLines(station.walkGuide)
        let area = readingLines(station.areaAbout)
        let hasIntro = !intro.isEmpty || (station.mood == .empty && station.emptyCopy != nil)
        let hasWalk = !walk.isEmpty
        let hasHistory = !area.isEmpty || !station.historyNotes.isEmpty
        let hasSight = !station.sightseeingNotes.isEmpty

        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        PlaceListenBar(narrator: narrator, station: station)

                        PlaceBoardIndex(
                            stationLabel: station.indexStationLabel,
                            hasIntro: hasIntro,
                            hasWalk: hasWalk,
                            hasHistory: hasHistory,
                            hasSight: hasSight
                        ) { section in
                            withAnimation(.easeInOut(duration: 0.25)) {
                                proxy.scrollTo(section, anchor: .top)
                            }
                        }

                        if hasIntro {
                            PlaceBoardPanel(
                                number: "01",
                                title: station.aboutTitle,
                                reading: station.displayNameReading,
                                accent: Palette.ink,
                                pictogram: nil
                            ) {
                                if !intro.isEmpty {
                                    ReadingText(lines: intro)
                                }
                                if station.mood == .empty, let empty = station.emptyCopy {
                                    Text(empty.headline)
                                        .font(.mincho(.headline, weight: .semibold))
                                        .foregroundStyle(Palette.ink)
                                        .padding(.top, intro.isEmpty ? 0 : 8)
                                    ReadingText(lines: readingLines(empty.body))
                                }
                            }
                            .id(PlaceBoardSection.intro)
                        }

                        if hasWalk {
                            PlaceBoardPanel(
                                number: "02",
                                title: "歩き方の目安",
                                accent: Palette.moss,
                                pictogram: .trekking
                            ) {
                                ReadingText(lines: walk)
                            }
                            .id(PlaceBoardSection.walk)
                        }

                        if hasHistory {
                            PlaceBoardPanel(
                                number: "03",
                                title: "このエリアのこと・歴史",
                                accent: Palette.ink,
                                pictogram: .history
                            ) {
                                if !area.isEmpty {
                                    ReadingText(lines: area)
                                }
                                if !station.historyNotes.isEmpty {
                                    VStack(alignment: .leading, spacing: 14) {
                                        ForEach(
                                            Array(station.historyNotes.enumerated()),
                                            id: \.element.title
                                        ) { index, note in
                                            PlaceBoardNote(index: index + 1, note: note)
                                        }
                                    }
                                    .padding(.top, area.isEmpty ? 0 : 8)
                                }
                            }
                            .id(PlaceBoardSection.history)
                        }

                        if hasSight {
                            PlaceBoardPanel(
                                number: "04",
                                title: "観光案内メモ",
                                accent: Palette.ink,
                                pictogram: .photoSpot
                            ) {
                                VStack(alignment: .leading, spacing: 14) {
                                    ForEach(
                                        Array(station.sightseeingNotes.enumerated()),
                                        id: \.element.title
                                    ) { index, note in
                                        PlaceBoardNote(index: index + 1, note: note)
                                    }
                                }
                            }
                            .id(PlaceBoardSection.sight)
                        }

                        if !hasIntro && !hasWalk && !hasHistory && !hasSight {
                            Text("この駅の土地メモはまだ少なめです。")
                                .font(.callout)
                                .foregroundStyle(Palette.mist)
                                .padding(.top, 8)
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.top, 12)
                    .padding(.bottom, 36)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .background(Palette.canvas)
            }
        }
        .background(Palette.canvas)
        .onChange(of: station.id) { _, _ in
            narrator.stop()
        }
        .onDisappear {
            narrator.stop()
        }
    }
}

private struct PlaceBoardIndex: View {
    let stationLabel: String
    let hasIntro: Bool
    let hasWalk: Bool
    let hasHistory: Bool
    let hasSight: Bool
    let onSelect: (PlaceBoardSection) -> Void

    private struct IndexItem: Identifiable {
        let id: PlaceBoardSection
        let number: String
        let label: String
        let enabled: Bool
    }

    var body: some View {
        let items: [IndexItem] = [
            .init(id: .intro, number: "01", label: stationLabel, enabled: hasIntro),
            .init(id: .walk, number: "02", label: "歩き方", enabled: hasWalk),
            .init(id: .history, number: "03", label: "歴史", enabled: hasHistory),
            .init(id: .sight, number: "04", label: "観光", enabled: hasSight),
        ]
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 6) {
            ForEach(items) { item in
                Button {
                    guard item.enabled else { return }
                    onSelect(item.id)
                } label: {
                    VStack(spacing: 3) {
                        Text(item.number)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(item.enabled ? Palette.warm : Palette.mist)
                            .monospacedDigit()
                        Text(item.label)
                            .font(.footnote)
                            .foregroundStyle(item.enabled ? Palette.fog : Palette.mist)
                            .lineLimit(1)
                            .minimumScaleFactor(0.9)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Palette.paper)
                    .overlay(
                        RoundedRectangle(cornerRadius: 4, style: .continuous)
                            .stroke(Palette.line, lineWidth: 1)
                    )
                    .opacity(item.enabled ? 1 : 0.45)
                }
                .buttonStyle(.plain)
                .disabled(!item.enabled)
                .accessibilityLabel("\(item.number) \(item.label)")
            }
        }
    }
}

private struct PlaceBoardPanel<Content: View>: View {
    let number: String
    let title: String
    var reading: String? = nil
    let accent: Color
    let pictogram: Pictogram?
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 8) {
                Text(number)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Palette.warm)
                    .monospacedDigit()
                    .padding(.top, reading == nil ? 0 : 2)
                if let pictogram {
                    PictogramIcon(pictogram, size: 18)
                        .foregroundStyle(Palette.ink)
                        .padding(.top, reading == nil ? 0 : 2)
                }
                VStack(alignment: .leading, spacing: 2) {
                    if let reading, !reading.isEmpty {
                        Text(reading)
                            .font(.caption)
                            .foregroundStyle(Palette.mist)
                            .tracking(0.6)
                    }
                    Text(title)
                        .font(.mincho(.headline, weight: .semibold))
                        .foregroundStyle(Palette.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.bottom, 8)
            .overlay(alignment: .bottom) {
                Rectangle().fill(Palette.line).frame(height: 1)
            }

            content
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.paper)
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(accent)
                .frame(width: 4)
        }
        .overlay(
            Rectangle()
                .stroke(Color(hex: 0xd8c9b2), lineWidth: 1)
        )
    }
}

/// 電車のイヤホン向け。押すと土地案内を読み上げ／もう一度で停止。
private struct PlaceListenBar: View {
    let narrator: PlaceNarrator
    let station: Station

    var body: some View {
        Button {
            narrator.toggle(station: station)
        } label: {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: narrator.isSpeaking ? "stop.fill" : "speaker.wave.2.fill")
                    .font(.title3.weight(.semibold))
                    .frame(width: 24, height: 24)
                VStack(alignment: .leading, spacing: 3) {
                    Text(narrator.isSpeaking ? "読み上げを止める" : "土地案内を聞く")
                        .font(.mincho(.body, weight: .semibold))
                        .fixedSize(horizontal: false, vertical: true)
                    Text(narrator.isSpeaking ? "もう一度押すと止まります" : "駅に着く前に、イヤホンで")
                        .font(.caption)
                        .foregroundStyle(Palette.paper.opacity(0.85))
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .foregroundStyle(Palette.paper)
            .padding(.vertical, 14)
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(narrator.isSpeaking ? Palette.warmDeep : Palette.warm)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(narrator.isSpeaking ? "読み上げを止める" : "土地案内を聞く")
        .accessibilityHint("駅の土地の文章を音声で読み上げます")
    }
}

/// 歩く途中で目に留める、土地の記憶の一文。
struct LoreTrace: View {
    let text: String
    var size: Font.TextStyle = .footnote

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Rectangle()
                .fill(Palette.warm.opacity(0.7))
                .frame(width: 2)
            VStack(alignment: .leading, spacing: 3) {
                Text("土地の記憶")
                    .font(.caption2.weight(.semibold))
                    .tracking(0.5)
                    .foregroundStyle(Palette.warm)
                Text(text)
                    .font(.mincho(size))
                    .lineSpacing(4)
                    .foregroundStyle(Palette.body)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.top, 4)
    }
}

// MARK: - 歩く

struct WalkPage: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        PageScroll {
            if let course = model.selectedCourse {
                Kicker(text: "WALK", pictogram: .trekking)
                Text(course.title)
                    .font(.mincho(.title2, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                Text("\(course.subtitle) · \(model.dayPart.label)スタート · 約\(course.totalMinutes)分 · \(course.stops.count)か所")
                    .font(.caption)
                    .foregroundStyle(Palette.mist)
                Text(course.vibe)
                    .font(.mincho(.callout))
                    .foregroundStyle(Palette.fog)
                VStack(spacing: 0) {
                    ForEach(Array(course.stops.enumerated()), id: \.element.id) { index, stop in
                        Button {
                            model.openSpot(stop.spot)
                        } label: {
                            StopRow(
                                index: index,
                                stop: stop,
                                isLast: index == course.stops.count - 1,
                                trace: model.station.flatMap { StationLore.trace(for: stop.spot, in: $0) }
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.top, 4)
            } else {
                Kicker(text: "FREE WALK", pictogram: .trekking)
                Text("まわり方は、まだ決めていません")
                    .font(.mincho(.title2, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                Text("地図と観光から、気になった場所だけ寄り道できます。あとから会話をやり直して、まわり方を選ぶこともできます。")
                    .font(.mincho(.body))
                    .lineSpacing(8)
                    .foregroundStyle(Palette.fog)
                Button("会話をやり直す") { model.startArrival() }
                    .buttonStyle(PrimaryButtonStyle(filled: false))
            }
        }
    }
}

private struct StopRow: View {
    @Environment(AppModel.self) private var model
    let index: Int
    let stop: CourseStop
    let isLast: Bool
    var trace: String? = nil

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(spacing: 0) {
                Text("\(index + 1)")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Palette.paper)
                    .frame(width: 30, height: 30)
                    .background(Circle().fill(Palette.warm))
                if !isLast {
                    Rectangle()
                        .fill(Palette.taupe)
                        .frame(width: 2)
                        .frame(maxHeight: .infinity)
                }
            }
            VStack(alignment: .leading, spacing: 6) {
                Text("\(stop.clockLabel) · \(stop.spot.name)")
                    .font(.mincho(.headline, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    PictogramIcon(stop.spot.guide.pictogram, size: 16)
                        .foregroundStyle(stop.spot.guide.color)
                    Text("\(stop.spot.guide.label) · 徒歩約 \(stop.walkMinutes) 分 · 滞在目安 \(stop.dwellMinutes) 分")
                        .font(.caption)
                        .foregroundStyle(Palette.mist)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Text(SpotCopy.blurb(for: stop.spot, in: model.station))
                    .font(.mincho(.callout))
                    .foregroundStyle(Palette.fog)
                    .fixedSize(horizontal: false, vertical: true)
                    .lineLimit(4)
                if let trace {
                    LoreTrace(text: trace)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.bottom, 18)
        }
        .contentShape(Rectangle())
    }
}

// MARK: - 案内

struct GuidePage: View {
    @Environment(AppModel.self) private var model
    let station: Station

    private var bikeColor: Color { Palette.moss }

    var body: some View {
        let kind = model.guideKind
        let showBike = model.guideShowsBike
        let items = model.guideSpots(kind)
        VStack(spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(GuideKind.order) { option in
                        let active = !showBike && option == kind
                        Button {
                            model.guideShowsBike = false
                            model.guideKind = option
                        } label: {
                            guideChip(
                                label: option.label,
                                pictogram: option.pictogram,
                                color: option.color,
                                active: active
                            )
                        }
                        .buttonStyle(.plain)
                    }

                    let bikeActive = showBike
                    Button {
                        model.guideShowsBike = true
                    } label: {
                        guideChip(
                            label: "レンタサイクル",
                            pictogram: .bicycleRental,
                            color: bikeColor,
                            active: bikeActive
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("レンタサイクル")
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }

            PageScroll {
                if showBike {
                    BikeRentalCard(bike: station.bikeRental)
                } else {
                    if kind == .meal && model.hasMealPrefs {
                        Text("希望: \(model.mealPrefs.solo.label) · \(model.mealPrefs.budget.label)")
                            .font(.caption)
                            .foregroundStyle(Palette.warm)
                    }
                    if items.isEmpty {
                        Text(
                            kind == .souvenir
                                ? "お土産の候補は、まだ少なめです。門前の菓子屋・社務所の授与品も現地で探してみてください。"
                                : "この徒歩圏ではまだ少なめです。別の案内タブも見てみてください。"
                        )
                            .font(.callout)
                            .foregroundStyle(Palette.mist)
                    }
                    ForEach(items) { spot in
                        let score = kind == .meal ? CourseBuilder.mealPrefScore(spot, prefs: model.mealPrefs) : 0
                        Button {
                            model.openSpot(spot)
                        } label: {
                            GuideRow(spot: spot, match: score > 0)
                                .opacity(score < 0 ? 0.55 : 1)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func guideChip(
        label: String,
        pictogram: Pictogram,
        color: Color,
        active: Bool
    ) -> some View {
        HStack(spacing: 8) {
            PictogramIcon(pictogram, size: 17)
            Text(label)
        }
        .font(.subheadline.weight(active ? .semibold : .regular))
        .foregroundStyle(active ? Palette.paper : color)
        .padding(.vertical, 9)
        .padding(.horizontal, 13)
        .background(Capsule().fill(active ? color : Palette.paper))
        .overlay(Capsule().stroke(active ? Color.clear : Palette.line, lineWidth: 1))
    }
}

private struct BikeRentalCard: View {
    let bike: BikeRental

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Card {
                Kicker(text: "MOBILITY", pictogram: .bicycleRental)
                Text("レンタサイクル")
                    .font(.mincho(.title3, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                Text(bike.available ? "駅周辺で借りられます" : "いまは未確認／少なめ")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(bike.available ? Palette.moss : Palette.mist)
                Text(bike.summary)
                    .font(.mincho(.callout))
                    .lineSpacing(5)
                    .foregroundStyle(Palette.fog)
            }

            bikeGroup(kind: .local, places: bike.places(kind: .local))
            bikeGroup(kind: .app, places: bike.places(kind: .app))
        }
    }

    @ViewBuilder
    private func bikeGroup(kind: BikeRentalKind, places: [BikeRentalPlace]) -> some View {
        Card {
            Text(kind.label)
                .font(.readable(.subheadline, weight: .semibold))
                .foregroundStyle(Palette.ink)
            Text(kind.hint)
                .font(.caption)
                .foregroundStyle(Palette.mist)
            if places.isEmpty {
                Text(
                    kind == .local
                        ? "地元店の具体名は、まだ少なめです。観光案内所や駅掲示も見てください。"
                        : "アプリ型のポート情報は、まだ少なめです。HELLO CYCLING など地域のアプリを確認してください。"
                )
                .font(.callout)
                .foregroundStyle(Palette.fog)
            } else {
                ForEach(places, id: \.name) { place in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(place.name)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Palette.ink)
                        if let minutes = place.walkMinutes {
                            Text("徒歩約 \(minutes) 分")
                                .font(.caption)
                                .foregroundStyle(Palette.mist)
                        }
                        if let note = place.note {
                            Text(note)
                                .font(.caption)
                                .foregroundStyle(Palette.fog)
                        }
                    }
                    .padding(.top, 4)
                }
            }
        }
    }
}

private struct GuideRow: View {
    let spot: Spot
    let match: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                PictogramIcon(spot.guide.pictogram, size: 18)
                    .foregroundStyle(spot.guide.color)
                Text(spot.name)
                    .font(.mincho(.headline, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                Spacer(minLength: 0)
                if match {
                    Text("希望に近い")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(Palette.paper)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Capsule().fill(Palette.moss))
                }
            }
            Text("徒歩約 \(spot.walkMinutes) 分" + (spot.hours.map { " · \($0)" } ?? ""))
                .font(.caption)
                .foregroundStyle(Palette.mist)
            if spot.guide == .meal {
                Text(mealMetaLine(spot))
                    .font(.caption)
                    .foregroundStyle(Palette.warm)
            }
            Text(spot.blurb)
                .font(.mincho(.callout))
                .foregroundStyle(Palette.fog)
                .fixedSize(horizontal: false, vertical: true)
                .lineLimit(5)
            // detail が住所だけのときは、説明と重複しやすいので出さない
            if let detail = spot.detail, !detail.isEmpty,
               !spot.blurb.contains(detail), detail.count > 8 {
                Text(detail)
                    .font(.mincho(.footnote))
                    .foregroundStyle(Palette.mist)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Palette.paper))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(match ? Palette.moss.opacity(0.6) : Palette.line, lineWidth: 1)
        )
        .contentShape(Rectangle())
    }
}

// MARK: - 設定（旧・ほか。項目を増やしていく場所）

struct SettingsPage: View {
    @Environment(AppModel.self) private var model
    @Environment(ThemeStore.self) private var theme
    let station: Station
    @State private var copied = false

    var body: some View {
        @Bindable var theme = theme
        PageScroll {
            Text("設定")
                .font(.mincho(.title2, weight: .semibold))
                .foregroundStyle(Palette.ink)

            settingsGroup(title: "この駅") {
                settingsRow(title: "いまの駅", detail: "\(station.name) · \(station.prefecture)")
                Button {
                    model.requestAiStation(station.name)
                } label: {
                    settingsButtonLabel("案内を作り直す（AI）", pictogram: .train)
                }
                .buttonStyle(.plain)
                .disabled(model.stationLoading)
                Button {
                    model.startArrival()
                } label: {
                    settingsButtonLabel("駅を探し直す", pictogram: .search)
                }
                .buttonStyle(.plain)
            }

            settingsGroup(title: "見た目") {
                VStack(alignment: .leading, spacing: 10) {
                    Text("案内の色と空気")
                        .font(.mincho(.body))
                        .foregroundStyle(Palette.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    HStack(spacing: 8) {
                        ForEach(AppSkin.allCases) { skin in
                            Button {
                                theme.skin = skin
                            } label: {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("\(skin.codeLabel) · \(skin.label)")
                                        .font(.readable(.subheadline, weight: .semibold))
                                    Text(skin.blurb)
                                        .font(.readable(.caption2))
                                        .foregroundStyle(
                                            theme.skin == skin ? Palette.paper.opacity(0.85) : Palette.mist
                                        )
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(12)
                                .foregroundStyle(theme.skin == skin ? Palette.paper : Palette.ink)
                                .background(
                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                        .fill(theme.skin == skin ? Palette.warm : Palette.canvas)
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                        .stroke(
                                            theme.skin == skin ? Color.clear : Palette.line,
                                            lineWidth: 1
                                        )
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(14)
            }

            settingsGroup(title: "物語・寄り道") {
                Button {
                    model.drawSecret()
                } label: {
                    settingsButtonLabel("とりあえずここに行け", pictogram: .approved)
                }
                .buttonStyle(.plain)

                Button {
                    UIPasteboard.general.string = model.shareText
                    copied = true
                } label: {
                    settingsButtonLabel(copied ? "コピーしました" : "物語をコピー", pictogram: .information)
                }
                .buttonStyle(.plain)

                ShareLink(item: model.shareText) {
                    settingsButtonLabel("共有する", pictogram: .meetingPoint)
                }
                .buttonStyle(.plain)
            }

            if let secret = model.secret {
                Card {
                    Text("SECRET DESTINATION")
                        .font(.caption2.weight(.semibold))
                        .tracking(1.6)
                        .foregroundStyle(Palette.gold)
                    Text(secret.name)
                        .font(.mincho(.title3, weight: .semibold))
                        .foregroundStyle(Palette.ink)
                    Text(secret.blurb)
                        .font(.mincho(.callout))
                        .foregroundStyle(Palette.fog)
                    Button("もう一回ひく") { model.drawSecret() }
                        .buttonStyle(ChipButtonStyle())
                }
            }

            settingsGroup(title: "表示") {
                settingsRow(title: "文字の大きさ", detail: "システム設定に合わせる")
                settingsRow(title: "地図の詳細", detail: "準備中")
            }

            if model.messages.count > 1 {
                DisclosureGroup("これまでの会話") {
                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(model.messages) { ChatBubble(message: $0) }
                    }
                    .padding(.top, 8)
                }
                .font(.mincho(.subheadline, weight: .semibold))
                .foregroundStyle(Palette.ink)
            }

            settingsGroup(title: "このアプリについて") {
                Text("地図は Apple マップ。出町柳ピンは実座標寄り、ほかの駅は目安の位置です。")
                    .font(.caption)
                    .foregroundStyle(Palette.mist)
                    .fixedSize(horizontal: false, vertical: true)
                Text("ピクトグラム素材提供：日本デザインセンター／EXPERIENCE JAPAN PICTOGRAMS")
                    .font(.caption)
                    .foregroundStyle(Palette.mist)
                    .fixedSize(horizontal: false, vertical: true)
                Link("experience-japan.info", destination: URL(string: "https://experience-japan.info/")!)
                    .font(.caption)
            }
        }
        .onChange(of: station.id) { copied = false }
    }

    private func settingsGroup<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.readable(.caption, weight: .semibold))
                .foregroundStyle(Palette.mist)
                .textCase(.none)
            VStack(spacing: 0) {
                content()
            }
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Palette.paper))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Palette.line, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }

    private func settingsRow(title: String, detail: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.mincho(.body))
                .foregroundStyle(Palette.ink)
            Spacer(minLength: 8)
            Text(detail)
                .font(.readable(.caption))
                .foregroundStyle(Palette.mist)
                .multilineTextAlignment(.trailing)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }

    private func settingsButtonLabel(_ title: String, pictogram: Pictogram) -> some View {
        HStack(spacing: 10) {
            PictogramIcon(pictogram, size: 18)
                .foregroundStyle(Palette.warm)
            Text(title)
                .font(.mincho(.body))
                .foregroundStyle(Palette.ink)
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Palette.mist)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .contentShape(Rectangle())
    }
}
