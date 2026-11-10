import Foundation
import Observation

struct ChatMessage: Identifiable, Hashable {
    enum Role: Hashable { case guide, you }

    let id: UUID
    let role: Role
    var text: String
    /// 案内をつくっている待ち時間（Thinking time）
    var isThinking: Bool

    init(role: Role, text: String, isThinking: Bool = false, id: UUID = UUID()) {
        self.id = id
        self.role = role
        self.text = text
        self.isThinking = isThinking
    }
}

enum Screen: Hashable {
    case hero, chat, tour
}

enum ChatPhase: Hashable {
    case station, clock, stay, mealSolo, mealBudget, course, ready
}

enum TourTab: String, CaseIterable, Identifiable, Hashable {
    case map, place, walk, guide, more

    var id: String { rawValue }

    var label: String {
        switch self {
        case .map: return "地図"
        case .place: return "土地"
        case .walk: return "歩く"
        case .guide: return "案内"
        case .more: return "設定"
        }
    }
}

enum LocateFailure: Error, Hashable {
    case denied, unavailable, timeout, unknown

    var message: String {
        switch self {
        case .denied:
            return "位置情報の許可がオフです。「設定 → プライバシーとセキュリティ → 位置情報サービス」でオンにし、「見知らぬ駅」を「このAppの使用中のみ許可」にしてから、もう一度「現在地で駅を探す」を押してください。駅名でも探せます。"
        case .unavailable:
            return "いま位置が取れませんでした。屋外でもう一度試すか、駅名で探してください。"
        case .timeout:
            return "現在地の確認がタイムアウトしました。もう一度試すか、駅名で探してください。"
        case .unknown:
            return "現在地を取得できませんでした。駅名で探すか、もう一度どうぞ。"
        }
    }
}

let openingGuide =
    "知らない駅に到着しましたね。駅名を教えるか、現在地から近い保存済みの駅を探します。どの駅も検索でき、初めての駅は徒歩圏の案内をその場でつくります。一度見た駅は、この端末に少しずつ残ります。"

/// 現在地から自動で選ぶ駅の上限距離。
let nearbyStationKm = 3.5

@MainActor
@Observable
final class AppModel {
    var stations: [Station]
    private(set) var savedStationIds: Set<String>

    var screen: Screen = .hero
    var stationId: String
    var stay: StayOption = .oneHour
    var dayPart: DayPart
    var mealPrefs = MealPrefs()

    var messages: [ChatMessage] = [ChatMessage(role: .guide, text: openingGuide)]
    var phase: ChatPhase = .station
    var courses: [WalkCourse] = []
    var selectedCourse: WalkCourse?
    var showStationSearch = false
    var query = ""
    var draft = ""
    var geoLoading = false
    var stationLoading = false
    var tourTab: TourTab = .map
    var guideKind: GuideKind = .sight
    /// 案内タブでレンタサイクルを選んでいるとき true。
    var guideShowsBike = false
    var activeSpot: Spot?
    var secret: Spot?

    private let now: () -> Date
    @ObservationIgnored private var pendingTour: Task<Void, Never>?
    @ObservationIgnored private var pendingStationLookup: Task<Void, Never>?

    init(stations: [Station], now: @escaping () -> Date = Date.init) {
        let saved = SavedStationStore.load()
        self.savedStationIds = Set(saved.map(\.id))
        // 保存済みの近所の寺なども、起動時に一度落としてメジャーな普通のところだけにする
        let scrubbed = stations.map { CourseBuilder.snapLandmarkPins($0) }
        self.stations = scrubbed
        self.now = now
        self.stationId = saved.first?.id ?? scrubbed.first?.id ?? ""
        self.dayPart = DayPart.from(hour: Calendar.current.component(.hour, from: now()))
        for station in scrubbed where savedStationIds.contains(station.id) {
            _ = SavedStationStore.upsert(station)
        }
    }

    var savedCount: Int { savedStationIds.count }

    /// 設定画面用。調べた順（新しいものが先）。
    var savedStations: [Station] {
        let order = SavedStationStore.load().map(\.id)
        return order.compactMap { id in stations.first { $0.id == id } }
    }

    // MARK: - Derived

    var station: Station? {
        stations.first { $0.id == stationId } ?? stations.first
    }

