import SwiftUI

struct ArrivalChatView: View {
    @Environment(AppModel.self) private var model
    @State private var locator = LocationService()
    @FocusState private var composerFocused: Bool
    @FocusState private var stationSearchFocused: Bool

    var body: some View {
        GeometryReader { geo in
            let coursePicking = model.phase == .course
            // コース選択中は会話を最小にし、カード一覧へ画面の大半を渡す（キーボードも出さない）
            let threadCap = geo.size.height * 0.12
            VStack(spacing: 0) {
                header
                thread
                    .frame(maxHeight: coursePicking ? threadCap : .infinity)
                    .layoutPriority(coursePicking ? 0 : 1)
                dock(coursePicking: coursePicking)
                    .layoutPriority(coursePicking ? 1 : 0)
                    .frame(maxHeight: coursePicking ? .infinity : nil, alignment: .top)
            }
        }
        .background(Palette.canvas.ignoresSafeArea())
        .onChange(of: model.phase) { _, phase in
            if phase == .course || phase == .ready || phase == .station {
                composerFocused = false
            }
        }
        .onChange(of: model.showStationSearch) { _, open in
            if open {
                DispatchQueue.main.async {
                    stationSearchFocused = true
                }
            } else {
                stationSearchFocused = false
            }
        }
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Kicker(text: model.savedCount > 0
                    ? "ARRIVAL · 保存 \(model.savedCount) 駅 · 全国検索可"
                    : "ARRIVAL · 全国の駅を検索")
                Text("知らない駅から、まわり方をつくる")
                    .font(.mincho(.title3, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 8)
            Button("はじめに戻る") { model.goHero() }
                .font(.readable(.callout))
                .foregroundStyle(Palette.mist)
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 12)
        .background(Palette.paper)
        .overlay(alignment: .bottom) { Divider().overlay(Palette.line) }
    }

