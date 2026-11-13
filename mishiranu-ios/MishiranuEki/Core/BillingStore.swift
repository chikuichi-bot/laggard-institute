import Foundation
import Observation

/// 見知らぬ駅 · 課金（道Aコイン / 道B BYOK）。正本は Web `docs/MONETIZATION.md`。
@Observable
@MainActor
final class BillingStore {
    static let shared = BillingStore()

    enum ByokProvider: String, CaseIterable, Identifiable {
        case gemini
        case openai

        var id: String { rawValue }

        var label: String {
            switch self {
            case .gemini: return "Gemini"
            case .openai: return "OpenAI 互換"
            }
        }

        var hint: String {
            switch self {
            case .gemini: return "Google AI Studio の API キー"
            case .openai: return "OpenAI / OpenRouter / ほか Chat Completions 互換"
            }
        }
    }

    struct CoinPack: Identifiable, Hashable {
        let id: String
        let productId: String
        let label: String
        let coins: Int
        let priceYen: Int
    }

    struct UserAiPayload {
        let provider: String
        let apiKey: String
        let baseUrl: String?
        let model: String?
    }

    static let freeStarterCoins = 3
    static let packs: [CoinPack] = [
        .init(id: "coins5", productId: "jp.lagado.mishiranueki.coins5", label: "入門", coins: 5, priceYen: 200),
        .init(id: "coins10", productId: "jp.lagado.mishiranueki.coins10", label: "小", coins: 10, priceYen: 370),
        .init(id: "coins30", productId: "jp.lagado.mishiranueki.coins30", label: "中", coins: 30, priceYen: 980),
        .init(id: "coins50", productId: "jp.lagado.mishiranueki.coins50", label: "大", coins: 50, priceYen: 1500),
    ]
    static let byokProductId = "jp.lagado.mishiranueki.unlock_byok"
    static let byokPriceYen = 980
    static let defaultOpenAiBase = "https://api.openai.com/v1"
    static let defaultOpenAiModel = "gpt-4o-mini"

    private let defaults = UserDefaults.standard
    private enum Key {
        static let coins = "mishiranu.billing.coins"
        static let freeGranted = "mishiranu.billing.freeGranted"
        static let byok = "mishiranu.billing.byokUnlocked"
        static let apiKey = "mishiranu.billing.apiKey"
        static let provider = "mishiranu.billing.byokProvider"
        static let baseUrl = "mishiranu.billing.apiBaseUrl"
        static let model = "mishiranu.billing.apiModel"
        /// 買い切り設定済みでもコイン経路を選ぶか。
        static let preferCoin = "mishiranu.billing.preferCoinOverByok"
        /// 試作中はコイン経路で見る。一度だけ買い切りフラグを落とす。
        static let forceCoinMode = "mishiranu.billing.forceCoinMode.20261111"
    }

    var coins: Int = 0
    var freeGranted: Bool = false
    var byokUnlocked: Bool = false
    var byokProvider: ByokProvider = .gemini
    /// 買い切り＋API設定済みでも、コイン（用意AI）を使う。
    var preferCoinOverByok: Bool = false
    /// 端末内のみ。
    var apiKey: String = ""
    var apiBaseUrl: String = BillingStore.defaultOpenAiBase
    var apiModel: String = BillingStore.defaultOpenAiModel
    var statusNote: String?
    var busyProductId: String?
    /// 直前の `tryConsumeGenerationCoin` でコインを実際に引いたか。
    private(set) var lastGenerationUsedCoin = false

    var isByokConfigured: Bool {
        guard byokUnlocked else { return false }
        guard apiKey.trimmingCharacters(in: .whitespacesAndNewlines).count >= 8 else {
            return false
        }
        if byokProvider == .openai {
            return apiBaseUrl.trimmingCharacters(in: .whitespacesAndNewlines)
                .hasPrefix("http")
        }
        return true
    }

    /// 今回の生成で自分の API を使うか（コイン不要）。
    var usesByokForGeneration: Bool {
        byokUnlocked && isByokConfigured && !preferCoinOverByok
    }

    var modeLabel: String {
        if usesByokForGeneration {
            return "自分の API（\(byokProvider.label)）"
        }
        if byokUnlocked, isByokConfigured, preferCoinOverByok {
            return "コインで案内（買い切りと併用）"
        }
        if byokUnlocked, !isByokConfigured {
            return "コインで案内 · API 未設定でも可"
        }
        return "コインで案内を生成"
    }

