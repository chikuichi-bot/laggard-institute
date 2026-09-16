"use client";

import { useMemo, useState } from "react";
import { assetUrl, BASE_PATH } from "@/lib/asset-path";
import { BANK_TRANSFER } from "@/lib/constants";
import {
  paymentMethodOptions,
  type PaymentMethodId,
} from "@/lib/payment-methods";
import { formatPriceLabel } from "@/lib/price";
import { buildPurchaseMailto, type PurchaseFormData } from "@/lib/purchase-mailto";
import { calculateShipping, purchaseTotalYen, shippingQuoteReady } from "@/lib/shipping";
import type { CheckoutCategory } from "@/lib/checkout-session";
import type { CatalogItem } from "@/lib/types";

type PurchaseCheckoutProps = {
  item: CatalogItem;
  stripeAvailable: boolean;
  cardCheckoutReady: boolean;
  categoryLabel: string;
  checkoutCategory?: CheckoutCategory;
};

function PurchaseOrderSummary({
  item,
  productYen,
  shippingQuote,
  totalYen,
  prominent = false,
}: {
  item: CatalogItem;
  productYen: number;
  shippingQuote: ReturnType<typeof calculateShipping>;
  totalYen: number;
  prominent?: boolean;
}) {
  return (
    <div
      className={`purchase-order-summary${prominent ? " purchase-order-summary--prominent" : ""}`}
      aria-live="polite"
    >
      <h3 className="purchase-order-summary-title">
        {prominent ? "お支払い合計" : "お支払い目安"}
      </h3>
      <dl className="purchase-order-summary-rows">
        {shippingQuote.included ? (
          <div className="purchase-order-summary-row">
            <dt>お支払い金額</dt>
            <dd>
              {formatPriceLabel(totalYen)}
              <span className="purchase-order-summary-note">（クリックポスト送料込み）</span>
            </dd>
          </div>
        ) : (
          <>
            {productYen > 0 ? (
              <div className="purchase-order-summary-row">
                <dt>商品代金</dt>
                <dd>{item.priceLabel ?? formatPriceLabel(productYen)}</dd>
              </div>
            ) : null}
            <div className="purchase-order-summary-row">
              <dt>送料</dt>
              <dd>
                {formatPriceLabel(shippingQuote.yen)}
                <span className="purchase-order-summary-note">（{shippingQuote.label}）</span>
              </dd>
            </div>
            <div className="purchase-order-summary-row purchase-order-summary-row--total">
              <dt>合計</dt>
              <dd>{formatPriceLabel(totalYen)}</dd>
            </div>
          </>
        )}
      </dl>
    </div>
  );
}