    private var thread: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    ForEach(model.messages) { message in
                        ChatBubble(message: message)
                            .id(message.id)
                    }
                }
                .padding(16)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: model.messages.count) {
                guard let last = model.messages.last else { return }
                withAnimation(.easeOut(duration: 0.2)) {
                    proxy.scrollTo(last.id, anchor: .bottom)
                }
            }
            .onAppear {
                if let last = model.messages.last {
                    proxy.scrollTo(last.id, anchor: .bottom)
                }
            }
        }
    }

    private func dock(coursePicking: Bool) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if coursePicking {
                GeometryReader { dockGeo in
                    // 見出し1行分を除き、カード一覧へほぼ全部を渡す
                    coursePicker(listMaxHeight: max(300, dockGeo.size.height - 28))
                }
            } else {
                replies
                if model.phase == .ready {
                    Text("案内を開いています…")
                        .font(.readable(.body))
                        .foregroundStyle(Palette.mist)
                        .frame(maxWidth: .infinity)
                } else if model.phase == .station {
                    // 駅フェーズはチップのみ。検索窓は「駅名で探す」後に出す。
                    EmptyView()
                } else {
                    composer
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, coursePicking ? 12 : 8)
        .background(Palette.paper.ignoresSafeArea(edges: .bottom))
        .overlay(alignment: .top) { Divider().overlay(Palette.line) }
    }

    @ViewBuilder
    private var replies: some View {
        switch model.phase {
        case .station:
            stationReplies
        case .clock:
            FlowLayout {
                Button {
                    model.chooseClockNow()
                } label: {
                    chipLabel("いまの時刻で", .watch)
                }
                .buttonStyle(ChipButtonStyle(primary: true))
                ForEach(DayPart.allCases) { part in
                    Button {
                        model.chooseClock(part)
                    } label: {
                        chipLabel(part.label, part.pictogram)
                    }
                    .buttonStyle(ChipButtonStyle())
                    .accessibilityHint(part.hint)
                }
            }
        case .stay:
            FlowLayout {
                ForEach(StayOption.allCases) { stay in
                    Button {
                        model.chooseStay(stay)
                    } label: {
                        chipLabel(stay.label, .watch)
                    }
                    .buttonStyle(ChipButtonStyle())
                }
            }
        case .mealSolo:
            FlowLayout {
                ForEach(SoloPref.allCases) { pref in
                    Button(pref.label) { model.chooseMealSolo(pref) }
                        .buttonStyle(ChipButtonStyle(primary: pref == .solo))
                        .accessibilityHint(pref.hint)
                }
            }
        case .mealBudget:
            FlowLayout {
                ForEach(BudgetPref.allCases) { pref in
                    Button {
                        model.chooseMealBudget(pref)
                    } label: {
                        VStack(spacing: 2) {
                            Text(pref.label)
                            Text(pref.hint).font(.readable(.caption)).opacity(0.8)
                        }
                    }
                    .buttonStyle(ChipButtonStyle(primary: pref == .casual))
                }
            }
        case .course, .ready:
            EmptyView()
        }
    }

    private var stationReplies: some View {
        @Bindable var model = model
        return VStack(alignment: .leading, spacing: 10) {
            FlowLayout {
                Button {
                    locateHere()
                } label: {
                    chipLabel(model.geoLoading ? "現在地を確認中…" : "現在地で駅を探す", .meetingPoint)
                }
                .buttonStyle(ChipButtonStyle(primary: true))
                .disabled(model.geoLoading)

                Button {
                    withAnimation {
                        model.showStationSearch = true
                    }
                } label: {
                    chipLabel("駅名で探す", .search)
                }
                .buttonStyle(ChipButtonStyle())
            }
            if model.showStationSearch {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        TextField("例: 出町柳 / 二ノ瀬 / 中書島", text: $model.query)
                            .textFieldStyle(.roundedBorder)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .submitLabel(.search)
                            .focused($stationSearchFocused)
                            .disabled(model.stationLoading)
                            .onSubmit { submitStationQuery() }
                        Button("送る") { submitStationQuery() }
                            .buttonStyle(ChipButtonStyle(primary: true))
                            .disabled(
                                model.stationLoading
                                    || model.query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                            )
                    }
                    ScrollView {
                        VStack(spacing: 0) {
                            ForEach(model.filteredStations) { station in
                                Button {
                                    model.chooseStation(station)
                                } label: {
                                    HStack {
                                        Text(station.name)
                                            .font(.mincho(.headline, weight: .semibold))
                                            .foregroundStyle(Palette.ink)
                                        Spacer()
                                        Text("\(station.prefecture) · \(station.line)")
                                            .font(.readable(.caption))
                                            .foregroundStyle(Palette.mist)
                                            .lineLimit(1)
                                    }
                                    .padding(.vertical, 12)
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .disabled(model.stationLoading)
                                Divider().overlay(Palette.line)
                            }
                            if model.query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                               model.filteredStations.isEmpty {
                                Text("駅名を入れて「送る」。初めての駅は Gemini が編集し、この端末に残ります。")
                                    .font(.callout)
                                    .foregroundStyle(Palette.mist)
                                    .padding(.vertical, 12)
                            }
                        }
                    }
                    .frame(maxHeight: 200)
                }
            }
        }
    }

    private func coursePicker(listMaxHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("下のカードから、まわり方を1つ選ぶ")
                .font(.readable(.caption, weight: .semibold))
                .foregroundStyle(Palette.mist)

            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(Array(model.courses.enumerated()), id: \.element.id) { index, course in
                        Button {
                            model.chooseCourse(course)
                        } label: {
                            CourseCard(course: course, index: index)
                        }
                        .buttonStyle(.plain)
                    }

                    Button {
                        model.skipCourse()
                    } label: {
                        chipLabel("まわり方は決めない（自由に歩く）", .trekking)
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(ChipButtonStyle(primary: false))
                    .padding(.top, 2)
                }
                .padding(.bottom, 8)
            }
            .frame(maxHeight: listMaxHeight)
            .scrollIndicators(.visible)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private var composer: some View {
        @Bindable var model = model
        return HStack(spacing: 8) {
            TextField(model.composerPlaceholder, text: $model.draft)
                .textFieldStyle(.roundedBorder)
                .focused($composerFocused)
                .submitLabel(.send)
                .onSubmit { model.submitDraft() }
            Button("送る") { model.submitDraft() }
                .buttonStyle(ChipButtonStyle(primary: true))
                .disabled(model.draft.trimmingCharacters(in: .whitespaces).isEmpty)
        }
    }

    private func chipLabel(_ text: String, _ pictogram: Pictogram) -> some View {
        HStack(spacing: 8) {
            PictogramIcon(pictogram, size: 18)
            Text(text)
        }
    }

    private func locateHere() {
        guard model.beginLocate() else { return }
        Task {
            do {
                let location = try await locator.requestOnce()
                model.finishLocate(lat: location.coordinate.latitude, lng: location.coordinate.longitude)
            } catch let failure as LocateFailure {
                model.failLocate(failure)
            } catch {
                model.failLocate(.unknown)
            }
        }
    }

    /// 検索欄の「送る」／キーボード検索。保存の有無に関わらず、毎回 Gemini で解析する。
    private func submitStationQuery() {
        let text = model.query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !model.stationLoading else { return }
        model.requestAiStation(text, spoken: text)
    }
}