    var userAiPayload: UserAiPayload? {
        guard usesByokForGeneration else { return nil }
        let key = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
        if byokProvider == .openai {
            let base = apiBaseUrl.trimmingCharacters(in: .whitespacesAndNewlines)
                .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            let model = apiModel.trimmingCharacters(in: .whitespacesAndNewlines)
            return UserAiPayload(
                provider: "openai",
                apiKey: key,
                baseUrl: base.isEmpty ? Self.defaultOpenAiBase : base,
                model: model.isEmpty ? Self.defaultOpenAiModel : model
            )
        }
        return UserAiPayload(provider: "gemini", apiKey: key, baseUrl: nil, model: nil)
    }

    private init() {
        coins = max(0, defaults.integer(forKey: Key.coins))
        freeGranted = defaults.bool(forKey: Key.freeGranted)
        byokUnlocked = defaults.bool(forKey: Key.byok)
        preferCoinOverByok = defaults.bool(forKey: Key.preferCoin)
        apiKey = defaults.string(forKey: Key.apiKey) ?? ""
        if let raw = defaults.string(forKey: Key.provider),
           let provider = ByokProvider(rawValue: raw)
        {
            byokProvider = provider
        }
        apiBaseUrl = defaults.string(forKey: Key.baseUrl) ?? Self.defaultOpenAiBase
        apiModel = defaults.string(forKey: Key.model) ?? Self.defaultOpenAiModel
        // いまはコイン利用のてい。試作でオンにした買い切りを一度だけ外す。
        if !defaults.bool(forKey: Key.forceCoinMode) {
            byokUnlocked = false
            apiKey = ""
            defaults.set(true, forKey: Key.forceCoinMode)
            persist()
        }
        ensureFreeStarter()
        if coins < 1 {
            coins = Self.freeStarterCoins
            persist()
        }
    }

    private func persist() {
        defaults.set(coins, forKey: Key.coins)
        defaults.set(freeGranted, forKey: Key.freeGranted)
        defaults.set(byokUnlocked, forKey: Key.byok)
        defaults.set(preferCoinOverByok, forKey: Key.preferCoin)
        defaults.set(apiKey, forKey: Key.apiKey)
        defaults.set(byokProvider.rawValue, forKey: Key.provider)
        defaults.set(apiBaseUrl, forKey: Key.baseUrl)
        defaults.set(apiModel, forKey: Key.model)
    }

    private func ensureFreeStarter() {
        guard !freeGranted else { return }
        coins += Self.freeStarterCoins
        freeGranted = true
        persist()
    }

    /// 自分の API 利用時は消費なし。それ以外（買い切り後のコイン選択含む）は1コイン。
    func tryConsumeGenerationCoin() -> String? {
        lastGenerationUsedCoin = false
        if usesByokForGeneration {
            return nil
        }
        guard coins >= 1 else {
            if byokUnlocked, isByokConfigured {
                return "コインが足りません。自分の API に切り替えるか、設定の「料金」から補充できます。"
            }
            if byokUnlocked {
                return "コインが足りません。API を設定するか、設定の「料金」から補充できます。"
            }
            return "コインが足りません。設定の「料金」から補充できます。"
        }
        coins -= 1
        lastGenerationUsedCoin = true
        persist()
        return nil
    }

    func refundGenerationCoin() {
        guard lastGenerationUsedCoin else { return }
        lastGenerationUsedCoin = false
        coins += 1
        persist()
    }

    func updatePreferCoinOverByok(_ value: Bool) {
        preferCoinOverByok = value
        persist()
    }

    func purchasePack(_ pack: CoinPack) async {
        busyProductId = pack.id
        statusNote = nil
        defer { busyProductId = nil }
        try? await Task.sleep(nanoseconds: 350_000_000)
        coins += pack.coins
        persist()
        statusNote = "コインを追加しました。"
    }

    func purchaseByokUnlock() async {
        busyProductId = Self.byokProductId
        statusNote = nil
        defer { busyProductId = nil }
        try? await Task.sleep(nanoseconds: 350_000_000)
        byokUnlocked = true
        persist()
        statusNote = "買い切りを有効にしました。自分の API を設定してください。"
    }

    func updateApiKey(_ value: String) {
        apiKey = value
        persist()
    }

    func updateProvider(_ value: ByokProvider) {
        byokProvider = value
        persist()
    }

    func updateApiBaseUrl(_ value: String) {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        apiBaseUrl = trimmed.isEmpty ? Self.defaultOpenAiBase : trimmed
        persist()
    }

    func updateApiModel(_ value: String) {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        apiModel = trimmed.isEmpty ? Self.defaultOpenAiModel : trimmed
        persist()
    }
}
