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

private struct PlaceSectionHeader: View {
    let kicker: String
    let title: String
    let pictogram: Pictogram

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Kicker(text: kicker, pictogram: pictogram)
            Text(title)
                .font(.mincho(.title2, weight: .semibold))
                .foregroundStyle(Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

private struct PlaceNote: View {
    let index: Int
    let note: HistoryNote

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(String(format: "%02d", index))
                    .font(.caption.weight(.semibold))
                    .tracking(1)
                    .foregroundStyle(Palette.warm)
                    .monospacedDigit()
                Text(note.title)
                    .font(.mincho(.title3, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            ReadingText(lines: readingLines(note.body), size: .body, color: Palette.fog, lineSpacing: 8, paragraphSpacing: 12)
                .padding(.leading, 30)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - 土地

struct PlacePage: View {
    let station: Station
    @State private var narrator = PlaceNarrator()

    var body: some View {
        let area = readingLines(station.areaAbout)
        let intro = readingLines(station.stationIntro)
        let walk = readingLines(station.walkGuide)
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                PlaceListenBar(narrator: narrator, station: station)
                    .padding(.bottom, 22)

                if !intro.isEmpty {
                    ReadingText(lines: intro, size: .title3, color: Palette.ink, lineSpacing: 10, paragraphSpacing: 18)
                        .padding(.bottom, 28)
                }

                if !walk.isEmpty {
                    placeRule
                    VStack(alignment: .leading, spacing: 16) {
                        HStack(spacing: 8) {
                            PictogramIcon(.trekking, size: 20).foregroundStyle(Palette.moss)
                            Text("歩き方の目安")
                                .font(.mincho(.title3, weight: .semibold))
                                .foregroundStyle(Palette.ink)
                        }
                        ReadingText(lines: walk, size: .body, color: Palette.fog, lineSpacing: 8, paragraphSpacing: 14)
                    }
                    .padding(.vertical, 22)
                    .padding(.horizontal, 16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 4, style: .continuous)
                            .fill(Palette.moss.opacity(0.08))
                    )
                    .padding(.bottom, 32)
                }

                if station.mood == .empty, let empty = station.emptyCopy {
                    placeRule
                    VStack(alignment: .leading, spacing: 14) {
                        Text(empty.headline)
                            .font(.mincho(.title3, weight: .semibold))
                            .foregroundStyle(Palette.ink)
                        ReadingText(lines: readingLines(empty.body), size: .body, color: Palette.fog)
                    }
                    .padding(.vertical, 24)
                }

                if !area.isEmpty || !station.historyNotes.isEmpty {
                    placeRule
                    VStack(alignment: .leading, spacing: 20) {
                        PlaceSectionHeader(
                            kicker: "AREA · HISTORY",
                            title: "このエリアのこと・歴史",
                            pictogram: .history
                        )
                        if !area.isEmpty {
                            ReadingText(lines: area, size: .body, color: Palette.fog, lineSpacing: 8, paragraphSpacing: 16)
                                .padding(.top, 4)
                        }
                        if !station.historyNotes.isEmpty {
                            VStack(alignment: .leading, spacing: 28) {
                                ForEach(Array(station.historyNotes.enumerated()), id: \.element.title) { index, note in
                                    PlaceNote(index: index + 1, note: note)
                                }
                            }
                            .padding(.top, area.isEmpty ? 4 : 12)
                        }
                    }
                    .padding(.vertical, 28)
                }

                if !station.sightseeingNotes.isEmpty {
                    placeRule
                    VStack(alignment: .leading, spacing: 20) {
                        PlaceSectionHeader(
                            kicker: "SIGHTSEEING",
                            title: "観光案内メモ",
                            pictogram: .photoSpot
                        )
                        VStack(alignment: .leading, spacing: 28) {
                            ForEach(Array(station.sightseeingNotes.enumerated()), id: \.element.title) { index, note in
                                PlaceNote(index: index + 1, note: note)
                            }
                        }
                        .padding(.top, 4)
                    }
                    .padding(.vertical, 28)
                }

                if intro.isEmpty && walk.isEmpty && area.isEmpty
                    && station.historyNotes.isEmpty && station.sightseeingNotes.isEmpty {
                    Text("この駅の土地メモはまだ少なめです。")
                        .font(.footnote)
                        .foregroundStyle(Palette.mist)
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, 8)
            .padding(.bottom, 36)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .onChange(of: station.id) { _, _ in
            narrator.stop()
        }
        .onDisappear {
            narrator.stop()
        }
    }

    private var placeRule: some View {
        Rectangle()
            .fill(Palette.line)
            .frame(height: 1)
            .padding(.bottom, 4)
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
                    Text(narrator.isSpeaking ? "もう一度押すと止まります" : "駅に着く前に、イヤホンでどうぞ")
                        .font(.caption)
                        .foregroundStyle(narrator.isSpeaking ? Palette.paper.opacity(0.85) : Palette.mist)
                }
                Spacer(minLength: 0)
            }
            .foregroundStyle(narrator.isSpeaking ? Palette.paper : Palette.ink)
            .padding(.vertical, 14)
            .padding(.horizontal, 16)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(narrator.isSpeaking ? Palette.warm : Palette.paper)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(narrator.isSpeaking ? Color.clear : Palette.line, lineWidth: 1)
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
