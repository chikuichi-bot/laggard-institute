import Foundation
import Observation

struct ChatMessage: Identifiable, Hashable {
    enum Role: Hashable { case guide, you }

    let id = UUID()
    let role: Role
    let text: String
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
    "知らない駅に到着しましたね。駅名を教えるか、現在地から近い保存済みの駅を探します。どの駅も検索でき、初めての駅は Gemini が徒歩圏を編集します。一度見た駅は、この端末に少しずつ残ります。"

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
        self.stations = stations
        self.now = now
        self.stationId = saved.first?.id ?? stations.first?.id ?? ""
        self.dayPart = DayPart.from(hour: Calendar.current.component(.hour, from: now()))
    }

    var savedCount: Int { savedStationIds.count }

    // MARK: - Derived

    var station: Station? {
        stations.first { $0.id == stationId } ?? stations.first
    }

    var radiusKm: Double { station?.radiusKm(for: stay) ?? 1 }

    /// 徒歩圏のスポット。コースを選んだときは立ち寄り順を先に。
    var tourSpots: [Spot] {
        guard let station else { return [] }
        let base = CourseBuilder.snapLandmarkPins(CourseBuilder.normalizeEdibleSouvenirs(station))
            .spots(for: stay)
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
        let normalized = CourseBuilder.snapLandmarkPins(
            CourseBuilder.normalizeEdibleSouvenirs(station)
        )
        // ご飯はメジャー定番のみ（利次郎など二番手は出さない）
        var items = normalized.spots.filter { $0.guide == kind }
        if kind == .meal {
            items = MealStapleCatcher.keepMajorMealsOnly(
                items.map { spot in
                    // keepMajor は meal 以外も通すので、meal 配列だけ渡す
                    spot
                } + normalized.spots.filter { $0.guide != .meal },
                stationName: station.name
            ).filter { $0.guide == .meal }
        }
        // その時間帯に閉まっている店は案内から外す（ふたばの夜など）
        if kind == .meal || kind == .souvenir || kind == .rest {
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
        // 名物菓子は meal 扱いでもお土産タブに出す（ふたば・みたらし等）
        if kind == .souvenir {
            let extras = normalized.spots.filter {
                $0.guide != .souvenir && CourseBuilder.isEdibleOmiyage($0)
            }
            for spot in extras where !items.contains(where: { $0.id == spot.id }) {
                items.append(spot)
            }
        }
        guard kind == .meal else {
            return items.sorted { lhs, rhs in
                let a = CourseBuilder.isEdibleOmiyage(lhs)
                let b = CourseBuilder.isEdibleOmiyage(rhs)
                if a != b { return a && !b }
                return lhs.walkMinutes < rhs.walkMinutes
            }
        }
        return items.enumerated()
            .sorted { lhs, rhs in
                let stapleA = CourseBuilder.mealStapleScore(lhs.element)
                let stapleB = CourseBuilder.mealStapleScore(rhs.element)
                if stapleA != stapleB { return stapleA > stapleB }
                let a = CourseBuilder.mealPrefScore(lhs.element, prefs: mealPrefs)
                let b = CourseBuilder.mealPrefScore(rhs.element, prefs: mealPrefs)
                if a != b { return a > b }
                return lhs.element.walkMinutes < rhs.element.walkMinutes
            }
            .map(\.element)
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
        case .course: return "例: 初心者コース / まわり方は決めない"
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

    // MARK: - Chat steps

    func chooseStation(_ next: Station, spoken: String? = nil, omitYou: Bool = false, persist: Bool = false) {
        remember(next, persist: persist || next.id.hasPrefix("ai-"))
        stationId = next.id
        showStationSearch = false
        query = ""
        draft = ""
        courses = []
        selectedCourse = nil
        mealPrefs = MealPrefs()
        phase = .clock
        let guideText = "\(next.name)ですね。\(next.prefecture)・\(next.line)。いま何時ごろですか？ 時刻に合わせて、まわり方を組み立てます。"
        if !omitYou {
            push(ChatMessage(role: .you, text: spoken ?? "\(next.name)駅です"))
        }
        push(ChatMessage(role: .guide, text: guideText))
        relocateIfNeeded(next)
    }

    /// AI の駅は、Apple マップの周辺 POI で店・座標を仕入れてから保存する。
    private func relocateIfNeeded(_ station: Station) {
        guard station.id.hasPrefix("ai-") else { return }
        Task { [weak self] in
            let located = CourseBuilder.snapLandmarkPins(await SpotLocator.refine(station))
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
        stationLoading = true
        screen = .chat
        phase = .station
        showStationSearch = true
        query = name
        draft = ""
        let bare = name.hasSuffix("駅") ? String(name.dropLast()) : name
        push(
            ChatMessage(role: .you, text: spoken ?? "\(bare)駅です"),
            ChatMessage(role: .guide, text: "「\(bare)」の徒歩圏を、Gemini が編集しています…")
        )
        pendingStationLookup?.cancel()
        pendingStationLookup = Task { [weak self] in
            guard let self else { return }
            do {
                let station = try await StationAPIClient.lookupStation(name: bare)
                guard !Task.isCancelled else { return }
                self.stationLoading = false
                self.chooseStation(station, omitYou: true, persist: true)
            } catch is CancellationError {
                self.stationLoading = false
            } catch {
                self.stationLoading = false
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
            text: "\(nearestHint)位置情報は端末の外に送っていません。駅名を入力すれば、全国どこでも Gemini が案内を編集します。"
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
    func openSpot(_ spot: Spot) {
        activeSpot = resolvedSpot(spot)
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
