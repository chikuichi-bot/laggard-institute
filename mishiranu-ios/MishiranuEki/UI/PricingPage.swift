import SwiftUI

/// 設定 → 料金。コイン購入と BYOK（図解つき）。
struct PricingPage: View {
    @Environment(BillingStore.self) private var billing

    var body: some View {
        @Bindable var billing = billing
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("料金")
                    .font(.mincho(.title2, weight: .semibold))
                    .foregroundStyle(Palette.ink)

                statusCard

                diagramTwoWays

                diagramWhenCharge

                diagramCoinInside

                if billing.byokUnlocked, billing.isByokConfigured {
                    generationPathPicker
                }

                buyCoinsSection

                byokSection

                if let note = billing.statusNote {
                    Text(note)
                        .font(.readable(.callout))
                        .foregroundStyle(Palette.warm)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(20)
            .padding(.bottom, 88)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - いまの状態

    private var statusCard: some View {
        HStack(spacing: 14) {
            pricingGlyph("yensign.circle.fill", tint: Palette.warm)
            VStack(alignment: .leading, spacing: 4) {
                Text("いまのコイン")
                    .font(.readable(.caption))
                    .foregroundStyle(Palette.mist)
                Text("\(billing.coins) 枚")
                    .font(.mincho(.title3, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                Text(billing.modeLabel)
                    .font(.readable(.caption2))
                    .foregroundStyle(Palette.mist)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(cardFill)
        .overlay(cardStroke)
    }

    // MARK: - 図：二つの道

    private var diagramTwoWays: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("どう使う？（二つの道）")
            Text("どちらでも、一度つくった駅は端末に残ります。開き直すときは料金なし。")
                .font(.readable(.caption))
                .foregroundStyle(Palette.mist)
                .fixedSize(horizontal: false, vertical: true)

            HStack(alignment: .top, spacing: 10) {
                wayCard(
                    badge: "①",
                    icon: "yensign.circle.fill",
                    title: "コイン",
                    steps: ["コインを買う", "1駅 = 1枚", "用意した AI を使う"],
                    footer: "手軽に始めたい"
                )
                wayCard(
                    badge: "②",
                    icon: "key.fill",
                    title: "自分の API",
                    steps: ["アプリを買い切り", "キーを入れる", "コイン不要"],
                    footer: "よく使う方向け"
                )
            }

            // 流れの一行図
            HStack(spacing: 6) {
                flowChip(icon: "tram.fill", text: "駅を調べる")
                Image(systemName: "arrow.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Palette.mist)
                flowChip(icon: "sparkles", text: "案内ができる")
                Image(systemName: "arrow.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Palette.mist)
                flowChip(icon: "iphone", text: "端末に残る")
            }
            .frame(maxWidth: .infinity)
        }
    }

    private func wayCard(
        badge: String,
        icon: String,
        title: String,
        steps: [String],
        footer: String
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text(badge)
                    .font(.readable(.caption2, weight: .semibold))
                    .foregroundStyle(Palette.paper)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(Palette.warm))
                Spacer(minLength: 0)
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundStyle(Palette.warm)
                    .accessibilityHidden(true)
            }
            Text(title)
                .font(.mincho(.body, weight: .semibold))
                .foregroundStyle(Palette.ink)
            VStack(alignment: .leading, spacing: 6) {
                ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                    HStack(alignment: .top, spacing: 6) {
                        Text("\(index + 1).")
                            .font(.readable(.caption2, weight: .semibold))
                            .foregroundStyle(Palette.mist)
                            .frame(width: 16, alignment: .leading)
                        Text(step)
                            .font(.readable(.caption))
                            .foregroundStyle(Palette.ink)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            Text(footer)
                .font(.readable(.caption2))
                .foregroundStyle(Palette.mist)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(cardFill)
        .overlay(cardStroke)
    }

    private func flowChip(icon: String, text: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption2)
            Text(text)
                .font(.readable(.caption2))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .foregroundStyle(Palette.ink)
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Palette.canvas)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(Palette.line, lineWidth: 1)
        )
    }

    // MARK: - 図：いつかかる

    private var diagramWhenCharge: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("いつコイン／API を使う？")
            VStack(spacing: 0) {
                chargeRow(
                    icon: "plus.circle.fill",
                    tint: Palette.warm,
                    title: "かかる",
                    body: "新しい駅を調べる · 案内を作り直す"
                )
                Divider().overlay(Palette.line)
                chargeRow(
                    icon: "checkmark.circle.fill",
                    tint: Palette.moss,
                    title: "かからない",
                    body: "保存した駅を開く · 地図を見る · 「この駅について」"
                )
            }
            .background(cardFill)
            .overlay(cardStroke)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }

    private func chargeRow(
        icon: String,
        tint: Color,
        title: String,
        body: String
    ) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(tint)
                .frame(width: 28)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.mincho(.body, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                Text(body)
                    .font(.readable(.caption))
                    .foregroundStyle(Palette.mist)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
    }

    // MARK: - 図：コイン1枚の中身

    private var diagramCoinInside: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("コイン1枚の中身（方法①の目安）")
            VStack(spacing: 10) {
                costBar(icon: "pencil.line", title: "文章をつくる", detail: "約 ¥2", fill: 0.12)
                costBar(icon: "magnifyingglass", title: "実在を検索で確認", detail: "約 ¥0〜14", fill: 0.55)
                HStack {
                    Image(systemName: "sum")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Palette.warm)
                        .frame(width: 28)
                        .accessibilityHidden(true)
                    Text("原価の合計")
                        .font(.mincho(.body, weight: .semibold))
                        .foregroundStyle(Palette.ink)
                    Spacer()
                    Text("約 ¥2〜16")
                        .font(.mincho(.body, weight: .semibold))
                        .foregroundStyle(Palette.ink)
                }
                Text("コイン1枚（約¥30〜40）に、この費用と App Store 手数料（15%）が入っています。方法②の費用は、お使いの AI の料金表に従います。")
                    .font(.readable(.caption2))
                    .foregroundStyle(Palette.mist)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(14)
            .background(cardFill)
            .overlay(cardStroke)
        }
    }

