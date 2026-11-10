import SwiftUI

struct ArrivalChatView: View {
    @Environment(AppModel.self) private var model
    @State private var locator = LocationService()
    @FocusState private var composerFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            header
            thread
            dock
        }
        .background(Palette.canvas.ignoresSafeArea())
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Kicker(text: "ARRIVAL · 編集 \(model.stations.count) 駅")
                Text("知らない駅から、コースをつくる")
                    .font(.mincho(.title3, weight: .semibold))
                    .foregroundStyle(Palette.ink)
            }
            Spacer()
            Button("はじめに戻る") { model.goHero() }
                .font(.footnote)
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

    private var dock: some View {
        VStack(alignment: .leading, spacing: 12) {
            replies
            if model.phase == .ready {
                Text("案内を開いています…")
                    .font(.footnote)
                    .foregroundStyle(Palette.mist)
                    .frame(maxWidth: .infinity)
            } else {
                composer
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 8)
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
                            Text(pref.hint).font(.caption2).opacity(0.75)
                        }
                    }
                    .buttonStyle(ChipButtonStyle(primary: pref == .casual))
                }
            }
        case .course:
            coursePicker
        case .ready:
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
                    withAnimation { model.showStationSearch.toggle() }
                } label: {
                    chipLabel("駅名で探す", .search)
                }
                .buttonStyle(ChipButtonStyle())
            }
            if model.showStationSearch {
                VStack(alignment: .leading, spacing: 8) {
                    TextField("例: 出町柳 / 叡山 / 京都", text: $model.query)
                        .textFieldStyle(.roundedBorder)
                        .autocorrectionDisabled()
                    ScrollView {
                        VStack(spacing: 0) {
                            ForEach(model.filteredStations) { station in
                                Button {
                                    model.chooseStation(station)
                                } label: {
                                    HStack {
                                        Text(station.name)
                                            .font(.mincho(.body, weight: .semibold))
                                            .foregroundStyle(Palette.ink)
                                        Spacer()
                                        Text("\(station.prefecture) · \(station.line)")
                                            .font(.caption)
                                            .foregroundStyle(Palette.mist)
                                            .lineLimit(1)
                                    }
                                    .padding(.vertical, 10)
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                Divider().overlay(Palette.line)
                            }
                            if model.filteredStations.isEmpty {
                                Text("編集リストにはありません。いまは収録駅だけ案内できます。")
                                    .font(.footnote)
                                    .foregroundStyle(Palette.mist)
                                    .padding(.vertical, 10)
                            }
                        }
                    }
                    .frame(maxHeight: 200)
                }
            }
        }
    }

    private var coursePicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button {
                model.skipCourse()
            } label: {
                chipLabel("コースは作らない", .trekking)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(ChipButtonStyle(primary: true))

            ScrollView {
                VStack(spacing: 10) {
                    ForEach(Array(model.courses.enumerated()), id: \.element.id) { index, course in
                        Button {
                            model.chooseCourse(course)
                        } label: {
                            CourseCard(course: course, index: index)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .frame(maxHeight: 300)
        }
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
        HStack(spacing: 6) {
            PictogramIcon(pictogram, size: 16)
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
}

struct ChatBubble: View {
    let message: ChatMessage

    var body: some View {
        let isGuide = message.role == .guide
        HStack {
            if !isGuide { Spacer(minLength: 48) }
            VStack(alignment: .leading, spacing: 4) {
                Text(isGuide ? "案内" : "あなた")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(isGuide ? Palette.moss : Palette.paper.opacity(0.8))
                Text(message.text)
                    .font(.mincho(.callout))
                    .lineSpacing(4)
                    .foregroundStyle(isGuide ? Palette.ink : Palette.paper)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.vertical, 10)
            .padding(.horizontal, 14)
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

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("コース \(index + 1)")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(Palette.warm)
            Text(course.title)
                .font(.mincho(.headline, weight: .semibold))
                .foregroundStyle(Palette.ink)
            Text("\(course.subtitle) · 約\(course.totalMinutes)分 · \(course.stops.count)か所")
                .font(.caption)
                .foregroundStyle(Palette.mist)
            Text(course.vibe)
                .font(.mincho(.footnote))
                .foregroundStyle(Palette.fog)
            VStack(alignment: .leading, spacing: 4) {
                ForEach(course.stops) { stop in
                    HStack(spacing: 6) {
                        PictogramIcon(stop.spot.guide.pictogram, size: 14)
                            .foregroundStyle(stop.spot.guide.color)
                        Text("\(stop.clockLabel) \(stop.spot.name)")
                            .font(.footnote)
                            .foregroundStyle(Palette.ink)
                    }
                }
            }
            .padding(.top, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Palette.canvas))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Palette.line, lineWidth: 1))
        .contentShape(Rectangle())
    }
}