    var radiusKm: Double { station?.radiusKm(for: stay) ?? 1 }

    /// 徒歩圏のスポット。土地紹介で触れた場所だけを地図に出し、コース順があれば先に。
    var tourSpots: [Spot] {
        guard let station else { return [] }
        let base = StationLore.introducedVisitSpots(in: station)
        guard let course = selectedCourse, !course.stops.isEmpty else { return base }
        let stopIds = course.stops.map(\.spot.id)
        let ordered = stopIds.compactMap { id in base.first { $0.id == id } }
        return ordered + base.filter { !stopIds.contains($0.id) }
    }

    /// コース上の番号（1始まり）。
    var courseNumbers: [String: Int] {
        guard let course = selectedCourse else { return [:] }
        var map: [String: Int] = [:]
        for (index, stop) in course.stops.enumerated() {
            map[stop.spot.id] = index + 1
        }
        return map
    }

    func guideSpots(_ kind: GuideKind) -> [Spot] {
        // 案内タブは滞在時間で切らない（ご飯・土産が「1時間」で消えるのを防ぐ）
        guard let station else { return [] }
        let normalized = CourseBuilder.ensureLocalMajors(
            CourseBuilder.snapLandmarkPins(
                BikeRentalSeal.ensure(CourseBuilder.normalizeEdibleSouvenirs(station))
            )
        )
        let introducedIds = Set(StationLore.introducedVisitSpots(in: normalized).map(\.id))
        // 観光は土地紹介で触れた場所だけ。ご飯・土産・休みも、紹介に出たもの優先。
        var items = normalized.spots.filter { $0.guide == kind }
        if kind == .sight {
            items = items.filter {
                !$0.name.hasSuffix("駅")
                    && !FirstVisitFaces.isNeighborhoodWorship($0.name, stationName: station.name)
                    && introducedIds.contains($0.id)
            }
        } else {
            let mentioned = items.filter { introducedIds.contains($0.id) }
            if !mentioned.isEmpty {
                items = mentioned
            }
        }
        if kind == .meal {
            items = MealStapleCatcher.keepMajorMealsOnly(
                items.map { spot in
                    // keepMajor は meal 以外も通すので、meal 配列だけ渡す
                    spot
                } + normalized.spots.filter { $0.guide != .meal },
                stationName: station.name
            ).filter { $0.guide == .meal }
        }
        // ご飯・土産は、その時間に開いているものだけ。閉まっている名物は出さない。
        if kind == .meal || kind == .rest || kind == .souvenir {
            items = items.filter { HoursOpen.isLikelyOpen($0, dayPart: dayPart) }
        }
        if kind == .meal {
            let ids = Set(items.map(\.id))
            let extras = station.spots
                .filter {
                    $0.guide == .meal
                        && !ids.contains($0.id)
                        && $0.walkMinutes <= 18
                        && HoursOpen.isLikelyOpen($0, dayPart: dayPart)
                }
                .sorted { $0.walkMinutes < $1.walkMinutes }
            for spot in extras where items.count < 5 {
                items.append(spot)
            }
        }
        // 名物菓子は meal 扱いでもお土産タブに出す（ふたば・走井餅等）
        if kind == .souvenir {
            let extras = normalized.spots.filter {
                $0.guide != .souvenir
                    && CourseBuilder.isEdibleOmiyage($0)
                    && HoursOpen.isLikelyOpen($0, dayPart: dayPart)
            }
            for spot in extras where !items.contains(where: {
                $0.id == spot.id || NameMatch.score($0.name, spot.name) >= 85
            }) {
                items.append(spot)
            }
        }
        // 定型説明を短い固有文に差し替え（保存済みの「観光の目印」も表示時に直す）
        let enriched = items.map { spot -> Spot in
            let text = SpotCopy.blurb(for: spot, in: normalized)
            guard text != spot.blurb else { return spot }
            return Spot(
                id: spot.id, name: spot.name, genre: spot.genre, guide: spot.guide,
                mealTier: spot.mealTier, mealTimes: spot.mealTimes, soloOk: spot.soloOk,
                budgetYen: spot.budgetYen, hours: spot.hours, blurb: text,
                detail: spot.detail, walkMinutes: spot.walkMinutes,
                secretWorthy: spot.secretWorthy, majorWorthy: spot.majorWorthy,
                lat: spot.lat, lng: spot.lng
            )
        }
        // 案内は駅から近い順。
        return enriched.sorted { lhs, rhs in
            if lhs.walkMinutes != rhs.walkMinutes {
                return lhs.walkMinutes < rhs.walkMinutes
            }
            if kind == .meal {
                let a = CourseBuilder.mealPrefScore(lhs, prefs: mealPrefs)
                let b = CourseBuilder.mealPrefScore(rhs, prefs: mealPrefs)
                if a != b { return a > b }
            }
            return lhs.name < rhs.name
        }
    }

