import Foundation

enum GuideKind: String, Codable, CaseIterable, Identifiable, Hashable {
    case sight, meal, souvenir, rest, tip

    var id: String { rawValue }

    /// 案内タブの並び。観光が先頭。
    static let order: [GuideKind] = [.sight, .meal, .souvenir, .rest, .tip]

    var label: String {
        switch self {
        case .meal: return "ご飯"
        case .souvenir: return "お土産"
        case .sight: return "観光"
        case .rest: return "休むところ"
        case .tip: return "寄り道"
        }
    }

    var orderIndex: Int { GuideKind.order.firstIndex(of: self) ?? GuideKind.order.count }
}

enum MealTier: String, Codable, Hashable {
    case casual, upscale

    var label: String {
        switch self {
        case .casual: return "庶民的"
        case .upscale: return "高級"
        }
    }
}

enum MealTime: String, Codable, Hashable {
    case morning, lunch, dinner

    var label: String {
        switch self {
        case .morning: return "朝"
        case .lunch: return "昼"
        case .dinner: return "夜"
        }
    }
}

enum StationMood: String, Codable, Hashable {
    case story, empty
}

struct HistoryNote: Codable, Hashable {
    let title: String
    let body: String
}

enum BikeRentalKind: String, Codable, Hashable {
    case local
    case app

    var label: String {
        switch self {
        case .local: return "地元のレンタサイクル"
        case .app: return "アプリで借りる"
        }
    }

    var hint: String {
        switch self {
        case .local: return "店頭で借りる半日〜1日向き"
        case .app: return "会員登録のあと、ポートで解錠"
        }
    }
}

struct BikeRentalPlace: Codable, Hashable {
    let name: String
    let kind: BikeRentalKind?
    let walkMinutes: Int?
    let note: String?

    var resolvedKind: BikeRentalKind {
        if let kind { return kind }
        let blob = "\(name) \(note ?? "")"
        let upper = blob.uppercased()
        if blob.contains("シェア") || blob.contains("アプリ") || blob.contains("HELLO")
            || blob.contains("ドコモ") || upper.contains("CLEW") || blob.contains("クルー")
            || upper.contains("CREW") {
            return .app
        }
        return .local
    }
}

struct BikeRental: Codable, Hashable {
    let available: Bool
    let summary: String
    let places: [BikeRentalPlace]?

    func places(kind: BikeRentalKind) -> [BikeRentalPlace] {
        (places ?? []).filter { $0.resolvedKind == kind }
    }
}

struct EmptyCopy: Codable, Hashable {
    let headline: String
    let body: String
}

/// 地図ピンの信頼度。未確定は案内文には出せるが地図には出さない。
enum CoordTrust: String, Codable, Hashable {
    /// landmark-locks / 人手確認の正本
    case lock
    /// Apple MapKit で店名・座標が取れたもの
    case apple
    /// AI推定・駅オフセットなど（地図禁止）
    case unverified
}

