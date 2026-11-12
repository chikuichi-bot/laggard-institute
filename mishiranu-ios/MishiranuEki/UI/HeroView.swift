import SwiftUI

struct HeroView: View {
    @Environment(AppModel.self) private var model
    @State private var locator = LocationService()
    @FocusState private var searchFocused: Bool
    /// 現在地ヒット・保存駅の確認（「ここは」は現在地だけ）。
    @State private var pendingConfirm: StationConfirm?
    /// 駅名検索の候補一覧。選んでから AI 案内へ。
    @State private var candidateSheet: CandidateSheet?

    private let brandChars = Array("見知らぬ駅")
    private let heroInk = Color(hex: 0x2a241c)
    private let heroFog = Color(hex: 0x5c5348)
    private let heroMist = Color(hex: 0x8a7d6b)
    private let heroPaper = Color(hex: 0xf8f5ee)

    private struct CandidateSheet: Equatable {
        var query: String
        var items: [StationNameCandidate]
        var loading: Bool
    }

    private enum StationConfirm: Equatable {
        /// GPS で近いときだけ「ここは」と言う。
        case locate(Station)
        case open(Station)
        case recall(Station)

        var title: String {
            switch self {
            case .locate(let station):
                return "ここは\(Self.label(station.name))です"
            case .open(let station), .recall(let station):
                return "「\(Self.label(station.name))」ですか？"
            }
        }

        var message: String {
            switch self {
            case .locate:
                return "この駅の徒歩圏の案内を開きますか？"
            case .open, .recall:
                return "この駅の徒歩圏の案内を開きますか？"
            }
        }

        private static func label(_ raw: String) -> String {
            let name = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !name.isEmpty else { return "駅" }
            return name.hasSuffix("駅") ? name : "\(name)駅"
        }
    }

    var body: some View {
        @Bindable var model = model
        GeometryReader { geo in
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // 題字と地図は別レイヤー。地図は題字の下ではなく、同じ面の全域に置ける。
                ZStack(alignment: .topTrailing) {
                    HeroRoadMap()
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                        .frame(minHeight: 180)
                        .allowsHitTesting(false)
                    VStack(spacing: 8) {
                        ForEach(Array(brandChars.enumerated()), id: \.offset) { _, ch in
                            Text(String(ch))
                                .font(.system(size: 25, weight: .medium, design: .serif))
                                .foregroundStyle(heroInk)
                        }
                    }
                    .allowsHitTesting(false)
                    .padding(.top, 36)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .layoutPriority(-1)

                VStack(alignment: .leading, spacing: 16) {
                    Button {
                        locateHere()
                    } label: {
                        Text(
                            model.geoLoading
                                ? "調べています…"
                                : model.stationLoading
                                    ? "案内をつくっています…"
                                    : "この駅について"
                        )
                            .font(.system(.body, design: .serif).weight(.medium))
                            .tracking(3)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .foregroundStyle(heroInk)
                            .background {
                                Capsule()
                                    .fill(heroInk.opacity(0.04))
                            }
                            .overlay {
                                Capsule()
                                    .stroke(heroInk.opacity(0.55), lineWidth: 1)
                            }
                    }
                    .buttonStyle(PlainHapticButtonStyle())
                    .disabled(model.geoLoading || model.stationLoading)

                    if !model.geoLoading, !model.stationLoading {
                        statusBlock
                    }

                    HStack(alignment: .bottom, spacing: 10) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("駅名")
                                .font(.system(.caption2, design: .serif))
                                .tracking(2)
                                .foregroundStyle(heroMist)
                            TextField("例: 藤森 / 出町柳", text: $model.query)
                                .font(.system(.body, design: .serif))
                                .foregroundStyle(heroInk)
                                .textFieldStyle(.plain)
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.never)
                                .submitLabel(.search)
                                .focused($searchFocused)
                                .disabled(model.stationLoading)
                                .onSubmit { submitStationQuery() }
                                .padding(.bottom, 6)
                                .overlay(alignment: .bottom) {
                                    Rectangle()
                                        .fill(heroInk)
                                        .frame(height: 1)
                                }
                        }
                        if !queryTrimmed.isEmpty {
                            Button("開く") { submitStationQuery() }
                                .font(.system(.subheadline, design: .serif))
                                .foregroundStyle(heroInk)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 10)
                                .overlay(
                                    Rectangle().stroke(heroInk, lineWidth: 1)
                                )
                                .disabled(model.stationLoading || candidateSheet?.loading == true)
                        }
                    }