    var hasMealPrefs: Bool { mealPrefs.solo != .either || mealPrefs.budget != .either }

    var filteredStations: [Station] {
        TextMatch.filterStations(query, in: stations, savedIds: savedStationIds)
    }

    var composerPlaceholder: String {
        switch phase {
        case .station: return "例: 中書島にいます"
        case .clock: return "例: いま14時ごろ / 夕方"
        case .stay: return "例: 3時間くらい"
        case .mealSolo: return "例: 一人で入りたい"
        case .mealBudget: return "例: 気軽に / 少し奮発"
        case .course: return "例: 散歩中心 / 食べ物中心 / まわり方は決めない"
        case .ready: return ""
        }
    }

    var shareText: String {
        guard let station else { return "" }
        var lines = [
            "【見知らぬ駅】\(station.name)",
            station.tourTitle,
            station.catchCopy,
            "\(stay.label) · 徒歩圏 約 \(formatKm(radiusKm)) km",
        ]
        if let course = selectedCourse {
            lines.append("まわり方: \(course.title)（\(course.stops.map(\.spot.name).joined(separator: " → "))）")
        }
        if let secret {
            lines.append("シークレット: \(secret.name)")
        }
        return lines.joined(separator: "\n")
    }

    // MARK: - Navigation

    func goHero() {
        pendingTour?.cancel()
        screen = .hero
    }

    func startArrival() {
        resetChat()
        screen = .chat
    }

    private func resetChat() {
        pendingTour?.cancel()
        phase = .station
        showStationSearch = false
        geoLoading = false
        courses = []
        selectedCourse = nil
        mealPrefs = MealPrefs()
        dayPart = DayPart.from(hour: Calendar.current.component(.hour, from: now()))
        query = ""
        draft = ""
        secret = nil
        activeSpot = nil
        messages = [ChatMessage(role: .guide, text: openingGuide)]
    }

    private func push(_ next: ChatMessage...) {
        messages.append(contentsOf: next)
    }

    private func finishThinking(successText: String) {
        guard let idx = messages.lastIndex(where: \.isThinking) else { return }
        messages[idx].isThinking = false
        messages[idx].text = successText
    }

    private func clearThinkingMessages() {
        messages.removeAll { $0.isThinking }
    }

    // MARK: - Chat steps

    func chooseStation(_ next: Station, spoken: String? = nil, omitYou: Bool = false, persist: Bool = true) {
        // ロック名所を足してから保存（石清水八幡宮・飛行神社などが落ちないように）
        let sealed = CourseBuilder.ensureLocalMajors(CourseBuilder.snapLandmarkPins(next))
        remember(sealed, persist: persist)
        stationId = sealed.id
        showStationSearch = false
        query = ""
        draft = ""
        courses = []
        selectedCourse = nil
        mealPrefs = MealPrefs()
        phase = .clock
        let guideText = "\(sealed.name)ですね。\(sealed.prefecture)・\(sealed.line)。いま何時ごろですか？ 時刻に合わせて、まわり方を組み立てます。"
        if !omitYou {
            push(ChatMessage(role: .you, text: spoken ?? "\(sealed.name)駅です"))
        }
        if let fragment = StationLore.arrivalFragment(for: sealed) {
            push(ChatMessage(role: .guide, text: fragment.line))
        }
        push(ChatMessage(role: .guide, text: guideText))
        relocateIfNeeded(sealed)
    }

