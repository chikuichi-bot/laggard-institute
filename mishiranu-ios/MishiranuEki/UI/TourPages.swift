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
            // 下部タブバー＋ホームインジケータ分。NavigationStack 配下でも末尾が隠れるのを防ぐ
            .padding(.bottom, 88)
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
                            hasSight: hasSight,
                            speakingSection: narrator.activeSection,
                            onSelect: { section in
                                withAnimation(.easeInOut(duration: 0.25)) {
                                    proxy.scrollTo(section, anchor: .top)
                                }
                            },
                            onListen: { section in
                                let script: PlaceScriptSection = {
                                    switch section {
                                    case .intro: return .intro
                                    case .history: return .history
                                    case .sight: return .sight
                                    case .walk: return .walk
                                    }
                                }()
                                narrator.toggle(station: station, section: script)
                            }
                        )

                        if hasIntro {
                            PlaceBoardPanel(
                                number: "01",
                                title: station.aboutTitle,
                                reading: station.displayNameReading,
                                accent: Palette.ink,
                                pictogram: nil,
                                isListening: narrator.isSpeaking(section: .intro),
                                onListen: { narrator.toggle(station: station, section: .intro) }
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

                        if hasHistory {
                            PlaceBoardPanel(
                                number: "02",
                                title: "このエリアのこと",
                                accent: Palette.ink,
                                pictogram: .history,
                                isListening: narrator.isSpeaking(section: .history),
                                onListen: { narrator.toggle(station: station, section: .history) }
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
                                number: "03",
                                title: "観光案内メモ",
                                accent: Palette.ink,
                                pictogram: .photoSpot,
                                isListening: narrator.isSpeaking(section: .sight),
                                onListen: { narrator.toggle(station: station, section: .sight) }
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

                        if hasWalk {
                            PlaceBoardPanel(
                                number: "04",
                                title: "歩き方の目安",
                                accent: Palette.moss,
                                pictogram: .trekking,
                                isListening: narrator.isSpeaking(section: .walk),
                                onListen: { narrator.toggle(station: station, section: .walk) }
                            ) {
                                ReadingText(lines: walk)
                            }
                            .id(PlaceBoardSection.walk)
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
    var speakingSection: PlaceScriptSection? = nil
    let onSelect: (PlaceBoardSection) -> Void
    let onListen: (PlaceBoardSection) -> Void

    private struct IndexItem: Identifiable {
        let id: PlaceBoardSection
        let number: String
        let label: String
        let enabled: Bool
        let script: PlaceScriptSection
    }

    var body: some View {
        let items: [IndexItem] = [
            .init(id: .intro, number: "01", label: stationLabel, enabled: hasIntro, script: .intro),
            .init(id: .history, number: "02", label: "このエリア", enabled: hasHistory, script: .history),
            .init(id: .sight, number: "03", label: "観光案内", enabled: hasSight, script: .sight),
            .init(id: .walk, number: "04", label: "歩き方", enabled: hasWalk, script: .walk),
        ]
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 6) {
            ForEach(items) { item in
                let listening = speakingSection == item.script
                HStack(spacing: 0) {
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
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(PlainHapticButtonStyle())
                    .disabled(!item.enabled)
                    .accessibilityLabel("\(item.number) \(item.label)")

                    Button {
                        guard item.enabled else { return }
                        onListen(item.id)
                    } label: {
                        Image(systemName: listening ? "stop.fill" : "speaker.wave.2.fill")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(listening ? Palette.warmDeep : (item.enabled ? Palette.ink : Palette.mist))
                            .frame(width: 36, height: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(PlainHapticButtonStyle())
                    .disabled(!item.enabled)
                    .accessibilityLabel(listening ? "\(item.label)の読み上げを止める" : "\(item.label)を聞く")
                }
                .background(Palette.paper)
                .overlay(
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .stroke(listening ? Palette.warm : Palette.line, lineWidth: listening ? 1.5 : 1)
                )
                .opacity(item.enabled ? 1 : 0.45)
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
    var isListening: Bool = false
    var onListen: (() -> Void)? = nil
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
                Spacer(minLength: 8)
                if let onListen {
                    Button(action: onListen) {
                        HStack(spacing: 4) {
                            Image(systemName: isListening ? "stop.fill" : "speaker.wave.2.fill")
                                .font(.caption.weight(.semibold))
                            Text(isListening ? "止める" : "聞く")
                                .font(.caption.weight(.semibold))
                        }
                        .foregroundStyle(isListening ? Palette.paper : Palette.ink)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 7)
                        .background(
                            Capsule(style: .continuous)
                                .fill(isListening ? Palette.warmDeep : Palette.ink.opacity(0.06))
                        )
                        .overlay(
                            Capsule(style: .continuous)
                                .stroke(isListening ? Color.clear : Palette.line, lineWidth: 1)
                        )
                    }
                    .buttonStyle(PlainHapticButtonStyle())
                    .accessibilityLabel(isListening ? "\(title)の読み上げを止める" : "\(title)を聞く")
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

/// 電車のイヤホン向け。上段は全部、各項目にも聞くボタンがある。
private struct PlaceListenBar: View {
    let narrator: PlaceNarrator
    let station: Station

    private var speakingAll: Bool { narrator.isSpeaking(section: .all) }
    private var canResume: Bool { narrator.canResume(station: station, section: .all) }

    var body: some View {
        Button {
            narrator.toggle(station: station, section: .all)
        } label: {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: speakingAll ? "stop.fill" : "speaker.wave.2.fill")
                    .font(.title3.weight(.semibold))
                    .frame(width: 24, height: 24)
                VStack(alignment: .leading, spacing: 3) {
                    Text(
                        speakingAll
                            ? "読み上げを止める"
                            : (canResume ? "続きから聞く" : "土地案内を聞く")
                    )
                        .font(.mincho(.body, weight: .semibold))
                        .fixedSize(horizontal: false, vertical: true)
                    Text(
                        speakingAll
                            ? "もう一度押すと止まります · 次回は続きから"
                            : (canResume
                                ? "途中から再開します · 長押しで最初から"
                                : "項目ごとにも聞けます · 駅に着く前に、イヤホンで")
                    )
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
                    .fill(speakingAll ? Palette.warmDeep : Palette.warm)
            )
        }
        .buttonStyle(PlainHapticButtonStyle())
        .simultaneousGesture(
            LongPressGesture(minimumDuration: 0.55).onEnded { _ in
                guard !speakingAll else { return }
                narrator.toggle(station: station, section: .all, fromBeginning: true)
            }
        )
        .accessibilityLabel(
            speakingAll
                ? "読み上げを止める"
                : (canResume ? "土地案内を続きから聞く" : "土地案内を聞く")
        )
        .accessibilityHint(
            canResume && !speakingAll
                ? "途中から再開します。最初から聞くときは長押し"
                : "駅の土地の文章を音声で読み上げます。各項目の聞くでも再生できます"
        )
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

    /// 今の駅に属さないコース（出町の顔が墨染に残る等）は出さない。
    private var shownCourse: WalkCourse? {
        guard let station = model.station, let course = model.selectedCourse else { return nil }
        let bare = SavedStationStore.bareName(station.name)
        guard course.id.contains(bare) else { return nil }
        guard !course.stops.contains(where: {
            DemachiTemplate.isForeignDemachiPlace($0.spot.name, stationName: station.name)
        }) else { return nil }
        return course
    }

    var body: some View {
        PageScroll {
            let variants = model.ordinaryWalkCourses.filter {
                guard let station = model.station else { return false }
                return $0.id.contains(SavedStationStore.bareName(station.name))
            }
            if let course = shownCourse, !course.stops.isEmpty {
                Kicker(text: "道案内", pictogram: .trekking)
                Text(course.title)
                    .font(.mincho(.title2, weight: .semibold))
                    .foregroundStyle(Palette.ink)

                if variants.count >= 2 {
                    HStack(spacing: 8) {
                        ForEach(variants) { option in
                            let on = option.id == course.id
                            Button {
                                model.selectWalkCourse(option)
                            } label: {
                                Text(option.id.contains("long") ? "ロング" : "ショート")
                                    .font(.readable(.subheadline, weight: .semibold))
                                    .foregroundStyle(on ? Palette.paper : Palette.ink)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 10)
                                    .background(
                                        Capsule()
                                            .fill(on ? Palette.warm : Palette.paper)
                                    )
                                    .overlay(
                                        Capsule()
                                            .stroke(on ? Color.clear : Palette.line, lineWidth: 1)
                                    )
                            }
                            .buttonStyle(PlainHapticButtonStyle())
                        }
                    }
                    .padding(.top, 4)
                }

                WalkRouteSummary(course: course)

                VStack(spacing: 0) {
                    WalkDepartureRow(stationName: model.station?.indexStationLabel ?? "駅")
                    ForEach(Array(course.stops.enumerated()), id: \.element.id) { index, stop in
                        Button {
                            model.openSpot(stop.spot)
                        } label: {
                            StopRow(
                                index: index,
                                stop: stop,
                                isLast: false,
                                fromStation: index == 0
                            )
                        }
                        .buttonStyle(PlainHapticButtonStyle())
                    }
                    WalkReturnRow(
                        stationName: model.station?.indexStationLabel ?? "駅",
                        walkMinutes: course.returnWalkMinutes,
                        clockLabel: course.returnClockLabel
                    )
                }
                .padding(.top, 8)
            } else {
                Kicker(text: "道案内", pictogram: .trekking)
                Text("ショート／ロングで歩く")
                    .font(.mincho(.title2, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                Text("土地ページの文章に、まだ歩ける場所の名前が少ないようです。土地と地図から、気になる場所へ寄ってください。")
                    .font(.mincho(.body))
                    .lineSpacing(8)
                    .foregroundStyle(Palette.fog)
            }
        }
    }
}

private struct WalkRouteSummary: View {
    let course: WalkCourse

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                summaryChip(title: "所要", value: "約\(course.totalMinutes)分")
                summaryChip(title: "立ち寄り", value: "\(course.stops.count)か所")
                summaryChip(title: "道順", value: "駅→回り→駅")
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    routeDot("start")
                    ForEach(Array(course.stops.enumerated()), id: \.element.id) { index, stop in
                        Image(systemName: "chevron.right")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(Palette.mist)
                        routeDot("\(index + 1)", subtitle: LandscapeSpotName.clarified(stop.spot.name))
                    }
                    Image(systemName: "chevron.right")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Palette.mist)
                    routeDot("着")
                }
                .padding(.vertical, 2)
            }
            Text("同じ道はなるべく帰りません。番号を押すと地図で場所を開けます。")
                .font(.caption)
                .foregroundStyle(Palette.mist)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Palette.paper)
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(Palette.line, lineWidth: 1)
                )
        )
    }

    private func summaryChip(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption2)
                .foregroundStyle(Palette.mist)
            Text(value)
                .font(.readable(.subheadline, weight: .semibold))
                .foregroundStyle(Palette.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func routeDot(_ label: String, subtitle: String? = nil) -> some View {
        let wide = label.count > 1
        return HStack(spacing: 4) {
            Text(label)
                .font(.caption.weight(.bold))
                .foregroundStyle(Palette.paper)
                .lineLimit(1)
                .padding(.horizontal, wide ? 7 : 0)
                .frame(width: wide ? nil : 22, height: 22)
                .background {
                    if wide {
                        Capsule().fill(Palette.ink)
                    } else {
                        Circle().fill(Palette.ink)
                    }
                }
            if let subtitle {
                Text(subtitle)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Palette.ink)
                    .lineLimit(1)
            }
        }
    }
}

private struct WalkDepartureRow: View {
    let stationName: String

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(spacing: 0) {
                Text("start")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Palette.paper)
                    .lineLimit(1)
                    .frame(height: 34)
                    .padding(.horizontal, 8)
                    .background(Capsule().fill(Palette.ink))
                Rectangle()
                    .fill(Palette.ink.opacity(0.35))
                    .frame(width: 3)
                    .frame(maxHeight: .infinity)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("出発")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Palette.mist)
                Text("\(stationName)駅")
                    .font(.mincho(.title3, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                Text("改札を出て、1番へ向かいます")
                    .font(.readable(.subheadline, weight: .medium))
                    .foregroundStyle(Palette.body)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
            .padding(.bottom, 14)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(stationName)駅が出発点")
    }
}

private struct WalkReturnRow: View {
    let stationName: String
    let walkMinutes: Int
    let clockLabel: String

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Text("着")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(Palette.paper)
                .frame(width: 34, height: 34)
                .background(Circle().fill(Palette.ink))
            VStack(alignment: .leading, spacing: 4) {
                Text(clockLabel.isEmpty ? "到着" : "到着 · \(clockLabel)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Palette.mist)
                Text("\(stationName)駅")
                    .font(.mincho(.title3, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                Text(
                    walkMinutes > 0
                        ? "徒歩約 \(walkMinutes) 分で駅へ戻る"
                        : "駅が終点です"
                )
                .font(.readable(.subheadline, weight: .semibold))
                .foregroundStyle(Palette.ink)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
            .padding(.bottom, 8)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(stationName)駅が終点")
    }
}

private struct StopRow: View {
    let index: Int
    let stop: CourseStop
    let isLast: Bool
    var fromStation: Bool = false

    private var legLabel: String {
        fromStation
            ? "駅から徒歩 約\(stop.walkMinutes)分"
            : "徒歩 約\(stop.walkMinutes)分"
    }

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(spacing: 0) {
                Text("\(index + 1)")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Palette.paper)
                    .frame(width: 34, height: 34)
                    .background(Circle().fill(Palette.warm))
                if !isLast {
                    Rectangle()
                        .fill(Palette.ink.opacity(0.35))
                        .frame(width: 3)
                        .frame(maxHeight: .infinity)
                }
            }
            VStack(alignment: .leading, spacing: 6) {
                Text(legLabel)
                    .font(.readable(.subheadline, weight: .bold))
                    .foregroundStyle(Palette.ink)
                Text(LandscapeSpotName.clarified(stop.spot.name))
                    .font(.mincho(.title3, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 8) {
                    if !stop.clockLabel.isEmpty {
                        Text(stop.clockLabel)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Palette.mist)
                    }
                    Text(stop.spot.guide.label)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(stop.spot.guide.color)
                    Text("滞在 約\(stop.dwellMinutes)分")
                        .font(.caption)
                        .foregroundStyle(Palette.mist)
                    Spacer(minLength: 0)
                    Text("地図")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Palette.ink)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .overlay(
                            Capsule().stroke(Palette.ink.opacity(0.45), lineWidth: 1)
                        )
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 6)
            .padding(.horizontal, 10)
            .padding(.bottom, 10)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Palette.paper)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .stroke(Palette.line, lineWidth: 1)
                    )
            )
            .padding(.bottom, 12)
        }
        .contentShape(Rectangle())
        .accessibilityLabel("\(index + 1)番 \(LandscapeSpotName.clarified(stop.spot.name))、\(legLabel)")
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
                        .buttonStyle(PlainHapticButtonStyle())
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
                    .buttonStyle(PlainHapticButtonStyle())
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
                        .buttonStyle(PlainHapticButtonStyle())
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

            let local = bike.places(kind: .local)
            let app = bike.places(kind: .app)
            if !local.isEmpty {
                bikeGroup(kind: .local, places: local)
            }
            if !app.isEmpty {
                bikeGroup(kind: .app, places: app)
            }
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

private struct GuideRow: View {
    let spot: Spot
    let match: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                PictogramIcon(spot.guide.pictogram, size: 18)
                    .foregroundStyle(spot.guide.color)
                Text(SpotCopy.displayName(for: spot))
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
            Text("徒歩約 \(spot.walkMinutes) 分")
                .font(.caption)
                .foregroundStyle(Palette.mist)
            if let hours = SpotHours.display(for: spot) {
                Text("営業 \(hours)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(
                        spot.guide == .meal || spot.guide == .souvenir
                            ? Palette.warm
                            : Palette.mist
                    )
            }
            if spot.guide == .meal {
                Text(mealMetaLine(spot))
                    .font(.caption)
                    .foregroundStyle(Palette.warm)
            }
            Text(SpotCopy.blurb(for: spot))
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
    @Environment(BillingStore.self) private var billing
    let station: Station
    @State private var copied = false
    @State private var confirmRebuild = false
    @State private var noticeAlert = false

    /// トップの「この駅について」と同じ型：駅名 → 調べるか確認。
    private var rebuildConfirmTitle: String {
        let name = station.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return "この駅の案内" }
        let label = name.hasSuffix("駅") ? name : "\(name)駅"
        return "ここは\(label)です"
    }

    private var rebuildConfirmMessage: String {
        if billing.byokUnlocked, billing.isByokConfigured {
            return "この駅の案内を、もう一度調べますか？\n自分の API で作り直します（コインは使いません）。"
        }
        if billing.byokUnlocked {
            return "買い切り済みです。料金で API を設定してから、もう一度調べてください。"
        }
        return "この駅の案内を、もう一度調べますか？\nコインを1枚使います（残り \(billing.coins) 枚）。"
    }

    var body: some View {
        @Bindable var theme = theme
        NavigationStack {
        PageScroll {
            Text("設定")
                .font(.mincho(.title2, weight: .semibold))
                .foregroundStyle(Palette.ink)

            settingsGroup(title: "この駅") {
                settingsRow(title: "いまの駅", detail: "\(station.name) · \(station.prefecture)")
                Button {
                    confirmRebuild = true
                } label: {
                    settingsButtonLabel("案内を作り直す（AI）", pictogram: .train)
                }
                .buttonStyle(PlainHapticButtonStyle())
                .disabled(model.stationLoading)
                Button {
                    model.goHero()
                } label: {
                    settingsButtonLabel("駅を探し直す", pictogram: .search)
                }
                .buttonStyle(PlainHapticButtonStyle())
            }

            settingsGroup(title: "調べた駅") {
                if model.savedStations.isEmpty {
                    Text("まだありません。駅を調べると、ここに残ります。あとから思い出して開けます。")
                        .font(.readable(.caption))
                        .foregroundStyle(Palette.mist)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                } else {
                    settingsRow(
                        title: "\(model.savedStations.count)駅",
                        detail: "新しいものが上"
                    )
                    ForEach(model.savedStations) { saved in
                        Button {
                            model.recallSavedStation(saved)
                        } label: {
                            HStack(spacing: 10) {
                                PictogramIcon(.train, size: 18)
                                    .foregroundStyle(
                                        saved.id == station.id ? Palette.paper : Palette.warm
                                    )
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(saved.indexStationLabel)
                                        .font(.mincho(.body))
                                        .foregroundStyle(
                                            saved.id == station.id ? Palette.paper : Palette.ink
                                        )
                                    Text("\(saved.prefecture) · \(saved.line)")
                                        .font(.readable(.caption2))
                                        .foregroundStyle(
                                            saved.id == station.id
                                                ? Palette.paper.opacity(0.85)
                                                : Palette.mist
                                        )
                                        .lineLimit(1)
                                }
                                Spacer(minLength: 0)
                                if saved.id == station.id {
                                    Text("いま")
                                        .font(.readable(.caption2, weight: .semibold))
                                        .foregroundStyle(Palette.paper.opacity(0.9))
                                } else {
                                    Image(systemName: "chevron.right")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(Palette.mist)
                                }
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(saved.id == station.id ? Palette.warm : Color.clear)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(PlainHapticButtonStyle())
                        .accessibilityLabel("\(saved.name)を開く")
                        .contextMenu {
                            Button("この駅を開く") { model.recallSavedStation(saved) }
                            Button("リストから外す", role: .destructive) {
                                model.forgetSavedStation(saved)
                            }
                        }
                    }
                }
            }

            settingsGroup(title: "見た目") {
                VStack(alignment: .leading, spacing: 10) {
                    Text("案内の色と空気")
                        .font(.mincho(.body))
                        .foregroundStyle(Palette.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    VStack(spacing: 8) {
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
                                            theme.skin == skin
                                                ? (theme.skin == .ma ? Palette.paper.opacity(0.9) : Palette.paper.opacity(0.85))
                                                : Palette.mist
                                        )
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(12)
                                .foregroundStyle(theme.skin == skin ? Palette.paper : Palette.ink)
                                .background(
                                    RoundedRectangle(cornerRadius: theme.skin == .ma ? 4 : 10, style: .continuous)
                                        .fill(theme.skin == skin ? Palette.warm : Palette.canvas)
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: theme.skin == .ma ? 4 : 10, style: .continuous)
                                        .stroke(
                                            theme.skin == skin ? Color.clear : Palette.line,
                                            lineWidth: 1
                                        )
                                )
                            }
                            .buttonStyle(PlainHapticButtonStyle())
                        }
                    }
                }
                .padding(14)
            }

            settingsGroup(title: "物語・寄り道") {
                Button {
                    UIPasteboard.general.string = model.shareText
                    copied = true
                } label: {
                    settingsButtonLabel(copied ? "コピーしました" : "物語をコピー", pictogram: .information)
                }
                .buttonStyle(PlainHapticButtonStyle())

                ShareLink(item: model.shareText) {
                    settingsButtonLabel("共有する", pictogram: .meetingPoint)
                }
                .buttonStyle(PlainHapticButtonStyle())
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

            settingsGroup(title: "料金") {
                NavigationLink {
                    PricingPage()
                } label: {
                    settingsButtonLabel(
                        "料金",
                        pictogram: .information,
                        detail: "コイン \(billing.coins)"
                            + (billing.byokUnlocked ? " · BYOK" : "")
                    )
                }
                .buttonStyle(PlainHapticButtonStyle())
            }
        }
        }
        .overlay {
            if confirmRebuild {
                GuideConfirmPopup(
                    title: rebuildConfirmTitle,
                    message: rebuildConfirmMessage,
                    onConfirm: {
                        confirmRebuild = false
                        model.requestAiStation(station.name, forceRefresh: true)
                    },
                    onCancel: {
                        confirmRebuild = false
                    }
                )
                .transition(.opacity)
                .zIndex(50)
            }
        }
        .animation(.easeInOut(duration: 0.18), value: confirmRebuild)
        .onChange(of: model.stationNotice) { _, note in
            noticeAlert = note?.isEmpty == false
        }
        .alert("案内", isPresented: $noticeAlert) {
            Button("閉じる", role: .cancel) {
                model.stationNotice = nil
            }
        } message: {
            Text(model.stationNotice ?? "")
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

    private func settingsButtonLabel(
        _ title: String,
        pictogram: Pictogram,
        detail: String? = nil
    ) -> some View {
        HStack(spacing: 10) {
            PictogramIcon(pictogram, size: 18)
                .foregroundStyle(Palette.warm)
            Text(title)
                .font(.mincho(.body))
                .foregroundStyle(Palette.ink)
            Spacer(minLength: 0)
            if let detail {
                Text(detail)
                    .font(.readable(.caption))
                    .foregroundStyle(Palette.mist)
                    .lineLimit(1)
            }
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Palette.mist)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .contentShape(Rectangle())
    }
}
