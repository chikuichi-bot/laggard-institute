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
    /// コイン前チラ見せ中（本生成で上書き・保存しない）。旧 MapKit 輪郭用。物語peekでは使わない。
    var isStationPreview = false
    /// 無料の物語のゆかりを出し、コインで散歩道を開く待ち。
    var awaitingDetailConfirm = false
    /// 旧輪郭一行（互換）。物語peekでは空。
    var contourSummary: String = ""
    /// 物語のゆかりが手元にあるか（空きでも確認は出す）。
    var contourIsDecisionUseful = false
    /// 詳しく調べる対象の駅名（駅なし）。
    var pendingDetailBare: String = ""
    /// コイン前に見せる物語のゆかり（正本。保存しない）。
    var pendingStoryNotes: [HistoryNote] = []
    /// 待ちUIに出す短い手がかり。
    var previewHints: [String] = []
    /// 旧 MapKit 輪郭取得中。物語peekでは使わない（常に false 想定）。
    var contourLoading = false
    var tourTab: TourTab = .place
    var guideKind: GuideKind = .sight
    /// 案内タブでレンタサイクルを選んでいるとき true。
    var guideShowsBike = false
    var activeSpot: Spot?
    /// トップページの短い案内・エラー（到着チャットは使わない）。
    var heroNote: String?
    /// 設定など、トップ以外でも見せる短い案内・エラー。
    var stationNotice: String?
    /// 土地案内の読み上げ。タブをまたいでも止めない（歩きながら聴く）。
    let placeNarrator = PlaceNarrator()

    private let now: () -> Date
    @ObservationIgnored private var pendingTour: Task<Void, Never>?
    @ObservationIgnored private var pendingStationLookup: Task<Void, Never>?
    /// 今回の案内生成でコインを既に引いたか（キャンセル／失敗時の返金用）。
    @ObservationIgnored private var coinConsumedForLookup = false

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
        self.now = now
        self.dayPart = DayPart.from(hour: Calendar.current.component(.hour, from: now()))
        // 調べ済みすべてに物語のゆかり正本＋地図ピンを載せ、ディスクへ書き戻す。
        // 1件ずつ upsert すると毎回先頭に寄せて並びが逆転するので、順序はそのまま一括書き戻し。
        let sealedSaved = saved.map { GuideIntegrity.seal($0) }
        let written = SavedStationStore.replacePreservingOrder(sealedSaved)
        self.savedStationIds = Set(written.map(\.id))
        self.stations = SavedStationStore.merge(bundled: scrubbed, saved: written)
        self.stationId = written.first?.id ?? scrubbed.first?.id ?? ""
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

    /// 地図の徒歩圏。小回り 1.2km / 大回り 1.5km。
    var radiusKm: Double { PromenadeRadius.km(for: selectedCourse) }

    /// 徒歩圏のスポット（地図用）。lock / Apple 確定のみ。コース順があれば先に。
    var tourSpots: [Spot] {
        guard let station else { return [] }
        let trusted = MapPinTrust.mapSpots(
            from: StationLore.introducedVisitSpots(in: station),
            station: station
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
                if MapPinTrust.allowsOnMap(spot, in: station) { return text }
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
            if !MapPinTrust.allowsOnMap(spot, in: station) {
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
            "徒歩圏 約 \(formatKm(radiusKm)) km",
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
        contourLoading = false
        isStationPreview = false
        awaitingDetailConfirm = false
        contourSummary = ""
        contourIsDecisionUseful = false
        pendingDetailBare = ""
        pendingStoryNotes = []
        previewHints = []
        coinConsumedForLookup = false
        courses = []
        selectedCourse = nil
        mealPrefs = MealPrefs()
        dayPart = DayPart.from(hour: Calendar.current.component(.hour, from: now()))
        query = ""
        draft = ""
        activeSpot = nil
        heroNote = nil
        stationNotice = nil
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

    func chooseStation(
        _ next: Station,
        spoken: String? = nil,
        omitYou: Bool = false,
        persist: Bool = true,
        relocate: Bool = true
    ) {
        isStationPreview = false
        previewHints = []
        let sealed = GuideIntegrity.seal(next)
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
        if relocate {
            relocateIfNeeded(sealed)
        }
    }

    /// コイン前の MapKit 骨格。端末には保存せず、本生成で上書きする。
    private func applyStationPreview(_ next: Station, hints: [String]) {
        isStationPreview = true
        previewHints = hints
        let sealed = GuideIntegrity.seal(next)
        remember(sealed, persist: false)
        stationId = sealed.id
        showStationSearch = false
        draft = ""
        selectedCourse = nil
        mealPrefs = MealPrefs()
        dayPart = DayPart.from(hour: Calendar.current.component(.hour, from: now()))
        stay = .halfDay
        courses = []
        selectedCourse = nil
        openTour(tab: .place)
    }

    /// プレビューだけ残っていた駅をメモリから外す（保存済みは触らない）。
    private func discardStationPreviewIfNeeded() {
        guard isStationPreview else {
            previewHints = []
            return
        }
        let previewId = stationId
        let bare = stations.first { $0.id == previewId }.map { SavedStationStore.bareName($0.name) }
        if !savedStationIds.contains(previewId) {
            stations.removeAll { row in
                if row.id == previewId { return true }
                if let bare, SavedStationStore.bareName(row.name) == bare { return true }
                return false
            }
        }
        isStationPreview = false
        previewHints = []
        if stations.first(where: { $0.id == stationId }) == nil {
            stationId = savedStations.first?.id ?? stations.first?.id ?? ""
        }
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
            WalkInMealFilter.isNonWalkIn($0.spot)
                || DemachiTemplate.isForeignDemachiPlace($0.spot.name, stationName: station.name)
                || !DemachiTemplate.spotNearStation($0.spot, station: station)
        }
    }

    /// 歩くページからショート／ロングを選ぶ。
    func selectWalkCourse(_ course: WalkCourse) {
        selectedCourse = course
    }

    /// 空気の道設定を変えたあと、散歩コースを組み直す。
    func rebuildWalkForAtmospherePreference() {
        guard let station else { return }
        applyOrdinaryWalk(for: station)
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
            // 駅中心だけ先に直して見せる。周辺の採取は数十件の検索で時間がかかる。
            let centered = GuideIntegrity.seal(await SpotLocator.withVerifiedCenter(station))
            if let self, !Task.isCancelled,
               centered.lat != station.lat || centered.lng != station.lng {
                self.remember(centered, persist: true)
                if self.phase == .ready || self.screen == .tour {
                    self.applyOrdinaryWalk(for: centered)
                }
            }
            let located = GuideIntegrity.seal(await SpotLocator.refine(centered))
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
        // どの経路でも関所を通す（配食・出町混入・川の総称・閉業レンタ）
        let sealed = GuideIntegrity.seal(SavedStationStore.sealedForLibrary(next))
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
    /// 新規は無料の物語のゆかり→コインで散歩道。作り直しは確認済みなので本生成へ。
    func requestAiStation(_ rawName: String, spoken: String? = nil, forceRefresh: Bool = false) {
        let name = rawName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, !stationLoading, !contourLoading else { return }
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
                awaitingDetailConfirm = false
                pendingStoryNotes = []
                chooseStation(scrubbed, omitYou: true, persist: true)
                return
            }
        }

        if forceRefresh {
            startPaidGeneration(bare: bare, forceRefresh: true)
            return
        }

        // 無料: 物語のゆかりだけポップアップ。正本が無ければ API で調べる（コインなし）。
        pendingStationLookup?.cancel()
        pendingStationLookup = nil
        stationLoading = false
        isStationPreview = false
        discardStationPreviewIfNeeded()
        awaitingDetailConfirm = false
        pendingDetailBare = bare
        contourSummary = ""
        previewHints = []
        coinConsumedForLookup = false
        phase = .station
        query = name
        draft = ""
        heroNote = nil
        stationNotice = nil
        screen = .hero

        let localNotes = StoryPeekCopy.ensureWalkInvite(
            StoryNotesCanon.notes(forName: bare)
        )
        if !localNotes.isEmpty {
            pendingStoryNotes = localNotes
            contourIsDecisionUseful = true
            contourLoading = false
            awaitingDetailConfirm = true
            return
        }

        pendingStoryNotes = []
        contourIsDecisionUseful = false
        contourLoading = true
        previewHints = ["物語のゆかりを、無料で調べています"]

        pendingStationLookup = Task { @MainActor [weak self] in
            guard let self else { return }
            do {
                let notes = try await StationAPIClient.lookupStoryNotes(
                    name: bare,
                    userAi: BillingStore.shared.userAiPayload
                )
                if Task.isCancelled {
                    self.contourLoading = false
                    self.finishLookupCancelled()
                    return
                }
                self.contourLoading = false
                self.pendingStoryNotes = StoryPeekCopy.ensureWalkInvite(notes)
                self.contourIsDecisionUseful = !notes.isEmpty
                self.previewHints = []
                self.awaitingDetailConfirm = true
                self.pendingDetailBare = bare
            } catch is CancellationError {
                self.finishLookupCancelled()
            } catch {
                if Task.isCancelled {
                    self.finishLookupCancelled()
                    return
                }
                self.contourLoading = false
                // 調べ失敗でもコイン判断の窓は開く（空の物語＋本案内CTA）。
                self.pendingStoryNotes = []
                self.contourIsDecisionUseful = false
                self.previewHints = []
                self.awaitingDetailConfirm = true
                self.pendingDetailBare = bare
                let message = (error as? LocalizedError)?.errorDescription?
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                if let message, !message.isEmpty {
                    self.heroNote = message
                }
            }
        }
    }

    /// 物語のゆかりを見たあと、コインで散歩道（本案内）を開く。
    func confirmDetailGeneration() {
        let bare = pendingDetailBare.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !bare.isEmpty, !stationLoading else { return }
        awaitingDetailConfirm = false
        pendingStoryNotes = []
        startPaidGeneration(bare: bare, forceRefresh: false)
    }

    /// 物語のゆかりだけでやめる（コインなし）。
    func declineDetailGeneration() {
        awaitingDetailConfirm = false
        contourLoading = false
        pendingStationLookup?.cancel()
        pendingStationLookup = nil
        discardStationPreviewIfNeeded()
        contourSummary = ""
        contourIsDecisionUseful = false
        pendingDetailBare = ""
        pendingStoryNotes = []
        previewHints = []
        screen = .hero
        phase = .station
        query = ""
        draft = ""
        courses = []
        selectedCourse = nil
        heroNote = nil
    }

    /// コイン消費＋本生成。
    private func startPaidGeneration(bare: String, forceRefresh: Bool) {
        guard !bare.isEmpty, !stationLoading else { return }

        if let coinError = BillingStore.shared.tryConsumeGenerationCoin() {
            discardStationPreviewIfNeeded()
            awaitingDetailConfirm = false
            let label = bare.hasSuffix("駅") ? bare : "\(bare)駅"
            let note = "「\(label)」の案内：\(coinError)"
            heroNote = note
            stationNotice = note
            query = bare
            phase = .station
            screen = .hero
            tourTab = .place
            return
        }
        coinConsumedForLookup = BillingStore.shared.lastGenerationUsedCoin

        stationLoading = true
        awaitingDetailConfirm = false
        phase = .station
        query = bare
        draft = ""
        heroNote = nil
        stationNotice = nil
        if previewHints.isEmpty {
            previewHints = ["詳しい案内を調べています"]
        } else if !previewHints.contains(where: { $0.contains("詳しい案内") }) {
            previewHints.append("詳しい案内を調べています")
        }

        pendingStationLookup?.cancel()
        pendingStationLookup = Task { @MainActor [weak self] in
            guard let self else { return }
            do {
                let fetched = try await StationAPIClient.lookupStation(
                    name: bare,
                    userAi: BillingStore.shared.userAiPayload,
                    forceRefresh: forceRefresh
                )
                let station = await SpotLocator.withVerifiedCenter(fetched)
                if Task.isCancelled {
                    self.finishLookupCancelled()
                    return
                }
                if Self.isSuspiciousNameSwap(requested: bare, returned: station.name) {
                    self.refundLookupCoinIfNeeded()
                    self.stationLoading = false
                    self.discardStationPreviewIfNeeded()
                    let label = bare.hasSuffix("駅") ? bare : "\(bare)駅"
                    let note = "「\(label)」とは別の駅が返ってきました。名前を確認してもう一度どうぞ。"
                    self.heroNote = note
                    self.stationNotice = note
                    self.query = bare
                    self.screen = .hero
                    return
                }
                self.stationLoading = false
                self.coinConsumedForLookup = false
                self.contourSummary = ""
                self.pendingDetailBare = ""
                self.previewHints = []
                self.heroNote = nil
                self.stationNotice = nil
                self.chooseStation(station, omitYou: true, persist: true)
            } catch is CancellationError {
                self.finishLookupCancelled()
            } catch {
                self.refundLookupCoinIfNeeded()
                self.stationLoading = false
                self.discardStationPreviewIfNeeded()
                let message = (error as? LocalizedError)?.errorDescription?
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                let note = (message?.isEmpty == false)
                    ? message!
                    : "案内の通信に失敗しました。通信状況をみて、もう一度どうぞ。"
                self.heroNote = note
                self.stationNotice = note
                self.query = bare
                self.screen = .hero
            }
        }
    }

    /// 「淀屋橋」要求なのに「淀」が返るような、短い別名への吸い込み。
    private static func isSuspiciousNameSwap(requested: String, returned: String) -> Bool {
        let a = SavedStationStore.bareName(requested)
        let b = SavedStationStore.bareName(returned)
        guard !a.isEmpty, !b.isEmpty, a != b else { return false }
        if a.contains(b), b.count * 2 < a.count { return true }
        return false
    }

    /// 案内生成の待ちをやめる（ポップアップの「やめる」）。
    func cancelStationLookup() {
        guard stationLoading || contourLoading else { return }
        pendingStationLookup?.cancel()
        pendingStationLookup = nil
        finishLookupCancelled(message: "案内づくりをやめました。")
    }

    private func refundLookupCoinIfNeeded() {
        guard coinConsumedForLookup else { return }
        BillingStore.shared.refundGenerationCoin()
        coinConsumedForLookup = false
    }

    private func finishLookupCancelled(message: String? = nil) {
        refundLookupCoinIfNeeded()
        stationLoading = false
        contourLoading = false
        awaitingDetailConfirm = false
        contourSummary = ""
        contourIsDecisionUseful = false
        pendingDetailBare = ""
        pendingStoryNotes = []
        let wasPreview = isStationPreview
        discardStationPreviewIfNeeded()
        if wasPreview || screen == .tour {
            screen = .hero
            phase = .station
            showStationSearch = false
            query = ""
            draft = ""
            courses = []
            selectedCourse = nil
        }
        if let message {
            heroNote = message
            stationNotice = message
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

    /// 現在地から最寄りを返す。近いときは呼び出し側で確認してから `chooseStation` する。
    @discardableResult
    func finishLocate(lat: Double, lng: Double) -> Station? {
        geoLoading = false
        let hit = Geo.nearestStation(lat: lat, lng: lng, in: stations)
        if let hit, hit.km <= nearbyStationKm {
            heroNote = nil
            screen = .hero
            return hit.station
        }
        let nearestHint = hit.map {
            "いちばん近い保存済みの駅は\($0.station.name)（\(Geo.distanceLabel(km: $0.km))）ですが、徒歩圏外です。"
        } ?? ""
        heroNote = "\(nearestHint)駅名を入力すれば、全国どこでも徒歩圏の案内をつくれます。"
        screen = .hero
        return nil
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
            let fixed = GuideIntegrity.seal(station)
            // 物語のゆかり（AreaDepth）など、スポット以外の正本差し替えも書き戻す。
            if fixed.sightseeingNotes.map({ "\($0.title)\($0.body)" })
                != station.sightseeingNotes.map({ "\($0.title)\($0.body)" })
                || fixed.walkGuide != station.walkGuide
                || fixed.storyNotes.map(\.title) != station.storyNotes.map(\.title)
                || fixed.historyNotes.map(\.title) != station.historyNotes.map(\.title)
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
        let sealed = GuideIntegrity.seal(next)
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
        let live = station.map({ CourseBuilder.snapLandmarkPins($0) })?
            .spots.first(where: { $0.id == spot.id || $0.name == spot.name })
            ?? spot
        let pinned = LandmarkRegistry.apply(live, stationName: name)
        return clarifyLandscapeSpot(pinned)
    }

    /// 川の総称だけだと駅から見渡せるように読めるので、立ち寄り先の名前と文に直す。
    private func clarifyLandscapeSpot(_ spot: Spot) -> Spot {
        LandscapeSpotName.apply(to: spot)
    }

}

func formatKm(_ km: Double) -> String {
    km == km.rounded() ? String(Int(km)) : String(format: "%.1f", km)
}