                    if searchFocused || !queryTrimmed.isEmpty {
                        stationSuggestList
                    }
                }

                if !searchFocused, queryTrimmed.isEmpty, model.savedCount > 0 {
                    Text("保存 \(model.savedCount) 駅 · 検索バーをタップすると一覧が出ます")
                        .font(.system(.caption, design: .serif))
                        .foregroundStyle(heroMist)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 10)
                        .padding(.bottom, 8)
                }
            }
            .padding(.horizontal, 28)
            .padding(.bottom, 18)
            .frame(maxWidth: .infinity, minHeight: geo.size.height, alignment: .top)
        }
        .scrollDismissesKeyboard(.interactively)
        }
        .background(heroPaper.ignoresSafeArea())
        .overlay {
            if let sheet = candidateSheet {
                GuideCandidatePopup(
                    queryLabel: sheet.query,
                    candidates: sheet.items,
                    isLoading: sheet.loading,
                    onConfirm: { cand in
                        candidateSheet = nil
                        commitCandidate(cand)
                    },
                    onCancel: {
                        candidateSheet = nil
                    }
                )
                .transition(.opacity)
                .zIndex(50)
            } else if let pending = pendingConfirm {
                GuideConfirmPopup(
                    title: pending.title,
                    message: pending.message,
                    onConfirm: {
                        commitConfirm(pending)
                        pendingConfirm = nil
                    },
                    onCancel: {
                        pendingConfirm = nil
                    }
                )
                .transition(.opacity)
                .zIndex(50)
            }
        }
        .animation(.easeInOut(duration: 0.18), value: candidateSheet?.query)
        .animation(.easeInOut(duration: 0.18), value: pendingConfirm?.title)
    }

    private var queryTrimmed: String {
        model.query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var suggestStations: [Station] {
        if queryTrimmed.isEmpty {
            return Array(model.savedStations.prefix(12))
        }
        return Array(model.filteredStations.prefix(8))
    }

    @ViewBuilder
    private var stationSuggestList: some View {
        let rows = suggestStations
        VStack(alignment: .leading, spacing: 0) {
            Text(queryTrimmed.isEmpty ? "調べた駅" : "候補")
                .font(.system(.caption2, design: .serif).weight(.semibold))
                .foregroundStyle(heroMist)
                .padding(.top, 10)
                .padding(.bottom, 4)

            if rows.isEmpty {
                Text(queryTrimmed.isEmpty
                    ? "まだありません。駅名を入れて開くと、ここに残ります。"
                    : "一覧に無い駅は「開く」で地図の候補から選べます。")
                    .font(.system(.caption, design: .serif))
                    .foregroundStyle(heroMist)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.vertical, 10)
            } else {
                VStack(spacing: 0) {
                    ForEach(rows) { station in
                        Button {
                            searchFocused = false
                            if queryTrimmed.isEmpty {
                                pendingConfirm = .recall(station)
                            } else {
                                // 候補はポップアップで選び直してから調べる。
                                openCandidateSheet(for: queryTrimmed)
                            }
                        } label: {
                            HStack(spacing: 10) {
                                PictogramIcon(.train, size: 16)
                                    .foregroundStyle(heroInk.opacity(0.7))
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(station.name)
                                        .font(.system(.headline, design: .serif).weight(.semibold))
                                        .foregroundStyle(heroInk)
                                    Text("\(station.prefecture) · \(station.line)")
                                        .font(.system(.caption, design: .serif))
                                        .foregroundStyle(heroMist)
                                        .lineLimit(1)
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(.vertical, 12)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(PlainHapticButtonStyle())
                        .disabled(model.stationLoading)
                        .accessibilityLabel("\(station.name)を選ぶ")
                        Divider().overlay(heroInk.opacity(0.15))
                    }
                }
            }
        }
        .padding(.horizontal, 4)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(heroInk.opacity(0.08))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(heroInk.opacity(0.12), lineWidth: 1)
        )
    }

    @ViewBuilder
    private var statusBlock: some View {
        if let note = model.heroNote, !note.isEmpty {
            Text(note)
                .font(.system(.callout, design: .serif))
                .foregroundStyle(heroFog)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 4)
                .accessibilityAddTraits(.updatesFrequently)
        }
    }

    private func commitConfirm(_ pending: StationConfirm) {
        switch pending {
        case .locate(let station), .open(let station):
            model.chooseStation(station, omitYou: true)
        case .recall(let station):
            model.recallSavedStation(station)
        }
    }

    private func commitCandidate(_ cand: StationNameCandidate) {
        if let known = cand.knownStation, !Self.isThin(known) {
            model.chooseStation(known, omitYou: true)
        } else {
            // 案内が無い／薄いときだけ AI でつくる。
            model.requestAiStation(
                cand.bareName,
                forceRefresh: cand.knownStation != nil
            )
        }
    }

    private static func isThin(_ station: Station) -> Bool {
        let prose =
            (station.stationIntro?.count ?? 0)
            + (station.areaAbout?.count ?? 0)
            + (station.walkGuide?.count ?? 0)
        return station.spots.count < 3 || prose < 80
    }

    private func locateHere() {
        guard model.beginLocate() else { return }
        searchFocused = false
        Task {
            do {
                let location = try await locator.requestOnce()
                if let station = model.finishLocate(
                    lat: location.coordinate.latitude,
                    lng: location.coordinate.longitude
                ) {
                    pendingConfirm = .locate(station)
                }
            } catch let failure as LocateFailure {
                model.failLocate(failure)
            } catch {
                model.failLocate(.unknown)
            }
        }
    }

    private func submitStationQuery() {
        let text = queryTrimmed
        guard !text.isEmpty else { return }
        searchFocused = false
        openCandidateSheet(for: text)
    }

    private func openCandidateSheet(for text: String) {
        let bare = text.hasSuffix("駅") ? String(text.dropLast()) : text
        candidateSheet = CandidateSheet(query: bare, items: [], loading: true)
        Task { @MainActor in
            let items = await StationCandidateSearch.candidates(
                for: text,
                in: model.stations,
                savedIds: model.savedStationIds
            )
            guard candidateSheet?.query == bare else { return }
            candidateSheet = CandidateSheet(query: bare, items: items, loading: false)
        }
    }
}