struct Spot: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let genre: String
    let guide: GuideKind
    let mealTier: MealTier
    let mealTimes: [MealTime]
    let soloOk: Bool
    let budgetYen: String
    let hours: String?
    let blurb: String
    let detail: String?
    let walkMinutes: Int
    let secretWorthy: Bool
    /// その駅の顔になる定番（散歩中心などで先に出す。名所・景色と名物店の合計だいたい5件）
    let majorWorthy: Bool
    let lat: Double
    let lng: Double
    /// 地図に載せてよいかの正本フラグ
    let coordTrust: CoordTrust

    var soloLabel: String { soloOk ? "一人OK" : "予約・人数向き" }

    var genreLabel: String {
        switch genre {
        case "history": return "歴史・文化"
        case "gourmet": return "ローカルグルメ"
        case "nature": return "自然・公園"
        default: return "ちょっと変わった"
        }
    }

    enum CodingKeys: String, CodingKey {
        case id, name, genre, guide, mealTier, mealTimes, soloOk, budgetYen
        case hours, blurb, detail, walkMinutes, secretWorthy, majorWorthy, lat, lng, coordTrust
    }

    init(
        id: String, name: String, genre: String, guide: GuideKind, mealTier: MealTier,
        mealTimes: [MealTime], soloOk: Bool, budgetYen: String, hours: String?, blurb: String,
        detail: String?, walkMinutes: Int, secretWorthy: Bool, majorWorthy: Bool = false,
        lat: Double, lng: Double, coordTrust: CoordTrust = .unverified
    ) {
        self.id = id
        self.name = name
        self.genre = genre
        self.guide = guide
        self.mealTier = mealTier
        self.mealTimes = mealTimes
        self.soloOk = soloOk
        self.budgetYen = budgetYen
        self.hours = hours
        self.blurb = blurb
        self.detail = detail
        self.walkMinutes = walkMinutes
        self.secretWorthy = secretWorthy
        self.majorWorthy = majorWorthy
        self.lat = lat
        self.lng = lng
        self.coordTrust = coordTrust
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        genre = try c.decode(String.self, forKey: .genre)
        guide = try c.decode(GuideKind.self, forKey: .guide)
        mealTier = try c.decodeIfPresent(MealTier.self, forKey: .mealTier) ?? .casual
        mealTimes = try c.decodeIfPresent([MealTime].self, forKey: .mealTimes) ?? [.lunch]
        soloOk = try c.decodeIfPresent(Bool.self, forKey: .soloOk) ?? true
        budgetYen = try c.decodeIfPresent(String.self, forKey: .budgetYen) ?? "〜¥1,500"
        hours = try c.decodeIfPresent(String.self, forKey: .hours)
        blurb = try c.decode(String.self, forKey: .blurb)
        detail = try c.decodeIfPresent(String.self, forKey: .detail)
        walkMinutes = try c.decode(Int.self, forKey: .walkMinutes)
        secretWorthy = try c.decodeIfPresent(Bool.self, forKey: .secretWorthy) ?? false
        majorWorthy = try c.decodeIfPresent(Bool.self, forKey: .majorWorthy) ?? false
        lat = try c.decode(Double.self, forKey: .lat)
        lng = try c.decode(Double.self, forKey: .lng)
        coordTrust = try c.decodeIfPresent(CoordTrust.self, forKey: .coordTrust)
            ?? Self.inferredTrust(id: id)
    }

    /// 旧保存データ用。id 接頭辞だけから推定する。
    static func inferredTrust(id: String) -> CoordTrust {
        if id.hasPrefix("lock-") { return .lock }
        if id.hasPrefix("apple-") || id.hasPrefix("reach-") { return .apple }
        return .unverified
    }
}