    private func costBar(
        icon: String,
        title: String,
        detail: String,
        fill: CGFloat
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: icon)
                    .font(.body)
                    .foregroundStyle(Palette.warm)
                    .frame(width: 28)
                    .accessibilityHidden(true)
                Text(title)
                    .font(.readable(.callout))
                    .foregroundStyle(Palette.ink)
                Spacer()
                Text(detail)
                    .font(.readable(.caption, weight: .semibold))
                    .foregroundStyle(Palette.mist)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Palette.canvas)
                    Capsule()
                        .fill(Palette.warm.opacity(0.35))
                        .frame(width: max(8, geo.size.width * fill))
                }
            }
            .frame(height: 8)
            .padding(.leading, 28)
        }
    }

    // MARK: - 案内の経路（買い切り＋API 設定後）

    private var generationPathPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("案内のつくり方")
            VStack(spacing: 0) {
                pathChoiceRow(
                    title: "自分の API",
                    detail: "コイン不要 · \(billing.byokProvider.label)",
                    selected: !billing.preferCoinOverByok
                ) {
                    billing.updatePreferCoinOverByok(false)
                }
                Divider().overlay(Palette.line).padding(.leading, 14)
                pathChoiceRow(
                    title: "コイン（用意した AI）",
                    detail: "1駅 = 1枚 · 残り \(billing.coins) 枚",
                    selected: billing.preferCoinOverByok
                ) {
                    billing.updatePreferCoinOverByok(true)
                }
            }
            .background(cardFill)
            .overlay(cardStroke)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            Text("買い切り後もコインで案内できます。API の上限に当たったときなどに切り替えてください。")
                .font(.readable(.caption2))
                .foregroundStyle(Palette.mist)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func pathChoiceRow(
        title: String,
        detail: String,
        selected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(selected ? Palette.warm : Palette.mist)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.mincho(.body))
                        .foregroundStyle(Palette.ink)
                    Text(detail)
                        .font(.readable(.caption2))
                        .foregroundStyle(Palette.mist)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 13)
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainHapticButtonStyle())
        .accessibilityLabel(title)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    // MARK: - 買う

    private var buyCoinsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("方法① · コインを買う")
            VStack(spacing: 0) {
                ForEach(BillingStore.packs) { pack in
                    Button {
                        Task { await billing.purchasePack(pack) }
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "yensign.circle.fill")
                                .font(.title3)
                                .foregroundStyle(Palette.warm)
                                .accessibilityHidden(true)
                            VStack(alignment: .leading, spacing: 3) {
                                Text("\(pack.label) · \(pack.coins)枚")
                                    .font(.mincho(.body))
                                    .foregroundStyle(Palette.ink)
                                Text("1駅あたり約¥\(pack.priceYen / max(pack.coins, 1))")
                                    .font(.readable(.caption2))
                                    .foregroundStyle(Palette.mist)
                            }
                            Spacer(minLength: 0)
                            Text(
                                billing.busyProductId == pack.id
                                    ? "処理中…"
                                    : "¥\(pack.priceYen.formatted())"
                            )
                            .font(.mincho(.body, weight: .semibold))
                            .foregroundStyle(Palette.ink)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 13)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(PlainHapticButtonStyle())
                    .disabled(billing.busyProductId != nil)
                    if pack.id != BillingStore.packs.last?.id {
                        Divider().overlay(Palette.line).padding(.leading, 54)
                    }
                }
            }
            .background(cardFill)
            .overlay(cardStroke)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }

    private var byokSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("方法② · 自分の API")
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "key.fill")
                        .font(.title3)
                        .foregroundStyle(Palette.warm)
                        .accessibilityHidden(true)
                    Text(
                        "買い切り（¥\(BillingStore.byokPriceYen)）後、Gemini や OpenAI 互換など自分の AI で作れます。コインもそのまま使えます。キーは端末だけに置き、サーバーには保存しません。"
                    )
                    .font(.readable(.caption))
                    .foregroundStyle(Palette.mist)
                    .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 14)
                .padding(.top, 12)

                if !billing.byokUnlocked {
                    Button {
                        Task { await billing.purchaseByokUnlock() }
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("自分の API で使い放題")
                                    .font(.mincho(.body))
                                    .foregroundStyle(Palette.ink)
                                Text("Gemini / OpenAI互換など")
                                    .font(.readable(.caption2))
                                    .foregroundStyle(Palette.mist)
                            }
                            Spacer(minLength: 0)
                            Text(
                                billing.busyProductId == BillingStore.byokProductId
                                    ? "処理中…"
                                    : "¥\(BillingStore.byokPriceYen)"
                            )
                            .font(.mincho(.body, weight: .semibold))
                            .foregroundStyle(Palette.ink)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 13)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(PlainHapticButtonStyle())
                    .disabled(billing.busyProductId != nil)
                } else {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("使う AI")
                            .font(.readable(.caption))
                            .foregroundStyle(Palette.mist)
                        ForEach(BillingStore.ByokProvider.allCases) { provider in
                            Button {
                                billing.updateProvider(provider)
                            } label: {
                                HStack(spacing: 10) {
                                    Image(systemName: provider == .gemini ? "sparkles" : "link")
                                        .foregroundStyle(
                                            billing.byokProvider == provider
                                                ? Palette.warm
                                                : Palette.mist
                                        )
                                        .frame(width: 22)
                                        .accessibilityHidden(true)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(provider.label)
                                            .font(.mincho(.body))
                                        Text(provider.hint)
                                            .font(.readable(.caption2))
                                            .foregroundStyle(Palette.mist)
                                    }
                                    Spacer(minLength: 0)
                                    if billing.byokProvider == provider {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(Palette.warm)
                                    }
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(12)
                                .foregroundStyle(Palette.ink)
                                .background(
                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                        .fill(
                                            billing.byokProvider == provider
                                                ? Palette.warm.opacity(0.12)
                                                : Palette.canvas
                                        )
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                        .stroke(
                                            billing.byokProvider == provider
                                                ? Palette.warm.opacity(0.55)
                                                : Palette.line,
                                            lineWidth: 1
                                        )
                                )
                            }
                            .buttonStyle(PlainHapticButtonStyle())
                        }

                        if billing.byokProvider == .openai {
                            fieldLabel("API の URL（OpenAI 互換）")
                            TextField(
                                "https://api.openai.com/v1",
                                text: Binding(
                                    get: { billing.apiBaseUrl },
                                    set: { billing.updateApiBaseUrl($0) }
                                )
                            )
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.URL)
                            .padding(12)
                            .background(fieldBackground)

                            fieldLabel("モデル名")
                            TextField(
                                "gpt-4o-mini",
                                text: Binding(
                                    get: { billing.apiModel },
                                    set: { billing.updateApiModel($0) }
                                )
                            )
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .padding(12)
                            .background(fieldBackground)
                        }

                        fieldLabel("API キー")
                        SecureField(
                            billing.byokProvider == .gemini ? "AIza…" : "sk-…",
                            text: Binding(
                                get: { billing.apiKey },
                                set: { billing.updateApiKey($0) }
                            )
                        )
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(12)
                        .background(fieldBackground)
                    }
                    .padding(14)
                }
            }
            .background(cardFill)
            .overlay(cardStroke)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }

    // MARK: - Helpers

    private var cardFill: some View {
        RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Palette.paper)
    }

    private var cardStroke: some View {
        RoundedRectangle(cornerRadius: 14, style: .continuous)
            .stroke(Palette.line, lineWidth: 1)
    }

    private var fieldBackground: some View {
        RoundedRectangle(cornerRadius: 10, style: .continuous)
            .fill(Palette.canvas)
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(Palette.line, lineWidth: 1)
            )
    }

    private func fieldLabel(_ title: String) -> some View {
        Text(title)
            .font(.readable(.caption))
            .foregroundStyle(Palette.mist)
    }

    private func sectionLabel(_ title: String) -> some View {
        Text(title)
            .font(.readable(.caption, weight: .semibold))
            .foregroundStyle(Palette.mist)
    }

    private func pricingGlyph(_ systemName: String, tint: Color) -> some View {
        Image(systemName: systemName)
            .font(.system(size: 34))
            .foregroundStyle(tint)
            .frame(width: 44, height: 44)
            .accessibilityHidden(true)
    }
}