    /// AI の駅は、Apple マップの周辺 POI で店・座標を仕入れてから保存する。
    private func relocateIfNeeded(_ station: Station) {
        guard station.id.hasPrefix("ai-") else { return }
        Task { [weak self] in
            let located = CourseBuilder.ensureLocalMajors(
                CourseBuilder.snapLandmarkPins(await SpotLocator.refine(station))
            )
            guard let self, !Task.isCancelled, self.stationId == station.id || self.stations.contains(where: { $0.id == station.id }) else { return }
            self.remember(located, persist: true)
            // 座標確定後にメジャー印付きでまわり方を組み直す
            if self.phase == .course || self.phase == .ready {
                self.courses = CourseBuilder.courses(
                    for: located,
                    stay: self.stay,
                    dayPart: self.dayPart,
                    prefs: self.mealPrefs
                )
                if let selected = self.selectedCourse {
                    self.selectedCourse = self.courses.first(where: { $0.id == selected.id })
                }
            }
        }
    }

    /// カタログに載せ、必要なら端末へ保存。
    private func remember(_ next: Station, persist: Bool) {
        if let index = stations.firstIndex(where: {
            $0.id == next.id || SavedStationStore.bareName($0.name) == SavedStationStore.bareName(next.name)
        }) {
            stations[index] = next
        } else {
            stations.insert(next, at: 0)
        }
        if persist {
            let saved = SavedStationStore.upsert(next)
            savedStationIds = Set(saved.map(\.id))
            stations = SavedStationStore.merge(bundled: StationStore.loadBundled(), saved: saved)
        }
    }

    func requestAiStation(_ rawName: String, spoken: String? = nil) {
        let name = rawName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, !stationLoading else { return }
        let bare = name.hasSuffix("駅") ? String(name.dropLast()) : name

        // 一度調べた駅は端末から開く（毎回 Gemini しない）
        if let saved = SavedStationStore.find(byName: bare, in: stations)
            ?? SavedStationStore.find(byName: bare) {
            screen = .chat
            phase = .station
            showStationSearch = false
            query = ""
            draft = ""
            push(
                ChatMessage(role: .you, text: spoken ?? "\(bare)駅です"),
                ChatMessage(
                    role: .guide,
                    text: "「\(bare)」は、この端末に残っていた案内を開きます。"
                )
            )
            chooseStation(saved, omitYou: true, persist: true)
            return
        }

        stationLoading = true
        screen = .chat
        phase = .station
        showStationSearch = true
        query = name
        draft = ""
        push(
            ChatMessage(role: .you, text: spoken ?? "\(bare)駅です"),
            ChatMessage(
                role: .guide,
                text: "「\(bare)」のまわりを調べて、徒歩圏の案内をつくっています。",
                isThinking: true
            )
        )
        pendingStationLookup?.cancel()
        pendingStationLookup = Task { [weak self] in
            guard let self else { return }
            do {
                let station = try await StationAPIClient.lookupStation(name: bare)
                guard !Task.isCancelled else { return }
                self.finishThinking(successText: "「\(bare)」の案内ができました。この端末に残します。")
                self.stationLoading = false
                self.chooseStation(station, omitYou: true, persist: true)
            } catch is CancellationError {
                self.stationLoading = false
                self.clearThinkingMessages()
            } catch {
                self.stationLoading = false
                self.clearThinkingMessages()
                let message = (error as? LocalizedError)?.errorDescription?
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                self.push(
                    ChatMessage(
                        role: .guide,
                        text: (message?.isEmpty == false)
                            ? message!
                            : "案内の通信に失敗しました。通信状況をみて、もう一度どうぞ。"
                    )
                )
            }
        }
    }

    /// 位置取得を始めたときに呼ぶ。false なら取得中なので何もしない。
    func beginLocate() -> Bool {
        guard !geoLoading else { return false }
        geoLoading = true
        push(
            ChatMessage(role: .you, text: "現在地から駅を探す"),
            ChatMessage(role: .guide, text: "いまの位置から、いちばん近い駅名を調べています…")
        )
        return true
    }

    func finishLocate(lat: Double, lng: Double) {
        geoLoading = false
        let hit = Geo.nearestStation(lat: lat, lng: lng, in: stations)
        if let hit, hit.km <= nearbyStationKm {
            chooseStation(hit.station, omitYou: true)
            return
        }
        showStationSearch = true
        let nearestHint = hit.map {
            "いちばん近い保存済みの駅は\($0.station.name)（\(Geo.distanceLabel(km: $0.km))）ですが、徒歩圏外です。"
        } ?? ""
        push(ChatMessage(
            role: .guide,
            text: "\(nearestHint)位置情報は端末の外に送っていません。駅名を入力すれば、全国どこでも徒歩圏の案内をつくれます。"
        ))
    }