struct Station: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    /// 駅名のひらがな読み（土地ページ見出し用）
    let nameReading: String?
    let line: String
    let prefecture: String
    let region: String
    let mood: StationMood
    let radiiKm: [Double]
    let stationIntro: String?
    let areaAbout: String?
    let walkGuide: String?
    let historyNotes: [HistoryNote]
    let sightseeingNotes: [HistoryNote]
    /// ドラマ・映画・本の撮影地／舞台（徒歩圏で確かなものだけ）。無い駅は空。
    let storyNotes: [HistoryNote]
    let bikeRental: BikeRental
    let tourTitle: String
    let catchCopy: String
    let emptyCopy: EmptyCopy?
    /// 運行の目安（任意。確信があるときだけ AI が付ける）
    let railHint: String?
    let lat: Double
    let lng: Double
    let spots: [Spot]

    enum CodingKeys: String, CodingKey {
        case id, name, nameReading, line, prefecture, region, mood, radiiKm
        case stationIntro, areaAbout, walkGuide, historyNotes, sightseeingNotes, storyNotes
        case bikeRental, tourTitle, catchCopy, emptyCopy, railHint, lat, lng, spots
    }

    init(
        id: String, name: String, nameReading: String?, line: String, prefecture: String,
        region: String, mood: StationMood, radiiKm: [Double], stationIntro: String?,
        areaAbout: String?, walkGuide: String?, historyNotes: [HistoryNote],
        sightseeingNotes: [HistoryNote], storyNotes: [HistoryNote] = [],
        bikeRental: BikeRental, tourTitle: String,
        catchCopy: String, emptyCopy: EmptyCopy?, railHint: String? = nil,
        lat: Double, lng: Double, spots: [Spot]
    ) {
        self.id = id
        self.name = name
        self.nameReading = nameReading
        self.line = line
        self.prefecture = prefecture
        self.region = region
        self.mood = mood
        self.radiiKm = radiiKm
        self.stationIntro = stationIntro
        self.areaAbout = areaAbout
        self.walkGuide = walkGuide
        self.historyNotes = historyNotes
        self.sightseeingNotes = sightseeingNotes
        self.storyNotes = storyNotes
        self.bikeRental = bikeRental
        self.tourTitle = tourTitle
        self.catchCopy = catchCopy
        self.emptyCopy = emptyCopy
        self.railHint = railHint
        self.lat = lat
        self.lng = lng
        self.spots = spots
    }

    /// 端末保存の旧 JSON でも落ちないよう、欠けた配列は空で読む。
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        nameReading = try c.decodeIfPresent(String.self, forKey: .nameReading)
        line = try c.decodeIfPresent(String.self, forKey: .line) ?? "路線情報は要確認"
        prefecture = try c.decodeIfPresent(String.self, forKey: .prefecture) ?? "日本"
        region = try c.decodeIfPresent(String.self, forKey: .region) ?? "関東"
        mood = try c.decodeIfPresent(StationMood.self, forKey: .mood) ?? .story
        radiiKm = try c.decodeIfPresent([Double].self, forKey: .radiiKm) ?? [0.9, 1.0, 1.2]
        stationIntro = try c.decodeIfPresent(String.self, forKey: .stationIntro)
        areaAbout = try c.decodeIfPresent(String.self, forKey: .areaAbout)
        walkGuide = try c.decodeIfPresent(String.self, forKey: .walkGuide)
        historyNotes = try c.decodeIfPresent([HistoryNote].self, forKey: .historyNotes) ?? []
        sightseeingNotes = try c.decodeIfPresent([HistoryNote].self, forKey: .sightseeingNotes) ?? []
        storyNotes = try c.decodeIfPresent([HistoryNote].self, forKey: .storyNotes) ?? []
        bikeRental = try c.decodeIfPresent(BikeRental.self, forKey: .bikeRental)
            ?? BikeRental(available: false, summary: "レンタサイクル情報は現地でもご確認ください。", places: nil)
        tourTitle = try c.decodeIfPresent(String.self, forKey: .tourTitle) ?? "\(name)の徒歩圏を、ゆるく歩く"
        catchCopy = try c.decodeIfPresent(String.self, forKey: .catchCopy) ?? "降りた場所から、予定のない寄り道を。"
        emptyCopy = try c.decodeIfPresent(EmptyCopy.self, forKey: .emptyCopy)
        railHint = try c.decodeIfPresent(String.self, forKey: .railHint)
        lat = try c.decode(Double.self, forKey: .lat)
        lng = try c.decode(Double.self, forKey: .lng)
        spots = try c.decodeIfPresent([Spot].self, forKey: .spots) ?? []
    }

    /// 「出町柳」→「出町柳駅のこと」
    var aboutTitle: String {
        let base = name.hasSuffix("駅") ? String(name.dropLast()) : name
        return "\(base)駅のこと"
    }

    var displayNameReading: String? {
        let trimmed = nameReading?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (trimmed?.isEmpty == false) ? trimmed : nil
    }

    var indexStationLabel: String {
        name.hasSuffix("駅") ? String(name.dropLast()) : name
    }

    /// 案内ヘッド用。「京阪電車　出町柳駅」形式。
    var chromeStationLabel: String {
        let bare = indexStationLabel
        let primary = line
            .split(whereSeparator: { "/・,".contains($0) })
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first(where: { !$0.isEmpty && $0 != "路線情報は要確認" })
        let linePart: String = {
            guard let primary else { return "" }
            if primary.hasSuffix("本線") {
                return "\(primary.dropLast(2))電車"
            }
            return primary
        }()
        if linePart.isEmpty { return "\(bare)駅" }
        return "\(linePart)　\(bare)駅"
    }

    func radiusKm(for stay: StayOption) -> Double {
        // 徒歩圏は約1km基準（保存データの古い 2.2 / 3.0 は使わない）
        stay.walkRadiusKm
    }

    /// 滞在時間で歩ける範囲。半日だけ、徒歩圏の外の1件（id が reach-）を足す。
    func spots(for stay: StayOption) -> [Spot] {
        let inner = spots.filter {
            !$0.id.hasPrefix("reach-") && $0.walkMinutes <= stay.maxWalkMinutes
        }
        guard stay == .halfDay, let reach = spots.first(where: { $0.id.hasPrefix("reach-") }) else {
            return inner
        }
        return inner + [reach]
    }
}