export default function PurchaseCheckout({
  item,
  stripeAvailable,
  cardCheckoutReady,
  categoryLabel: categoryLabelText,
  checkoutCategory = "antiques",
}: PurchaseCheckoutProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>(
    cardCheckoutReady ? "credit_card" : "bank_transfer",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const hero = item.images[0] ? assetUrl(item.images[0]) : undefined;
  const trimmedAddress = address.trim();
  const shippingIncluded = item.shippingIncluded === true;
  const clickPostFlat = item.shippingMethod === "click_post" && !shippingIncluded;
  const shippingQuote = useMemo(() => {
    if (!shippingQuoteReady(trimmedAddress, item)) return null;
    return calculateShipping(trimmedAddress, item);
  }, [trimmedAddress, item, shippingIncluded]);

  const productYen = item.price ?? 0;
  const totalYen = shippingQuote ? purchaseTotalYen(productYen, shippingQuote.yen) : null;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const trimmedAddressSubmit = address.trim();

    if (!trimmedName) {
      setError("お名前を入力してください。");
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("メールアドレスを入力してください。");
      return;
    }
    if (!trimmedPhone || trimmedPhone.replace(/\D/g, "").length < 10) {
      setError("電話番号を入力してください（発送の連絡用）。");
      return;
    }
    if (!trimmedAddressSubmit || trimmedAddressSubmit.length < 5) {
      setError("ご住所を入力してください（発送先）。");
      return;
    }

    const data: PurchaseFormData = {
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      address: trimmedAddressSubmit,
      message: message.trim(),
      paymentMethod,
    };

    if (paymentMethod === "credit_card") {
      if (!cardCheckoutReady) {
        setError(
          stripeAvailable
            ? "この商品はカード決済の価格が未設定です。銀行振込をお選びください。"
            : "カード決済は現在準備中です。銀行振込をお選びください。",
        );
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`${BASE_PATH}/api/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemId: item.id,
            category: checkoutCategory,
            name: trimmedName,
            email: trimmedEmail,
            phone: trimmedPhone,
            address: trimmedAddressSubmit,
            message: message.trim(),
          }),
        });
        const payload = (await response.json()) as { url?: string; error?: string };
        if (!response.ok || !payload.url) {
          setError(payload.error ?? "カード決済を開始できませんでした。");
          setLoading(false);
          return;
        }
        window.location.href = payload.url;
        return;
      } catch {
        setError("通信エラーが発生しました。もう一度お試しください。");
        setLoading(false);
        return;
      }
    }

    const mailto = buildPurchaseMailto(item, data);
    const successPath =
      checkoutCategory === "amappola"
        ? `${BASE_PATH}/amappola/purchase/success`
        : `${BASE_PATH}/antiques/${item.id}/purchase/success`;

    // メールアプリを開きつつ、完了面へ進む（静的ホストでもクライアント完結）
    const mailLink = document.createElement("a");
    mailLink.href = mailto;
    mailLink.rel = "noopener";
    document.body.appendChild(mailLink);
    mailLink.click();
    mailLink.remove();
    window.location.assign(successPath);
  }

  const submitLabel =
    paymentMethod === "credit_card" && cardCheckoutReady
      ? totalYen
        ? `合計 ${formatPriceLabel(totalYen)} で支払う`
        : "カードで支払う"
      : paymentMethod === "bank_transfer"
        ? totalYen
          ? `合計 ${formatPriceLabel(totalYen)} で申し込む`
          : "振込で購入を申し込む"
        : "内容を送る";

  const submitNote =
    paymentMethod === "credit_card" && cardCheckoutReady
      ? totalYen
        ? `お支払い金額 ${formatPriceLabel(totalYen)} で Stripe の決済ページへ移動します。`
        : "住所を入力すると合計金額が表示されます。"
      : paymentMethod === "credit_card"
        ? "カード決済の準備ができていません。銀行振込をお選びください。"
        : totalYen
          ? `振込金額の目安: ${formatPriceLabel(totalYen)}（送料込み）`
          : "送信ボタンでメールアプリが開きます。";

  return (
    <>
      <section
        className="purchase-page-product detail-antique-section"
        aria-labelledby="purchase-product-heading"
      >
        <h2 id="purchase-product-heading" className="detail-antique-section-title">
          商品
        </h2>
        <div className="purchase-page-product-body">
          {hero ? (
            <figure className="purchase-page-photo">
              <div className="purchase-page-photo-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={hero} alt="" />
              </div>
            </figure>
          ) : null}
          <dl className="detail-antique-facts purchase-page-facts">
            <div className="detail-antique-fact">
              <dt>品名</dt>
              <dd>{item.title}</dd>
            </div>
            {item.priceLabel || productYen > 0 ? (
              <div className="detail-antique-fact">
                <dt>商品代金</dt>
                <dd className="detail-antique-price">
                  {item.priceLabel ?? formatPriceLabel(productYen)}
                </dd>
              </div>
            ) : null}
            {shippingQuote && totalYen !== null ? (
              shippingQuote.included ? (
                <div className="detail-antique-fact detail-antique-fact--total">
                  <dt>お支払い金額</dt>
                  <dd className="detail-antique-price detail-antique-price--total">
                    {item.priceLabel ?? formatPriceLabel(totalYen)}
                  </dd>
                </div>
              ) : (
                <>
                  <div className="detail-antique-fact">
                    <dt>送料</dt>
                    <dd>{formatPriceLabel(shippingQuote.yen)}</dd>
                  </div>
                  <div className="detail-antique-fact detail-antique-fact--total">
                    <dt>合計</dt>
                    <dd className="detail-antique-price detail-antique-price--total">
                      {formatPriceLabel(totalYen)}
                    </dd>
                  </div>
                </>
              )
            ) : (
              <div className="detail-antique-fact">
                <dt>合計</dt>
                <dd className="purchase-price-hint">住所入力後に表示</dd>
              </div>
            )}
            <div className="detail-antique-fact">
              <dt>カテゴリー</dt>
              <dd>{categoryLabelText}</dd>
            </div>
          </dl>
        </div>
      </section>

      <form className="purchase-form" onSubmit={onSubmit}>
        <section
          className="purchase-form-section detail-antique-section"
          aria-labelledby="purchase-contact-heading"
        >
          <h2 id="purchase-contact-heading" className="detail-antique-section-title">
            ご連絡先・発送先
          </h2>
          <p className="purchase-section-note">
            {shippingIncluded
              ? "クリックポストでお届けします。金額は送料込みです。"
              : clickPostFlat
                ? "クリックポストの送料は全国一律です。発送先の住所もご記入ください。"
                : "ご住所を入力すると、送料を加えた合計金額が自動で表示されます。"}
          </p>

          <div className="purchase-form-fields">
            <label className="purchase-field">
              <span className="purchase-field-label">お名前</span>
              <input
                type="text"
                name="name"
                autoComplete="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <label className="purchase-field">
              <span className="purchase-field-label">メールアドレス</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label className="purchase-field">
              <span className="purchase-field-label">電話番号</span>
              <input
                type="tel"
                name="phone"
                autoComplete="tel"
                required
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>

            <label className="purchase-field">
              <span className="purchase-field-label">ご住所（発送先）</span>
              <input
                type="text"
                name="address"
                autoComplete="street-address"
                required
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="〒606-8266 京都府京都市左京区…"
              />
            </label>
          </div>

          {shippingQuote && totalYen !== null ? (
            <PurchaseOrderSummary
              item={item}
              productYen={productYen}
              shippingQuote={shippingQuote}
              totalYen={totalYen}
              prominent
            />
          ) : trimmedAddress.length > 0 ? (
            <p className="purchase-payment-info-note">
              都道府県名を含めてください（例: 京都府、東京都、大阪府）。
            </p>
          ) : null}
        </section>

        <section
          className="purchase-form-section detail-antique-section"
          aria-labelledby="purchase-payment-heading"
        >
          <h2 id="purchase-payment-heading" className="detail-antique-section-title">
            お支払い方法
          </h2>

          <div
            className="purchase-payment-options"
            role="radiogroup"
            aria-labelledby="purchase-payment-heading"
          >
            {paymentMethodOptions.map((option) => {
              const cardDisabled = option.id === "credit_card" && !cardCheckoutReady;
              return (
                <label
                  key={option.id}
                  className={`purchase-payment-option${paymentMethod === option.id ? " is-selected" : ""}${
                    cardDisabled ? " is-disabled-hint" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={option.id}
                    checked={paymentMethod === option.id}
                    onChange={() => setPaymentMethod(option.id)}
                  />
                  <span className="purchase-payment-option-body">
                    <span className="purchase-payment-option-label">{option.label}</span>
                    <span className="purchase-payment-option-desc">
                      {cardDisabled && stripeAvailable
                        ? "価格（円）が未設定のため利用できません"
                        : cardDisabled
                          ? "現在準備中です"
                          : option.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {paymentMethod === "bank_transfer" ? (
            <div className="purchase-payment-info">
              <h3 className="purchase-payment-info-title">振込先</h3>
              <dl className="purchase-bank-details">
                <div className="purchase-bank-row">
                  <dt>金融機関</dt>
                  <dd>
                    {BANK_TRANSFER.bankName} {BANK_TRANSFER.branchName}
                    {BANK_TRANSFER.branchCode ? `（店番 ${BANK_TRANSFER.branchCode}）` : ""}
                  </dd>
                </div>
                <div className="purchase-bank-row">
                  <dt>口座</dt>
                  <dd>
                    {BANK_TRANSFER.accountType} {BANK_TRANSFER.accountNumber}
                  </dd>
                </div>
                <div className="purchase-bank-row">
                  <dt>名義</dt>
                  <dd>{BANK_TRANSFER.accountHolder}</dd>
                </div>
              </dl>
              <p className="purchase-payment-info-note">{BANK_TRANSFER.note}</p>
            </div>
          ) : null}
        </section>

        <section
          className="purchase-form-section detail-antique-section"
          aria-labelledby="purchase-message-heading"
        >
          <h2 id="purchase-message-heading" className="detail-antique-section-title">
            連絡事項
            <span className="purchase-field-optional">任意</span>
          </h2>

          <label className="purchase-field purchase-field--wide">
            <span className="visually-hidden">連絡事項</span>
            <textarea
              name="message"
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="受け取り方法やご質問など"
            />
          </label>
        </section>

        <section className="purchase-form-actions detail-antique-section detail-antique-section--actions">
          {error ? <p className="form-message is-error purchase-form-error">{error}</p> : null}
          {shippingQuote && totalYen !== null ? (
            <p className="purchase-submit-total" aria-live="polite">
              お支払い合計 <strong>{formatPriceLabel(totalYen)}</strong>
            </p>
          ) : null}
          <button
            type="submit"
            className="action-btn action-btn--primary purchase-form-submit"
            disabled={loading || (productYen > 0 && !shippingQuote)}
          >
            {loading ? "決済ページへ…" : submitLabel}
          </button>
          <p className="detail-antique-note purchase-form-note">{submitNote}</p>
        </section>
      </form>
    </>
  );
}
