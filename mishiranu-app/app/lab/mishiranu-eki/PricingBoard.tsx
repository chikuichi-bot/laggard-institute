"use client";

import type { ReactNode } from "react";
import {
  BYOK_PRODUCT,
  BYOK_PROVIDERS,
  COIN_PACKS,
  billingModeLabel,
  isByokConfigured,
  type BillingState,
  type ByokProvider,
  formatYen,
} from "@/lib/mishiranu-billing";
import {
  IconSearch,
  IconSpark,
  IconTrain,
  IconAtm,
  IconClock,
} from "./MishiranuIcons";

type Props = {
  billing: BillingState;
  busyPackId: string | null;
  note: string | null;
  onBack: () => void;
  onBuyPack: (packId: string) => void;
  onBuyByok: () => void;
  onApiKeyChange: (key: string) => void;
  onProviderChange: (provider: ByokProvider) => void;
  onOpenAiSettingsChange: (patch: {
    apiBaseUrl?: string;
    apiModel?: string;
  }) => void;
  onPreferCoinChange: (preferCoin: boolean) => void;
};

function Glyph({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <span className="mishiranu-pricing-glyph" aria-hidden={label ? undefined : true} aria-label={label}>
      {children}
    </span>
  );
}

export function PricingBoard({
  billing,
  busyPackId,
  note,
  onBack,
  onBuyPack,
  onBuyByok,
  onApiKeyChange,
  onProviderChange,
  onOpenAiSettingsChange,
  onPreferCoinChange,
}: Props) {
  const mode = billingModeLabel(billing);
  const showPathPicker =
    billing.byokUnlocked && isByokConfigured(billing);

  return (
    <div className="mishiranu-pricing" aria-label="料金">
      <div className="mishiranu-pricing-head">
        <button
          type="button"
          className="mishiranu-pricing-back"
          onClick={onBack}
        >
          ← 設定へ
        </button>
        <h3 className="mishiranu-settings-title">料金</h3>
      </div>

      <section className="mishiranu-settings-group" aria-label="いまの状態">
        <p className="mishiranu-settings-group-label">いま</p>
        <div className="mishiranu-pricing-status-card">
          <Glyph label="コイン">
            <IconAtm />
          </Glyph>
          <div>
            <p className="mishiranu-pricing-status-kicker">いまのコイン</p>
            <p className="mishiranu-pricing-status-coins">{billing.coins} 枚</p>
            <p className="mishiranu-pricing-status-mode">{mode}</p>
          </div>
        </div>
      </section>

      <section className="mishiranu-settings-group" aria-label="二つの道">
        <p className="mishiranu-settings-group-label">どう使う？（二つの道）</p>
        <p className="mishiranu-pricing-lead mishiranu-pricing-lead--tight">
          どちらでも、一度つくった駅は端末に残ります。開き直すときは料金なし。
        </p>
        <div className="mishiranu-pricing-ways-grid">
          <article className="mishiranu-pricing-way-card">
            <div className="mishiranu-pricing-way-top">
              <span className="mishiranu-pricing-way-badge">①</span>
              <Glyph>
                <IconAtm />
              </Glyph>
            </div>
            <h4 className="mishiranu-pricing-way-title">コイン</h4>
            <ol className="mishiranu-pricing-way-steps">
              <li>コインを買う</li>
              <li>1駅 = 1枚</li>
              <li>用意した AI を使う</li>
            </ol>
            <p className="mishiranu-pricing-way-foot">手軽に始めたい</p>
          </article>
          <article className="mishiranu-pricing-way-card">
            <div className="mishiranu-pricing-way-top">
              <span className="mishiranu-pricing-way-badge">②</span>
              <Glyph>
                <IconSpark />
              </Glyph>
            </div>
            <h4 className="mishiranu-pricing-way-title">自分の API</h4>
            <ol className="mishiranu-pricing-way-steps">
              <li>アプリを買い切り</li>
              <li>キーを入れる</li>
              <li>コイン不要</li>
            </ol>
            <p className="mishiranu-pricing-way-foot">よく使う方向け</p>
          </article>
        </div>
        <div className="mishiranu-pricing-flow" aria-label="流れ">
          <span className="mishiranu-pricing-flow-chip">
            <IconTrain />
            駅を調べる
          </span>
          <span className="mishiranu-pricing-flow-arrow" aria-hidden="true">
            →
          </span>
          <span className="mishiranu-pricing-flow-chip">
            <IconSpark />
            案内ができる
          </span>
          <span className="mishiranu-pricing-flow-arrow" aria-hidden="true">
            →
          </span>
          <span className="mishiranu-pricing-flow-chip">
            <IconClock />
            端末に残る
          </span>
        </div>
      </section>

      <section className="mishiranu-settings-group" aria-label="いつかかる">
        <p className="mishiranu-settings-group-label">いつコイン／API を使う？</p>
        <div className="mishiranu-settings-card mishiranu-pricing-charge-card">
          <div className="mishiranu-pricing-charge-row">
            <span className="mishiranu-pricing-charge-mark mishiranu-pricing-charge-mark--pay">
              ＋
            </span>
            <div>
              <p className="mishiranu-pricing-charge-title">かかる</p>
              <p className="mishiranu-pricing-charge-body">
                新しい駅を調べる · 案内を作り直す
              </p>
            </div>
          </div>
          <div className="mishiranu-pricing-charge-row">
            <span className="mishiranu-pricing-charge-mark mishiranu-pricing-charge-mark--free">
              ✓
            </span>
            <div>
              <p className="mishiranu-pricing-charge-title">かからない</p>
              <p className="mishiranu-pricing-charge-body">
                保存した駅を開く · 地図を見る · 「この駅について」
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mishiranu-settings-group" aria-label="コインの中身">
        <p className="mishiranu-settings-group-label">
          コイン1枚の中身（方法①の目安）
        </p>
        <div className="mishiranu-settings-card mishiranu-pricing-cost-card">
          <div className="mishiranu-pricing-cost-row">
            <Glyph>
              <IconSpark />
            </Glyph>
            <div className="mishiranu-pricing-cost-main">
              <div className="mishiranu-pricing-cost-label">
                <span>文章をつくる</span>
                <span>約 ¥2</span>
              </div>
              <div
                className="mishiranu-pricing-cost-bar"
                style={{ ["--fill" as string]: "12%" }}
              />
            </div>
          </div>
          <div className="mishiranu-pricing-cost-row">
            <Glyph>
              <IconSearch />
            </Glyph>
            <div className="mishiranu-pricing-cost-main">
              <div className="mishiranu-pricing-cost-label">
                <span>実在を検索で確認</span>
                <span>約 ¥0〜14</span>
              </div>
              <div
                className="mishiranu-pricing-cost-bar"
                style={{ ["--fill" as string]: "55%" }}
              />
            </div>
          </div>
          <div className="mishiranu-pricing-cost-total">
            <span>原価の合計</span>
            <strong>約 ¥2〜16</strong>
          </div>
          <p className="mishiranu-pricing-note">
            コイン1枚（約¥30〜40）に、この費用と App Store
            手数料（15%）が入っています。方法②の費用は、お使いの AI
            の料金表に従います。
          </p>
        </div>
      </section>

      {showPathPicker ? (
        <section className="mishiranu-settings-group" aria-label="案内のつくり方">
          <p className="mishiranu-settings-group-label">案内のつくり方</p>
          <div className="mishiranu-settings-card">
            <button
              type="button"
              className={
                !billing.preferCoinOverByok
                  ? "mishiranu-pricing-pack mishiranu-pricing-pack--selected"
                  : "mishiranu-pricing-pack"
              }
              aria-pressed={!billing.preferCoinOverByok}
              onClick={() => onPreferCoinChange(false)}
            >
              <span className="mishiranu-pricing-pack-main">
                <span className="mishiranu-pricing-pack-label">自分の API</span>
                <span className="mishiranu-pricing-pack-sub">
                  コイン不要 ·{" "}
                  {billing.byokProvider === "openai" ? "OpenAI互換" : "Gemini"}
                </span>
              </span>
            </button>
            <button
              type="button"
              className={
                billing.preferCoinOverByok
                  ? "mishiranu-pricing-pack mishiranu-pricing-pack--selected"
                  : "mishiranu-pricing-pack"
              }
              aria-pressed={billing.preferCoinOverByok}
              onClick={() => onPreferCoinChange(true)}
            >
              <span className="mishiranu-pricing-pack-main">
                <span className="mishiranu-pricing-pack-label">
                  コイン（用意した AI）
                </span>
                <span className="mishiranu-pricing-pack-sub">
                  1駅 = 1枚 · 残り {billing.coins} 枚
                </span>
              </span>
            </button>
            <p className="mishiranu-pricing-note">
              買い切り後もコインで案内できます。API
              の上限に当たったときなどに切り替えてください。
            </p>
          </div>
        </section>
      ) : null}

      <section className="mishiranu-settings-group" aria-label="コインを買う">
        <p className="mishiranu-settings-group-label">方法① · コインを買う</p>
        <div className="mishiranu-settings-card">
          {COIN_PACKS.map((pack) => {
            const busy = busyPackId === pack.id;
            return (
              <button
                key={pack.id}
                type="button"
                className="mishiranu-pricing-pack"
                disabled={busy || !!busyPackId}
                onClick={() => onBuyPack(pack.id)}
              >
                <Glyph>
                  <IconAtm />
                </Glyph>
                <span className="mishiranu-pricing-pack-main">
                  <span className="mishiranu-pricing-pack-label">
                    {pack.label} · {pack.coins}枚
                  </span>
                  <span className="mishiranu-pricing-pack-sub">
                    1駅あたり約
                    {formatYen(Math.round(pack.priceYen / pack.coins))}
                  </span>
                </span>
                <span className="mishiranu-pricing-pack-price">
                  {busy ? "処理中…" : formatYen(pack.priceYen)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mishiranu-settings-group" aria-label="自分のAPI">
        <p className="mishiranu-settings-group-label">方法② · 自分の API</p>
        <div className="mishiranu-settings-card">
          <div className="mishiranu-pricing-byok-lead">
            <Glyph>
              <IconSpark />
            </Glyph>
            <p className="mishiranu-pricing-note">
              買い切り（{formatYen(BYOK_PRODUCT.priceYen)}）後、Gemini や OpenAI
              互換など自分の AI で作れます。コインもそのまま使えます。キーは端末だけに置き、サーバーには保存しません。
            </p>
          </div>
          {!billing.byokUnlocked ? (
            <button
              type="button"
              className="mishiranu-pricing-pack mishiranu-pricing-pack--byok"
              disabled={!!busyPackId}
              onClick={onBuyByok}
            >
              <span className="mishiranu-pricing-pack-main">
                <span className="mishiranu-pricing-pack-label">
                  {BYOK_PRODUCT.label}
                </span>
                <span className="mishiranu-pricing-pack-sub">
                  Gemini / OpenAI互換など
                </span>
              </span>
              <span className="mishiranu-pricing-pack-price">
                {busyPackId === BYOK_PRODUCT.id
                  ? "処理中…"
                  : formatYen(BYOK_PRODUCT.priceYen)}
              </span>
            </button>
          ) : (
            <div className="mishiranu-pricing-byok-form">
              <p className="mishiranu-pricing-key-label">使う AI</p>
              <div className="mishiranu-pricing-provider-row" role="radiogroup">
                {BYOK_PROVIDERS.map((p) => {
                  const on = billing.byokProvider === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      className={
                        on
                          ? "mishiranu-pricing-provider mishiranu-pricing-provider--on"
                          : "mishiranu-pricing-provider"
                      }
                      onClick={() => onProviderChange(p.id)}
                    >
                      <span>{p.label}</span>
                      <span className="mishiranu-pricing-provider-hint">
                        {p.hint}
                      </span>
                    </button>
                  );
                })}
              </div>

              {billing.byokProvider === "openai" ? (
                <>
                  <label className="mishiranu-pricing-key">
                    <span>API の URL（OpenAI 互換）</span>
                    <input
                      type="url"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="https://api.openai.com/v1"
                      value={billing.apiBaseUrl}
                      onChange={(e) =>
                        onOpenAiSettingsChange({ apiBaseUrl: e.target.value })
                      }
                    />
                  </label>
                  <label className="mishiranu-pricing-key">
                    <span>モデル名</span>
                    <input
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="gpt-4o-mini"
                      value={billing.apiModel}
                      onChange={(e) =>
                        onOpenAiSettingsChange({ apiModel: e.target.value })
                      }
                    />
                  </label>
                </>
              ) : null}

              <label className="mishiranu-pricing-key">
                <span>API キー</span>
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={
                    billing.byokProvider === "gemini" ? "AIza…" : "sk-…"
                  }
                  value={billing.apiKey}
                  onChange={(e) => onApiKeyChange(e.target.value)}
                />
              </label>
            </div>
          )}
        </div>
      </section>

      {note ? (
        <p className="mishiranu-pricing-status" role="status">
          {note}
        </p>
      ) : null}
    </div>
  );
}