/// 空行区切りの本文を段落に分ける。
func paragraphs(_ text: String?) -> [String] {
    guard let text else { return [] }
    return text
        .components(separatedBy: "\n\n")
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
}

enum StayOption: String, CaseIterable, Identifiable, Hashable {
    case oneHour = "1h"
    case threeHours = "3h"
    case halfDay = "half"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .oneHour: return "1時間"
        case .threeHours: return "3時間"
        case .halfDay: return "半日"
        }
    }

    var index: Int { StayOption.allCases.firstIndex(of: self) ?? 0 }

    /// 地図に描く徒歩圏（約1km）。
    var walkRadiusKm: Double {
        switch self {
        case .oneHour: return 0.9
        case .threeHours: return 1.0
        case .halfDay: return 1.2
        }
    }

    /// コース候補に入れる徒歩分の上限（約1km · 道なり係数込み）。
    var maxWalkMinutes: Int {
        switch self {
        case .oneHour: return 16
        case .threeHours: return 18
        case .halfDay: return 22
        }
    }

    /// コース全体の目安分数。
    var budgetMinutes: Int {
        switch self {
        case .oneHour: return 50
        case .threeHours: return 165
        case .halfDay: return 280
        }
    }

    /// 立ち寄りか所数の上限（1時間は短く、半日は厚く）。
    var maxCourseStops: Int {
        switch self {
        case .oneHour: return 2
        case .threeHours: return 4
        case .halfDay: return 6
        }
    }

    var courseLengthHint: String {
        switch self {
        case .oneHour: return "さっと2か所"
        case .threeHours: return "4か所くらい"
        case .halfDay: return "じっくり最大6か所"
        }
    }
}

enum DayPart: String, CaseIterable, Identifiable, Hashable {
    case morning, midday, afternoon, evening, night

    var id: String { rawValue }

    var label: String {
        switch self {
        case .morning: return "朝"
        case .midday: return "昼まえ"
        case .afternoon: return "昼すぎ"
        case .evening: return "夕方"
        case .night: return "夜"
        }
    }

    var hint: String {
        switch self {
        case .morning: return "だいたい 6〜10時"
        case .midday: return "だいたい 10〜12時"
        case .afternoon: return "だいたい 12〜16時"
        case .evening: return "だいたい 16〜19時"
        case .night: return "だいたい 19時以降"
        }
    }

    var defaultClockHour: Int {
        switch self {
        case .morning: return 8
        case .midday: return 11
        case .afternoon: return 14
        case .evening: return 17
        case .night: return 20
        }
    }

    /// その時間帯に開いている食事（DAY_PART_MEAL）。
    var mealTimes: [MealTime] {
        switch self {
        case .morning: return [.morning]
        case .midday: return [.morning, .lunch]
        case .afternoon: return [.lunch]
        case .evening: return [.lunch, .dinner]
        case .night: return [.dinner]
        }
    }

    static func from(hour: Int) -> DayPart {
        let h = ((hour % 24) + 24) % 24
        if h < 10 { return .morning }
        if h < 12 { return .midday }
        if h < 16 { return .afternoon }
        if h < 19 { return .evening }
        return .night
    }
}

enum SoloPref: String, CaseIterable, Identifiable, Hashable {
    case solo, either, together

    var id: String { rawValue }

    var label: String {
        switch self {
        case .solo: return "一人で入りたい"
        case .either: return "人数は気にしない"
        case .together: return "みんなで寄りたい"
        }
    }

    var hint: String {
        switch self {
        case .solo: return "カウンターや気軽な店寄り"
        case .either: return "一人可否は問わない"
        case .together: return "席や予約向きも歓迎"
        }
    }
}

enum BudgetPref: String, CaseIterable, Identifiable, Hashable {
    case casual, upscale, either

    var id: String { rawValue }

    var label: String {
        switch self {
        case .casual: return "気軽に"
        case .upscale: return "少し奮発"
        case .either: return "どちらでも"
        }
    }

    var hint: String {
        switch self {
        case .casual: return "だいたい 〜¥1,500"
        case .upscale: return "だいたい ¥3,000〜"
        case .either: return "価格帯は問わない"
        }
    }
}

struct MealPrefs: Hashable {
    var solo: SoloPref = .either
    var budget: BudgetPref = .either
}