    func failLocate(_ failure: LocateFailure) {
        geoLoading = false
        showStationSearch = true
        push(ChatMessage(role: .guide, text: failure.message))
    }

    func chooseClock(_ next: DayPart, spoken: String? = nil) {
        dayPart = next
        draft = ""
        phase = .stay
        push(
            ChatMessage(role: .you, text: spoken ?? "\(next.label)ごろ"),
            ChatMessage(role: .guide, text: "\(next.label)ですね。どのくらい滞在する予定ですか？")
        )
    }

    func chooseClockNow() {
        chooseClock(DayPart.from(hour: Calendar.current.component(.hour, from: now())), spoken: "いまの時刻で")
    }

    func chooseStay(_ next: StayOption, spoken: String? = nil) {
        stay = next
        draft = ""
        courses = []
        selectedCourse = nil
        phase = .mealSolo
        push(
            ChatMessage(role: .you, text: spoken ?? "\(next.label)くらい"),
            ChatMessage(role: .guide, text: "\(next.label)ですね。ご飯屋は、一人で入りたいですか？")
        )
    }

    func chooseMealSolo(_ next: SoloPref, spoken: String? = nil) {
        mealPrefs.solo = next
        draft = ""
        phase = .mealBudget
        push(
            ChatMessage(role: .you, text: spoken ?? next.label),
            ChatMessage(role: .guide, text: "予算の目安はどれくらいですか？")
        )
    }

    func chooseMealBudget(_ next: BudgetPref, spoken: String? = nil) {
        mealPrefs.budget = next
        draft = ""
        let built = station.map {
            CourseBuilder.courses(for: $0, stay: stay, dayPart: dayPart, prefs: mealPrefs)
        } ?? []
        courses = built
        selectedCourse = nil
        phase = .course
        let text = built.isEmpty
            ? "この条件ではまわり方を組めませんでした。まずは「まわり方は決めない」で案内を開くか、滞在時間を変えてみてください。"
            : "\(dayPart.label)・\(stay.label)・\(mealPrefs.solo.label)・\(next.label)向けです。まずは「まわり方は決めない」で自由に歩くか、下の\(built.count)つのまわり方から選んでください。"
        push(
            ChatMessage(role: .you, text: spoken ?? next.label),
            ChatMessage(role: .guide, text: text)
        )
    }

    func chooseCourse(_ course: WalkCourse, spoken: String? = nil) {
        selectedCourse = course
        draft = ""
        phase = .ready
        let name = station?.name ?? ""
        push(
            ChatMessage(role: .you, text: spoken ?? course.title),
            ChatMessage(
                role: .guide,
                text: "「\(course.title)」で、\(name)の案内を開きます。立ち寄りは\(course.stops.count)か所、だいたい\(course.totalMinutes)分の想定です。"
            )
        )
        scheduleTour(tab: .walk)
    }

    func skipCourse(spoken: String? = nil) {
        selectedCourse = nil
        draft = ""
        phase = .ready
        let name = station?.name ?? ""
        push(
            ChatMessage(role: .you, text: spoken ?? "まわり方は決めない"),
            ChatMessage(role: .guide, text: "まわり方なしで、\(name)の案内を開きます。地図と観光から、好きなだけ寄り道してください。")
        )
        scheduleTour(tab: .map)
    }

