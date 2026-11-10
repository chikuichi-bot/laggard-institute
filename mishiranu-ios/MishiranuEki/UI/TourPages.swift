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
    var size: Font.TextStyle = .body
    var color: Color = Palette.fog
    var lineSpacing: CGFloat = 8
    var paragraphSpacing: CGFloat = 14

    var body: some View {
        VStack(alignment: .leading, spacing: paragraphSpacing) {
            ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                Text(line)
                    .font(.mincho(size))
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
            VStack(alignment: .leading, spacing: 6) {
                Text(note.title)
                    .font(.mincho(.callout, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                ReadingText(
                    lines: readingLines(note.body),
                    size: .footnote,
                    color: Palette.fog,
                    lineSpacing: 6,
                    paragraphSpacing: 8
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
            PlaceBoardHeader(station: station)
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        PlaceListenBar(narrator: narrator, station: station)

                        PlaceBoardIndex(
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
                                title: "この駅のこと",
                                accent: Palette.ink,
                                pictogram: nil
                            ) {
                                if !intro.isEmpty {
                                    ReadingText(
                                        lines: intro,
                                        size: .body,
                                        color: Palette.fog,
                                        lineSpacing: 8,
                                        paragraphSpacing: 12
                                    )
                                }
                                if station.mood == .empty, let empty = station.emptyCopy {
                                    Text(empty.headline)
                                        .font(.mincho(.callout, weight: .semibold))
                                        .foregroundStyle(Palette.ink)
                                        .padding(.top, intro.isEmpty ? 0 : 8)
                                    ReadingText(lines: readingLines(empty.body), size: .footnote, color: Palette.fog)
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
                                ReadingText(
                                    lines: walk,
                                    size: .body,
                                    color: Palette.fog,
                                    lineSpacing: 8,
                                    paragraphSpacing: 12
                                )
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
                                    ReadingText(
                                        lines: area,
                                        size: .body,
                                        color: Palette.fog,
                                        lineSpacing: 8,
                                        paragraphSpacing: 12
                                    )
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
                                .font(.footnote)
                                .foregroundStyle(Palette.mist)
                                .padding(.top, 8)
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.top, 12)
                    .padding(.bottom, 36)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .background(Color(hex: 0xefe8d6))
            }
        }
        .background(Palette.ink.ignoresSafeArea(edges: .top))
        .onChange(of: station.id) { _, _ in
            narrator.stop()
        }
        .onDisappear {
            narrator.stop()
        }
    }
}

/// 琺瑯案内板風の見出し帯。
private struct PlaceBoardHeader: View {
    @Environment(AppModel.self) private var model
    let station: Station

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button {
                model.startArrival()
            } label: {
                Text("← 駅を探し直す")
                    .font(.footnote)
                    .foregroundStyle(Palette.paper.opacity(0.7))
            }
            .buttonStyle(.plain)

            Text("\(station.prefecture) · \(station.line) · \(model.dayPart.label) · \(model.stay.label)")
                .font(.caption2)
                .foregroundStyle(Palette.paper.opacity(0.65))
                .lineLimit(2)

            VStack(alignment: .leading, spacing: 8) {
                Text("土地案内")
                    .font(.caption2.weight(.semibold))
                    .tracking(2)
                    .foregroundStyle(Palette.gold)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .overlay(
                        RoundedRectangle(cornerRadius: 2, style: .continuous)
                            .stroke(Palette.gold, lineWidth: 1)
                    )

                Text(station.name)
                    .font(.system(size: 30, weight: .medium, design: .serif))
                    .foregroundStyle(Palette.paper)
                    .tracking(1)

                Text(model.selectedCourse?.title ?? station.tourTitle)
                    .font(.mincho(.subheadline))
                    .foregroundStyle(Palette.paper.opacity(0.85))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Color(hex: 0x2a2622))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(Palette.gold.opacity(0.45), lineWidth: 1)
            )
        }
        .padding(.horizontal, 14)
        .padding(.top, 8)
        .padding(.bottom, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.ink)
    }
}

private struct PlaceBoardIndex: View {
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
            .init(id: .intro, number: "01", label: "導入", enabled: hasIntro),
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
                    VStack(spacing: 2) {
                        Text(item.number)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(item.enabled ? Palette.warm : Palette.mist)
                            .monospacedDigit()
                        Text(item.label)
                            .font(.caption2)
                            .foregroundStyle(item.enabled ? Palette.fog : Palette.mist)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
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
    let accent: Color
    let pictogram: Pictogram?
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Text(number)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Palette.warm)
                    .monospacedDigit()
                if let pictogram {
                    PictogramIcon(pictogram, size: 16)
                        .foregroundStyle(Palette.ink)
                }
                Text(title)
                    .font(.mincho(.callout, weight: .semibold))
                    .foregroundStyle(Palette.ink)
            }
            .padding(.bottom, 6)
            .overlay(alignment: .bottom) {
                Rectangle().fill(Palette.line).frame(height: 1)
            }

            content
        }
        .padding(12)
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
            HStack(spacing: 12) {
                Image(systemName: narrator.isSpeaking ? "stop.fill" : "speaker.wave.2.fill")
                    .font(.body.weight(.semibold))
                    .frame(width: 22, height: 22)
                VStack(alignment: .leading, spacing: 2) {
                    Text(narrator.isSpeaking ? "読み上げを止める" : "土地案内を聞く")
                        .font(.mincho(.body, weight: .semibold))
                    Text(narrator.isSpeaking ? "もう一度押すと止まります" : "駅に着く前に、イヤホンで")
                        .font(.caption)
                        .foregroundStyle(Palette.paper.opacity(0.85))
                }
                Spacer(minLength: 0)
            }
            .foregroundStyle(Palette.paper)
            .padding(.vertical, 14)
            .padding(.horizontal, 16)
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

