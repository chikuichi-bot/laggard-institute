"use client";

import { useState } from "react";
import { buildInquiryMailto } from "@/lib/inquiry-mailto";
import type { CatalogItem } from "@/lib/types";

type InquiryFormProps = {
  item: CatalogItem;
};

export default function InquiryForm({ item }: InquiryFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError("お名前を入力してください。");
      return;
    }
    if (trimmedEmail && !trimmedEmail.includes("@")) {
      setError("メールアドレスの形式を確認してください。");
      return;
    }

    window.location.href = buildInquiryMailto(item, {
      name: trimmedName,
      email: trimmedEmail,
      phone: phone.trim(),
      message: message.trim(),
    });
  }

  return (
    <form className="purchase-form inquiry-form" onSubmit={onSubmit}>
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
          <span className="purchase-field-label">
            メールアドレス
            <span className="purchase-field-optional">任意</span>
          </span>
          <input
            type="email"
            name="email"
            autoComplete="email"
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
            お問い合わせ内容
            <span className="purchase-field-optional">任意</span>
          </span>
          <textarea
            name="message"
            rows={5}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="ご質問やご希望など"
          />
        </label>
      </div>

      <section className="purchase-form-actions detail-antique-section detail-antique-section--actions">
        {error ? <p className="form-message is-error purchase-form-error">{error}</p> : null}
        <button type="submit" className="action-btn action-btn--primary purchase-form-submit">
          内容を送る
        </button>
        <p className="detail-antique-note purchase-form-note">
          送信ボタンでメールアプリが開きます。
        </p>
      </section>
    </form>
  );
}
