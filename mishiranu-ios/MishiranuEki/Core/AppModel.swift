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
        case .more: return "ほか"
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
    "知らない駅に到着しましたね。まず現在地から最寄りの駅名を探すか、駅名を教えてください。見つかったら、いま何時か・滞在・ご飯は一人で入れるか／予算を聞いて、3つのコースを組み立てます。"

/// 現在地から自動で選ぶ駅の上限距離。
let nearbyStationKm = 3.5

@MainActor
@Observable
final class AppModel {
    let stations: [Station]

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

    var tourTab: TourTab = .map
    var guideKind: GuideKind = .sight
    var activeSpot: Spot?
    var secret: Spot?

    private let now: () -> Date
    @ObservationIgnored private var pendingTour: Task<Void, Never>?

    init(stations: [Station], now: @escaping () -> Date = Date.init) {
        self.stations = stations
        self.now = now
        self.stationId = stations.first(where: { $0.id == "demachiyanagi" })?.id ?? stations.first?.id ?? ""
        self.dayPart = DayPart.from(hour: Calendar.current.component(.hour, from: now()))
    }

    // MARK: - Derived

    var station: Station? {
        stations.first { $0.id == stationId } ?? stations.first
    }

    var radiusKm: Double { station?.radiusKm(for: stay) ?? 1 }

    /// 徒歩圏のスポット。コースを選んだときは立ち寄り順を先に。
    var tourSpots: [Spot] {
        guard let station else { return [] }
        let base = station.spots(for: stay)
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
        let items = tourSpots.filter { $0.guide == kind }
        guard kind == .meal else { return items }
        return items.enumerated()
            .sorted { lhs, rhs in
                let a = CourseBuilder.mealPrefScore(lhs.element, prefs: mealPrefs)
                let b = CourseBuilder.mealPrefScore(rhs.element, prefs: mealPrefs)
                return a == b ? lhs.offset < rhs.offset : a > b
            }
            .map(\.element)
    }

    var hasMealPrefs: Bool { mealPrefs.solo != .either || mealPrefs.budget != .either }

    var filteredStations: [Station] { TextMatch.filterStations(query, in: stations) }

    var composerPlaceholder: String {
        switch phase {
        case .station: return "例: 中書島にいます"
        case .clock: return "例: いま14時ごろ / 夕方"
        case .stay: return "例: 3時間くらい"
        case .mealSolo: return "例: 一人で入りたい"
        case .mealBudget: return "例: 気軽に / 少し奮発"
        case .course: return "例: ゆる歩きコース / コースは作らない"
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
            lines.append("コース: \(course.title)（\(course.stops.map(\.spot.name).joined(separator: " → "))）")
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

    func quickDemo() {
        resetChat()
        stationId = stations.first(where: { $0.id == "demachiyanagi" })?.id ?? stationId
        stay = .oneHour
        openTour(tab: .map)
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

    func chooseStation(_ next: Station, spoken: String? = nil, omitYou: Bool = false) {
        stationId = next.id
        showStationSearch = false
        query = ""
        draft = ""
        courses = []
        selectedCourse = nil
        mealPrefs = MealPrefs()
        phase = .clock
        let guideText = "\(next.name)ですね。\(next.prefecture)・\(next.line)。いま何時ごろですか？ 時刻に合わせてコースを組み立てます。"
        if !omitYou {
            push(ChatMessage(role: .you, text: spoken ?? "\(next.name)駅です"))
        }
        push(ChatMessage(role: .guide, text: guideText))
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
            "いちばん近い編集駅は\($0.station.name)（\(Geo.distanceLabel(km: $0.km))）ですが、徒歩圏外です。"
        } ?? ""
        push(ChatMessage(
            role: .guide,
            text: "\(nearestHint)位置情報は端末の外に送っていません。駅名を入力するか、「駅名で探す」から選んでください。"
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
            ? "この条件ではコースを組めませんでした。まずは「コースは作らない」で案内を開くか、滞在時間を変えてみてください。"
            : "\(dayPart.label)・\(stay.label)・\(mealPrefs.solo.label)・\(next.label)向けです。まずは「コースは作らない」で自由に歩くか、下の\(built.count)つのコースから選んでください。"
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
            ChatMessage(role: .you, text: spoken ?? "コースは作らない"),
            ChatMessage(role: .guide, text: "コースなしで、\(name)の案内を開きます。地図と観光から、好きなだけ寄り道してください。")
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

    private func openTour(tab: TourTab) {
        activeSpot = nil
        secret = nil
        tourTab = tab
        guideKind = .sight
        phase = .ready
        screen = .tour
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
            if let hit = TextMatch.station(text, in: stations) {
                chooseStation(hit, spoken: text)
            } else {
                showStationSearch = true
                query = ""
                retry("「\(text.hasSuffix("駅") ? String(text.dropLast()) : text)」は、まだ編集リストにありません。いまは\(stations.count)駅を収録しています。「駅名で探す」から選ぶか、近くの駅名で教えてください。")
            }
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
                retry("下のコースから選ぶか、「コースは作らない」と入力してください。")
            }
        case .ready:
            break
        }
    }

    // MARK: - Tour

    func openSpot(_ spot: Spot) {
        activeSpot = spot
    }

    func drawSecret() {
        secret = CourseBuilder.pickSecret(tourSpots)
        tourTab = .more
        if let secret {
            activeSpot = secret
        }
    }
}

func formatKm(_ km: Double) -> String {
    km == km.rounded() ? String(Int(km)) : String(format: "%.1f", km)
}