// MARK: - 歩く

struct WalkPage: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        PageScroll {
            if let course = model.selectedCourse {
                Kicker(text: "COURSE", pictogram: .trekking)
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
                            StopRow(index: index, stop: stop, isLast: index == course.stops.count - 1)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.top, 4)
            } else {
                Kicker(text: "FREE WALK", pictogram: .trekking)
                Text("コースは作っていません")
                    .font(.mincho(.title2, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                Text("地図と観光から、気になった場所だけ寄り道できます。あとから会話をやり直してコースを選ぶこともできます。")
                    .font(.mincho(.callout))
                    .lineSpacing(4)
                    .foregroundStyle(Palette.fog)
                Button("会話をやり直す") { model.startArrival() }
                    .buttonStyle(PrimaryButtonStyle(filled: false))
            }
        }
    }
}

private struct StopRow: View {
    let index: Int
    let stop: CourseStop
    let isLast: Bool

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
            VStack(alignment: .leading, spacing: 4) {
                Text("\(stop.clockLabel) · \(stop.spot.name)")
                    .font(.mincho(.headline, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                HStack(spacing: 4) {
                    PictogramIcon(stop.spot.guide.pictogram, size: 14)
                        .foregroundStyle(stop.spot.guide.color)
                    Text("\(stop.spot.guide.label) · 徒歩約 \(stop.walkMinutes) 分 · 滞在目安 \(stop.dwellMinutes) 分")
                        .font(.caption)
                        .foregroundStyle(Palette.mist)
                }
                Text(stop.spot.blurb)
                    .font(.mincho(.footnote))
                    .foregroundStyle(Palette.fog)
                    .lineLimit(2)
            }
            .padding(.bottom, 18)
            Spacer(minLength: 0)
        }
        .contentShape(Rectangle())
    }
}

// MARK: - 案内

struct GuidePage: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let kind = model.guideKind
        let items = model.guideSpots(kind)
        VStack(spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(GuideKind.order) { option in
                        let active = option == kind
                        Button {
                            model.guideKind = option
                        } label: {
                            HStack(spacing: 6) {
                                PictogramIcon(option.pictogram, size: 16)
                                Text(option.label)
                            }
                            .font(.subheadline.weight(active ? .semibold : .regular))
                            .foregroundStyle(active ? Palette.paper : option.color)
                            .padding(.vertical, 8)
                            .padding(.horizontal, 12)
                            .background(Capsule().fill(active ? option.color : Palette.paper))
                            .overlay(Capsule().stroke(active ? Color.clear : Palette.line, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }

            PageScroll {
                if kind == .meal && model.hasMealPrefs {
                    Text("希望: \(model.mealPrefs.solo.label) · \(model.mealPrefs.budget.label)")
                        .font(.caption)
                        .foregroundStyle(Palette.warm)
                }
                if items.isEmpty {
                    Text("この徒歩圏・時間ではまだ少なめです。時間を延ばすと増えることがあります。")
                        .font(.footnote)
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

private struct GuideRow: View {
    let spot: Spot
    let match: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                PictogramIcon(spot.guide.pictogram, size: 16)
                    .foregroundStyle(spot.guide.color)
                Text(spot.name)
                    .font(.mincho(.headline, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                Spacer(minLength: 0)
                if match {
                    Text("希望に近い")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(Palette.paper)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
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
                .font(.mincho(.footnote))
                .foregroundStyle(Palette.fog)
                .lineLimit(2)
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

// MARK: - ほか

struct MorePage: View {
    @Environment(AppModel.self) private var model
    let station: Station
    @State private var copied = false

    var body: some View {
        let bike = station.bikeRental
        PageScroll {
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
                    .lineSpacing(4)
                    .foregroundStyle(Palette.fog)
                ForEach(bike.places ?? [], id: \.name) { place in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(place.name)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Palette.ink)
                        if let minutes = place.walkMinutes {
                            Text("徒歩約 \(minutes) 分").font(.caption).foregroundStyle(Palette.mist)
                        }
                        if let note = place.note {
                            Text(note).font(.caption).foregroundStyle(Palette.fog)
                        }
                    }
                }
            }

            VStack(spacing: 10) {
                Button {
                    model.drawSecret()
                } label: {
                    Label {
                        Text("とりあえずここに行け")
                    } icon: {
                        PictogramIcon(.approved, size: 18)
                    }
                }
                .buttonStyle(PrimaryButtonStyle())

                Button(copied ? "コピーしました" : "物語をコピー") {
                    UIPasteboard.general.string = model.shareText
                    copied = true
                }
                .buttonStyle(PrimaryButtonStyle(filled: false))

                ShareLink(item: model.shareText) {
                    Text("共有する")
                }
                .buttonStyle(PrimaryButtonStyle(filled: false))

                Button("駅を探し直す") { model.startArrival() }
                    .buttonStyle(PrimaryButtonStyle(filled: false))
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

            VStack(alignment: .leading, spacing: 4) {
                Text("地図は Apple マップ。出町柳ピンは実座標寄り、ほかの駅は目安の位置です。")
                Text("ピクトグラム素材提供：日本デザインセンター／EXPERIENCE JAPAN PICTOGRAMS")
                Link("experience-japan.info", destination: URL(string: "https://experience-japan.info/")!)
            }
            .font(.caption2)
            .foregroundStyle(Palette.mist)
        }
        .onChange(of: station.id) { copied = false }
    }
}