struct ChatBubble: View {
    let message: ChatMessage

    var body: some View {
        let isGuide = message.role == .guide
        HStack {
            if !isGuide { Spacer(minLength: 48) }
            VStack(alignment: .leading, spacing: 6) {
                Text(isGuide ? "案内" : "あなた")
                    .font(.readable(.caption, weight: .semibold))
                    .foregroundStyle(isGuide ? Palette.moss : Palette.paper.opacity(0.8))
                Text(message.text)
                    .font(.mincho(.body))
                    .lineSpacing(6)
                    .foregroundStyle(isGuide ? Palette.ink : Palette.paper)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.vertical, 12)
            .padding(.horizontal, 16)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(isGuide ? Palette.paper : Palette.fog)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(isGuide ? Palette.line : Color.clear, lineWidth: 1)
            )
            if isGuide { Spacer(minLength: 48) }
        }
    }
}

struct CourseCard: View {
    let course: WalkCourse
    let index: Int

    private var accent: Color {
        switch index % 3 {
        case 0: return Palette.warm
        case 1: return Palette.river
        default: return Palette.moss
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            accent
                .frame(width: 5)
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .center, spacing: 10) {
                    Text("\(index + 1)")
                        .font(.readable(.subheadline, weight: .bold))
                        .foregroundStyle(Palette.paper)
                        .frame(width: 28, height: 28)
                        .background(Circle().fill(accent))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("まわり \(index + 1)")
                            .font(.readable(.caption2, weight: .semibold))
                            .foregroundStyle(accent)
                        Text(course.title)
                            .font(.mincho(.title3, weight: .semibold))
                            .foregroundStyle(Palette.ink)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 4)
                    Image(systemName: "chevron.right")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Palette.mist)
                }

                HStack(spacing: 8) {
                    metaChip("約\(course.totalMinutes)分")
                    metaChip("\(course.stops.count)か所")
                    Text(course.subtitle)
                        .font(.readable(.caption))
                        .foregroundStyle(Palette.mist)
                        .lineLimit(1)
                }

                Text(course.vibe)
                    .font(.mincho(.subheadline))
                    .foregroundStyle(Palette.fog)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)

                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(course.stops.prefix(4).enumerated()), id: \.element.id) { stopIndex, stop in
                        HStack(alignment: .center, spacing: 10) {
                            Text(stop.clockLabel)
                                .font(.readable(.caption, weight: .semibold))
                                .foregroundStyle(accent)
                                .frame(width: 44, alignment: .leading)
                            PictogramIcon(stop.spot.guide.pictogram, size: 14)
                                .foregroundStyle(stop.spot.guide.color)
                                .frame(width: 18)
                            Text(stop.spot.name)
                                .font(.mincho(.callout))
                                .foregroundStyle(Palette.ink)
                                .lineLimit(1)
                            Spacer(minLength: 0)
                        }
                        .padding(.vertical, 6)
                        if stopIndex < min(course.stops.count, 4) - 1 {
                            Divider().overlay(Palette.line)
                        }
                    }
                    if course.stops.count > 4 {
                        Text("ほか \(course.stops.count - 4) か所")
                            .font(.readable(.caption2))
                            .foregroundStyle(Palette.mist)
                            .padding(.top, 6)
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Palette.paper.opacity(0.85)))

                Text("タップして、このまわり方へ")
                    .font(.readable(.caption, weight: .semibold))
                    .foregroundStyle(accent)
            }
            .padding(.leading, 12)
            .padding(.trailing, 12)
            .padding(.vertical, 12)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Palette.paper))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(accent.opacity(0.35), lineWidth: 1.5)
        )
        .shadow(color: .black.opacity(0.04), radius: 3, y: 1)
        .contentShape(Rectangle())
        .accessibilityHint("まわり方を選ぶ")
    }

    private func metaChip(_ text: String) -> some View {
        Text(text)
            .font(.readable(.caption2, weight: .semibold))
            .foregroundStyle(Palette.ink)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Capsule().fill(Palette.canvas))
            .overlay(Capsule().stroke(Palette.line, lineWidth: 1))
    }
}
