"use client";

import { useState } from "react";
import { BANK_TRANSFER } from "@/lib/constants";
import {
  paymentMethodOptions,
  type PaymentMethodId,
} from "@/lib/payment-methods";
import { buildPurchaseMailto, type PurchaseFormData } from "@/lib/purchase-mailto";
import type { CatalogItem } from "@/lib/types";

type PurchaseFormProps = {
  item: CatalogItem;
  stripeAvailable: boolean;
};

export default function PurchaseForm({ item, stripeAvailable }: PurchaseFormProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>("bank_transfer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError("お名前を入力してください。");
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("メールアドレスを入力してください。");
      return;
    }

    const data: PurchaseFormData = {
      name: trimmedName,
      email: trimmedEmail,
      phone: phone.trim(),
      address: address.trim(),
      message: message.trim(),
      paymentMethod,
    };

    if (paymentMethod === "credit_card" && stripeAvailable) {
      setLoading(true);
      try {
        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: item.id }),
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

    window.location.href = buildPurchaseMailto(item, data);
  }

  const submitLabel =
    paymentMethod === "credit_card" && stripeAvailable
      ? "カードで支払う"
      : paymentMethod === "bank_transfer"
        ? "振込で購入を申し込む"
        : "内容を送る";

  const submitNote =
    paymentMethod === "credit_card" && stripeAvailable
      ? "Stripe の安全な決済ページへ移動します。"
      : paymentMethod === "credit_card"
        ? "カード決済準備中のため、メールアプリが開きます。"
        : "送信ボタンでメールアプリが開きます。振込先は下記をご確認ください。";

  return (
    <form className="purchase-form" onSubmit={onSubmit}>
      <section
        className="purchase-form-section detail-antique-section"
        aria-labelledby="purchase-payment-heading"
      >
        <h2 id="purchase-payment-heading" className="detail-antique-section-title">
          お支払い方法
        </h2>

        <div className="purchase-payment-options" role="radiogroup" aria-labelledby="purchase-payment-heading">
          {paymentMethodOptions.map((option) => (
            <label
              key={option.id}
              className={`purchase-payment-option${paymentMethod === option.id ? " is-selected" : ""}${
                option.id === "credit_card" && !stripeAvailable ? " is-disabled-hint" : ""
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
                <span className="purchase-payment-option-desc">{option.description}</span>
              </span>
            </label>
          ))}
        </div>

        {paymentMethod === "bank_transfer" ? (
          <div className="purchase-payment-info">
            <h3 className="purchase-payment-info-title">振込先</h3>
            <dl className="purchase-bank-details">
              <div className="purchase-bank-row">
                <dt>金融機関</dt>
                <dd>
                  {BANK_TRANSFER.bankName} {BANK_TRANSFER.branchName}
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
            <p className="purchase-payment-info-note">
              お振込の際は、お名前と品名（{item.title}）をご記入ください。
            </p>
          </div>
        ) : (
          <div className="purchase-payment-info">
            <h3 className="purchase-payment-info-title">クレジットカード</h3>
            {stripeAvailable ? (
              <p className="purchase-payment-info-note">
                Visa、Mastercard、American Express などがご利用いただけます。送信後、Stripe
                の決済ページへ移動します。
              </p>
            ) : (
              <p className="purchase-payment-info-note">
                カード決済は現在準備中です。送信後、メールでカード決済のご案内をいたします。お急ぎの場合は銀行振込をご利用ください。
              </p>
            )}
          </div>
        )}
      </section>

      <section
        className="purchase-form-section detail-antique-section"
        aria-labelledby="purchase-contact-heading"
      >
        <h2 id="purchase-contact-heading" className="detail-antique-section-title">
          ご連絡先
        </h2>

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
            <span className="purchase-field-label">
              電話番号
              <span className="purchase-field-optional">任意</span>
            </span>
            <input
              type="tel"
              name="phone"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>

          <label className="purchase-field">
            <span className="purchase-field-label">
              ご住所
              <span className="purchase-field-optional">任意</span>
            </span>
            <input
              type="text"
              name="address"
              autoComplete="street-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </label>
        </div>
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
        <button
          type="submit"
          className="action-btn action-btn--primary purchase-form-submit"
          disabled={loading}
        >
          {loading ? "決済ページへ…" : submitLabel}
        </button>
        <p className="detail-antique-note purchase-form-note">{submitNote}</p>
      </section>
    </form>
  );
}