    private func scheduleTour(tab: TourTab) {
        pendingTour?.cancel()
        pendingTour = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 450_000_000)
            guard !Task.isCancelled else { return }
            self?.openTour(tab: tab)
        }
    }

    func openTour(tab: TourTab) {
        activeSpot = nil
        secret = nil
        tourTab = tab
        guideKind = .sight
        guideShowsBike = false
        phase = .ready
        screen = .tour
        // 誤ピン修正＋営業時間フィルタ後のコースに差し替える
        if let station {
            let fixed = CourseBuilder.snapLandmarkPins(station)
            if fixed.spots.contains(where: { spot in
                guard let original = station.spots.first(where: { $0.id == spot.id }) else { return false }
                return abs(original.lat - spot.lat) > 0.0003 || abs(original.lng - spot.lng) > 0.0003
            }) {
                remember(fixed, persist: true)
            }
            let built = CourseBuilder.courses(
                for: fixed, stay: stay, dayPart: dayPart, prefs: mealPrefs
            )
            courses = built
            if let selected = selectedCourse {
                selectedCourse = built.first(where: { $0.id == selected.id }) ?? built.first
            }
        }
    }

    /// 設定の「調べた駅」から、保存済みの案内を思い出す。
    func recallSavedStation(_ next: Station) {
        let sealed = CourseBuilder.ensureLocalMajors(CourseBuilder.snapLandmarkPins(next))
        remember(sealed, persist: true)
        stationId = sealed.id
        selectedCourse = nil
        courses = CourseBuilder.courses(
            for: sealed, stay: stay, dayPart: dayPart, prefs: mealPrefs
        )
        secret = nil
        activeSpot = nil
        guideKind = .sight
        guideShowsBike = false
        tourTab = .map
        phase = .ready
        screen = .tour
    }

    /// 調べた駅リストから外す（端末の保存も消す）。
    func forgetSavedStation(_ next: Station) {
        let saved = SavedStationStore.remove(id: next.id)
        savedStationIds = Set(saved.map(\.id))
        stations = SavedStationStore.merge(bundled: StationStore.loadBundled(), saved: saved)
        if stationId == next.id {
            stationId = saved.first?.id ?? stations.first?.id ?? ""
        }
    }

    func submitDraft() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, phase != .ready else { return }

        func retry(_ hint: String) {
            push(ChatMessage(role: .you, text: text), ChatMessage(role: .guide, text: hint))
            draft = ""
        }

        switch phase {
        case .station:
            // 保存済みがあっても毎回 AI 解析（収録・ストックに頼らない）
            requestAiStation(text, spoken: text)
        case .clock:
            if let hit = TextMatch.dayPart(text) {
                chooseClock(hit, spoken: text)
            } else {
                retry("いまの時間帯は「朝」「昼まえ」「昼すぎ」「夕方」「夜」、または「14時」のように教えてください。")
            }
        case .stay:
            if let hit = TextMatch.stay(text) {
                chooseStay(hit, spoken: text)
            } else {
                retry("滞在は「1時間」「3時間」「半日」のどれかで教えてください。")
            }
        case .mealSolo:
            if let hit = TextMatch.solo(text) {
                chooseMealSolo(hit, spoken: text)
            } else {
                retry("「一人で入りたい」「人数は気にしない」「みんなで寄りたい」のどれかで教えてください。")
            }
        case .mealBudget:
            if let hit = TextMatch.budget(text) {
                chooseMealBudget(hit, spoken: text)
            } else {
                retry("予算は「気軽に」「少し奮発」「どちらでも」のどれかで教えてください。")
            }
        case .course:
            if TextMatch.skipsCourse(text) {
                skipCourse(spoken: text)
            } else if let hit = courses.first(where: { text.contains($0.title) || $0.title.contains(text) }) {
                chooseCourse(hit, spoken: text)
            } else {
                retry("下のまわり方から選ぶか、「まわり方は決めない」と入力してください。")
            }
        case .ready:
            break
        }
    }

    // MARK: - Tour

    /// コースに焼き付いた古い座標ではなく、正本レジストリ＋現在の案内から開く。
    /// 土地ページから選んだときは地図へ移して、その場所へ行く。
    func openSpot(_ spot: Spot) {
        activeSpot = resolvedSpot(spot)
        if tourTab == .place || tourTab == .walk || tourTab == .guide {
            tourTab = .map
        }
    }

    func resolvedSpot(_ spot: Spot) -> Spot {
        let name = station?.name ?? ""
        if let live = station.map({ CourseBuilder.snapLandmarkPins($0) })?
            .spots.first(where: { $0.id == spot.id || $0.name == spot.name }) {
            return LandmarkRegistry.apply(live, stationName: name)
        }
        return LandmarkRegistry.apply(spot, stationName: name)
    }

    func drawSecret() {
        secret = CourseBuilder.pickSecret(tourSpots)
        tourTab = .more
        if let secret {
            activeSpot = resolvedSpot(secret)
        }
    }
}

func formatKm(_ km: Double) -> String {
    km == km.rounded() ? String(Int(km)) : String(format: "%.1f", km)
}
