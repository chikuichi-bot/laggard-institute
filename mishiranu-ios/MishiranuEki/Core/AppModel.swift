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
    /// 駅を決めるだけ。決まったらすぐ土地ページへ（時間・滞在・ご飯設定は聞かない）。
    case station, ready
}

enum TourTab: String, CaseIterable, Identifiable, Hashable {
    /// 左から: 土地 → 地図 → 案内 → 歩く → 設定
    case place, map, guide, walk, more

    var id: String { rawValue }

    var label: String {
        switch self {
        case .place: return "土地"
        case .map: return "地図"
        case .guide: return "案内"
        case .walk: return "歩く"
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
    "知らない駅に到着しましたね。現在地から探すか、駅名を入力してください。決まると、その土地の案内を開きます。一度見た駅は、この端末に残ります。"

/// 現在地から自動で選ぶ駅の上限距離。
let nearbyStationKm = 3.5

@MainActor
@Observable
final class AppModel {
    var stations: [Station]
    private(set) var savedStationIds: Set<String>

    var screen: Screen = .hero
    var stationId: String
    /// 質問では聞かない。内部では「半日」相当で徒歩圏を広く取る。
    var stay: StayOption = .halfDay
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
    var tourTab: TourTab = .place
    var guideKind: GuideKind = .sight
    /// 案内タブでレンタサイクルを選んでいるとき true。
    var guideShowsBike = false
    var activeSpot: Spot?
    /// トップページの短い案内・エラー（到着チャットは使わない）。
    var heroNote: String?

    private let now: () -> Date
    @ObservationIgnored private var pendingTour: Task<Void, Never>?
    @ObservationIgnored private var pendingStationLookup: Task<Void, Never>?

    init(stations: [Station], now: @escaping () -> Date = Date.init) {
        let saved = SavedStationStore.load()
        self.savedStationIds = Set(saved.map(\.id))
        // 保存済みの近所の寺なども、起動時に一度落としてメジャーな普通のところだけにする。
        // 土地文の川名逆転なども refine で直してから端末へ書き戻す。
        let scrubbed = stations.map {
            LandProse.refine(
                CourseBuilder.ensureLocalMajors(
                    CourseBuilder.snapLandmarkPins(LandmarkRegistry.applyingStationCenter($0))
                )
            )
        }
        self.stations = scrubbed
        self.now = now
        self.stationId = saved.first?.id ?? scrubbed.first?.id ?? ""
        self.dayPart = DayPart.from(hour: Calendar.current.component(.hour, from: now()))
        for station in scrubbed where savedStationIds.contains(station.id) {
            _ = SavedStationStore.upsert(station)
        }
    }

    var savedCount: Int { savedStationIds.count }

    /// 設定画面用。調べた順（新しいものが先）。ディスク正本を優先し、メモリ上の新しい版があれば差し替える。
    var savedStations: [Station] {
        SavedStationStore.load().map { disk in
            stations.first {
                $0.id == disk.id
                    || SavedStationStore.bareName($0.name) == SavedStationStore.bareName(disk.name)
            } ?? disk
        }
    }

    // MARK: - Derived

    var station: Station? {
        stations.first { $0.id == stationId } ?? stations.first
    }

    var radiusKm: Double { station?.radiusKm(for: stay) ?? 1 }

    /// 徒歩圏のスポット（地図用）。lock / Apple 確定のみ。コース順があれば先に。
    var tourSpots: [Spot] {
        guard let station else { return [] }
        let trusted = MapPinTrust.mapSpots(
            from: StationLore.introducedVisitSpots(in: station),
            stationName: station.name
        )
        guard let course = selectedCourse, !course.stops.isEmpty else { return trusted }
        let stopIds = course.stops.map(\.spot.id)
        let ordered = stopIds.compactMap { id in trusted.first { $0.id == id } }
        return ordered + trusted.filter { !stopIds.contains($0.id) }
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

    /// 案内タブは実用一覧。土地文に名前が無くても、AIが拾った店・名所を出す。
    /// （歩くコースは土地文寄り。案内は件数を厚くする）
    /// 並びは駅から近い順（信頼ピンは座標、未確定は徒歩分）。
    /// 案内のご飯・お土産・休むところ。本番の地図にも同じ店を出す。
    var guideShopSpots: [Spot] {
        guard let station else { return [] }
        let kinds: Set<GuideKind> = [.meal, .souvenir, .rest]
        return guidePool(for: station).filter { spot in
            kinds.contains(spot.guide)
                && !(spot.lat == 0 && spot.lng == 0)
                && !DemachiTemplate.isForeignDemachiPlace(spot.name, stationName: station.name)
        }
    }

    private func guidePool(for station: Station) -> [Spot] {
        let sealed = CourseBuilder.snapLandmarkPins(
            LandMentionSeeder.ensure(
                on: CourseBuilder.normalizeEdibleSouvenirs(station)
            )
        )
        return FirstVisitFaces.collapseWorshipDuplicates(
            sealed.spots.filter {
                !$0.name.hasSuffix("駅")
                    && !PlaceNoise.isNoise($0.name)
                    && !FirstVisitFaces.isNeighborhoodWorship(
                        $0.name, stationName: sealed.name
                    )
            },
            stationName: station.name
        )
    }

    func guideSpots(_ kind: GuideKind) -> [Spot] {
        guard let station else { return [] }
        let pool = guidePool(for: station)
        var items = pool.filter { $0.guide == kind }
        // 名物菓子は meal でもお土産タブに出す（地図上のふたば等）
        if kind == .souvenir {
            for spot in pool where spot.guide != .souvenir && CourseBuilder.isEdibleOmiyage(spot) {
                if !items.contains(where: {
                    $0.id == spot.id || NameMatch.score($0.name, spot.name) >= 85
                }) {
                    items.append(spot)
                }
            }
        }
        let enriched = items.map { spot -> Spot in
            let text = SpotCopy.blurb(for: spot, in: station)
            let blurb: String = {
                if MapPinTrust.allowsOnMap(spot, stationName: station.name) { return text }
                let note = "（地図の位置は未確定）"
                return text.contains(note) ? text : text + note
            }()
            guard blurb != spot.blurb else { return spot }
            return Spot(
                id: spot.id, name: spot.name, genre: spot.genre, guide: spot.guide,
                mealTier: spot.mealTier, mealTimes: spot.mealTimes, soloOk: spot.soloOk,
                budgetYen: spot.budgetYen, hours: spot.hours, blurb: blurb,
                detail: spot.detail, walkMinutes: spot.walkMinutes,
                secretWorthy: spot.secretWorthy, majorWorthy: spot.majorWorthy,
                lat: spot.lat, lng: spot.lng, coordTrust: spot.coordTrust
            )
        }
        return Self.sortGuideNearStation(enriched, station: station, kind: kind, prefs: mealPrefs)
    }

    /// 案内タブ専用: 駅から近い順。
    static func sortGuideNearStation(
        _ spots: [Spot],
        station: Station,
        kind: GuideKind,
        prefs: MealPrefs
    ) -> [Spot] {
        func meters(from spot: Spot) -> Double {
            // 地図未確定は距離ソートに使わない（仮ピンで先頭に来ないように）
            if !MapPinTrust.allowsOnMap(spot, stationName: station.name) {
                return 50_000 + Double(spot.walkMinutes) * 80
            }
            let km = Geo.haversineKm(
                lat1: station.lat, lng1: station.lng,
                lat2: spot.lat, lng2: spot.lng
            )
            if km < 0.02, spot.walkMinutes > 0 {
                return Double(spot.walkMinutes) * 80
            }
            return km * 1000
        }
        return spots.sorted { lhs, rhs in
            let dm = meters(from: lhs) - meters(from: rhs)
            if abs(dm) > 25 { return dm < 0 }
            if lhs.walkMinutes != rhs.walkMinutes {
                return lhs.walkMinutes < rhs.walkMinutes
            }
            if kind == .meal {
                let a = CourseBuilder.mealPrefScore(lhs, prefs: prefs)
                let b = CourseBuilder.mealPrefScore(rhs, prefs: prefs)
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
        phase == .station ? "例: 藤森 / 出町柳" : ""
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
        return lines.joined(separator: "\n")
    }

    // MARK: - Navigation

    func goHero() {
        pendingTour?.cancel()
        pendingStationLookup?.cancel()
        screen = .hero
        resetHome()
    }

    /// 互換: 駅を探し直す＝トップへ。
    func startArrival() {
        goHero()
    }

    private func resetHome() {
        pendingTour?.cancel()
        phase = .station
        showStationSearch = false
        geoLoading = false
        stationLoading = false
        courses = []
        selectedCourse = nil
        mealPrefs = MealPrefs()
        dayPart = DayPart.from(hour: Calendar.current.component(.hour, from: now()))
        query = ""
        draft = ""
        activeSpot = nil
        heroNote = nil
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
        let sealed = DemachiTemplate.scrubContamination(
            on: LandProse.refine(
                CourseBuilder.ensureLocalMajors(CourseBuilder.snapLandmarkPins(next))
            )
        )
        remember(sealed, persist: persist)
        stationId = sealed.id
        showStationSearch = false
        query = ""
        draft = ""
        selectedCourse = nil
        mealPrefs = MealPrefs()
        // いまの時刻だけで十分。滞在・ご飯・まわり方は聞かない。
        dayPart = DayPart.from(hour: Calendar.current.component(.hour, from: now()))
        stay = .halfDay
        applyOrdinaryWalk(for: sealed)
        if !omitYou {
            push(ChatMessage(role: .you, text: spoken ?? "\(sealed.name)駅です"))
        }
        push(ChatMessage(
            role: .guide,
            text: "\(sealed.name)（\(sealed.prefecture)・\(sealed.line)）。土地の案内を開きます。"
        ))
        openTour(tab: .place)
        relocateIfNeeded(sealed)
    }

    /// 歩くタブ＝ショート／ロング（道なり最適化）。既定はショート。
    /// 前の駅のコースは絶対に残さない（墨染の画面に出町の3点が残る事故）。
    private func applyOrdinaryWalk(for station: Station) {
        let bare = SavedStationStore.bareName(station.name)
        let ordinary = CourseBuilder.firstVisitOrdinaryCourses(
            for: station, dayPart: dayPart, stay: stay
        ).filter { course in
            course.id.contains(bare) && courseFitsStation(course, station: station)
        }
        let ordinaryIds = Set(ordinary.map(\.id))
        let others = CourseBuilder.courses(
            for: station, stay: stay, dayPart: dayPart, prefs: mealPrefs
        ).filter { course in
            !ordinaryIds.contains(course.id) && courseFitsStation(course, station: station)
        }
        courses = ordinary + others
        selectedCourse = ordinary.first ?? others.first
    }

    /// 表示中の駅とコースが食い違っていたら組み直す。
    func syncWalkCourse() {
        guard let station else {
            selectedCourse = nil
            courses = []
            return
        }
        if let course = selectedCourse, courseFitsStation(course, station: station),
           course.id.contains(SavedStationStore.bareName(station.name)) {
            return
        }
        applyOrdinaryWalk(for: station)
    }

    private func courseFitsStation(_ course: WalkCourse, station: Station) -> Bool {
        !course.stops.contains {
            DemachiTemplate.isForeignDemachiPlace($0.spot.name, stationName: station.name)
                || !DemachiTemplate.spotNearStation($0.spot, station: station)
        }
    }

    /// 歩くページからショート／ロングを選ぶ。
    func selectWalkCourse(_ course: WalkCourse) {
        selectedCourse = course
    }

    /// 歩くタブに出すショート／ロング。
    var ordinaryWalkCourses: [WalkCourse] {
        courses.filter {
            $0.id.contains("ordinary-short") || $0.id.contains("ordinary-long")
        }
    }

    /// Apple マップの周辺 POI で店・座標を仕入れてから保存する。
    /// 保存済み駅も再採取する（昔の AI 仮座標・半径外で落ちたみたらし等が残るため）。
    private func relocateIfNeeded(_ station: Station) {
        Task { [weak self] in
            let located = DemachiTemplate.scrubContamination(
                on: CourseBuilder.ensureLocalMajors(
                    CourseBuilder.snapLandmarkPins(await SpotLocator.refine(station))
                )
            )
            guard let self, !Task.isCancelled, self.stationId == station.id || self.stations.contains(where: { $0.id == station.id }) else { return }
            self.remember(located, persist: true)
            // 座標確定後にメジャー印付きでまわり方を組み直す
            if self.phase == .ready || self.screen == .tour {
                self.applyOrdinaryWalk(for: located)
            }
        }
    }

    /// カタログに載せ、必要なら端末へ保存。
    private func remember(_ next: Station, persist: Bool) {
        let sealed = SavedStationStore.sealedForLibrary(next)
        if let index = stations.firstIndex(where: {
            $0.id == sealed.id
                || SavedStationStore.bareName($0.name) == SavedStationStore.bareName(sealed.name)
        }) {
            stations[index] = sealed
        } else {
            stations.insert(sealed, at: 0)
        }
        if persist {
            let saved = SavedStationStore.upsert(sealed)
            savedStationIds = Set(saved.map(\.id))
            stations = SavedStationStore.merge(bundled: StationStore.loadBundled(), saved: saved)
        }
    }

    /// 保存がほぼ空か（スポットも土地文も無いときだけ自動で作り直す）。
    private static func isUnusableSaved(_ station: Station) -> Bool {
        let prose =
            (station.stationIntro?.count ?? 0)
            + (station.areaAbout?.count ?? 0)
            + (station.walkGuide?.count ?? 0)
            + station.historyNotes.reduce(0) { $0 + $1.body.count }
        return station.spots.isEmpty && prose < 80
    }

    /// - Parameter forceRefresh: true なら保存を無視して AI で作り直す（設定の「案内を作り直す」）。
    func requestAiStation(_ rawName: String, spoken: String? = nil, forceRefresh: Bool = false) {
        let name = rawName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, !stationLoading else { return }
        let bare = name.hasSuffix("駅") ? String(name.dropLast()) : name

        // 一度調べた駅は端末から開く（毎回 Gemini しない）。
        // 作り直しは設定の forceRefresh だけ。薄い判定で消さない。
        if !forceRefresh,
           let saved = SavedStationStore.find(byName: bare, in: stations)
            ?? SavedStationStore.find(byName: bare) {
            let scrubbed = DemachiTemplate.scrubContamination(on: saved)
            if !Self.isUnusableSaved(scrubbed) {
                phase = .station
                showStationSearch = false
                query = ""
                draft = ""
                heroNote = nil
                chooseStation(scrubbed, omitYou: true, persist: true)
                return
            }
        }

        if let coinError = BillingStore.shared.tryConsumeGenerationCoin() {
            heroNote = coinError
            tourTab = .more
            if station != nil {
                screen = .tour
            }
            return
        }

        stationLoading = true
        phase = .station
        query = name
        draft = ""
        // 作成中の文言は Root のポップアップ。ここはエラー用に空ける。
        heroNote = nil
        if screen != .tour {
            screen = .hero
        }

        pendingStationLookup?.cancel()
        pendingStationLookup = Task { @MainActor [weak self] in
            guard let self else { return }
            do {
                let station = try await StationAPIClient.lookupStation(
                    name: bare,
                    userAi: BillingStore.shared.userAiPayload
                )
                guard !Task.isCancelled else { return }
                self.stationLoading = false
                self.heroNote = nil
                // 調べた結果は必ず端末へ残す
                self.chooseStation(station, omitYou: true, persist: true)
            } catch is CancellationError {
                BillingStore.shared.refundGenerationCoin()
                self.stationLoading = false
                self.heroNote = nil
            } catch {
                BillingStore.shared.refundGenerationCoin()
                self.stationLoading = false
                let message = (error as? LocalizedError)?.errorDescription?
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                self.heroNote = (message?.isEmpty == false)
                    ? message!
                    : "案内の通信に失敗しました。通信状況をみて、もう一度どうぞ。"
            }
        }
    }

    /// 位置取得を始めたときに呼ぶ。false なら取得中なので何もしない。
    func beginLocate() -> Bool {
        guard !geoLoading else { return false }
        geoLoading = true
        // 読み込み文はボタン側だけ。heroNote と重ねない。
        heroNote = nil
        screen = .hero
        return true
    }

    func finishLocate(lat: Double, lng: Double) {
        geoLoading = false
        let hit = Geo.nearestStation(lat: lat, lng: lng, in: stations)
        if let hit, hit.km <= nearbyStationKm {
            heroNote = nil
            chooseStation(hit.station, omitYou: true)
            return
        }
        let nearestHint = hit.map {
            "いちばん近い保存済みの駅は\($0.station.name)（\(Geo.distanceLabel(km: $0.km))）ですが、徒歩圏外です。"
        } ?? ""
        heroNote = "\(nearestHint)駅名を入力すれば、全国どこでも徒歩圏の案内をつくれます。"
        screen = .hero
    }

    func failLocate(_ failure: LocateFailure) {
        geoLoading = false
        heroNote = failure.message
        screen = .hero
    }


    func openTour(tab: TourTab) {
        activeSpot = nil
        tourTab = tab
        guideKind = .sight
        guideShowsBike = false
        phase = .ready
        screen = .tour
        // 誤ピン修正＋出町汚染落とし＋営業時間フィルタ後のコースに差し替える
        if let station {
            let fixed = DemachiTemplate.scrubContamination(
                on: LandProse.refine(
                    CourseBuilder.ensureLocalMajors(CourseBuilder.snapLandmarkPins(station))
                )
            )
            if fixed.sightseeingNotes.map(\.title) != station.sightseeingNotes.map(\.title)
                || fixed.spots.count != station.spots.count
                || fixed.spots.contains(where: { spot in
                    guard let original = station.spots.first(where: { $0.id == spot.id }) else {
                        return true
                    }
                    return abs(original.lat - spot.lat) > 0.0003
                        || abs(original.lng - spot.lng) > 0.0003
                })
            {
                remember(fixed, persist: true)
            }
            applyOrdinaryWalk(for: fixed)
        }
    }

    /// 設定の「調べた駅」から、保存済みの案内を思い出す。
    /// 駅名スタートと同じく、最初は土地ページを開く（地図は土地の次）。
    func recallSavedStation(_ next: Station) {
        let sealed = BikeRentalSeal.ensure(
            DemachiTemplate.scrubContamination(
                on: CourseBuilder.ensureLocalMajors(CourseBuilder.snapLandmarkPins(next))
            )
        )
        // ほぼ空のときだけ作り直し。一度調べた内容は消さない。
        if Self.isUnusableSaved(sealed) {
            requestAiStation(sealed.name, forceRefresh: true)
            return
        }
        remember(sealed, persist: true)
        stationId = sealed.id
        selectedCourse = nil
        openTour(tab: .place)
        relocateIfNeeded(sealed)
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
            requestAiStation(text, spoken: text)
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

}

func formatKm(_ km: Double) -> String {
    km == km.rounded() ? String(Int(km)) : String(format: "%.1f", km)
}
