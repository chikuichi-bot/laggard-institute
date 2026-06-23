"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PhotoPicker from "@/components/PhotoPicker";
import { loadAdminSecret, saveAdminSecret } from "@/lib/admin-auth";
import type { ItemCategory } from "@/lib/types";

type UploadItemFormProps = {
  category: ItemCategory;
  submitLabel?: string;
  defaults?: {
    location?: string;
    forSale?: boolean;
    showFoundAt?: boolean;
    showPrice?: boolean;
  };
};

export default function UploadItemForm({
  category,
  submitLabel = "登録する",
  defaults = {},
}: UploadItemFormProps) {
  const router = useRouter();
  const {
    location: defaultLocation = "",
    forSale: defaultForSale = category === "antiques",
    showFoundAt = category !== "antiques",
    showPrice = category === "antiques",
  } = defaults;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState(defaultLocation);
  const [foundAt, setFoundAt] = useState("");
  const [priceLabel, setPriceLabel] = useState("");
  const [forSale, setForSale] = useState(defaultForSale);
  const [secret, setSecret] = useState("");
  const [rememberSecret, setRememberSecret] = useState(true);
  const [files, setFiles] = useState<FileList | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSecret(loadAdminSecret());
  }, []);

  useEffect(() => {
    setLocation(defaultLocation);
  }, [defaultLocation]);

  function resetForm() {
    setTitle("");
    setDescription("");
    setLocation(defaultLocation);
    setFoundAt("");
    setPriceLabel("");
    setForSale(defaultForSale);
    setFiles(null);
    setStatus("idle");
    setMessage("");
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!files || files.length === 0) {
      setMessage("写真を1枚以上選んでください。");
      setStatus("error");
      return;
    }

    if (rememberSecret && secret) {
      saveAdminSecret(secret);
    }

    setStatus("loading");
    setMessage("");

    const body = new FormData();
    body.set("secret", secret);
    body.set("category", category);
    body.set("title", title);
    body.set("description", description);
    body.set("location", location);
    body.set("foundAt", foundAt);
    body.set("priceLabel", priceLabel);
    body.set("forSale", forSale ? "true" : "false");
    Array.from(files).forEach((file) => body.append("images", file));

    try {
      const response = await fetch("/api/items", { method: "POST", body });
      const data = (await response.json()) as { error?: string; id?: string };

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "送信に失敗しました。");
        return;
      }

      setStatus("done");
      setMessage("登録しました。");
      router.push(`/${category}/${data.id}`);
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("通信エラーが発生しました。同じ Wi‑Fi か、本番 URL か確認してください。");
    }
  }

  return (
    <form className="add-form" onSubmit={onSubmit}>
      <div className="action-bar admin-action-bar">
        <button
          type="submit"
          className="action-btn action-btn--primary action-btn--large"
          disabled={status === "loading"}
        >
          {status === "loading" ? "送信中…" : submitLabel}
        </button>
        <button
          type="button"
          className="action-btn"
          onClick={resetForm}
          disabled={status === "loading"}
        >
          入力をクリア
        </button>
      </div>

      <article className="content-card content-card--flat admin-form-card">
        <div className="add-form-fields">
          <PhotoPicker
            files={files}
            onChange={setFiles}
            hint={
              category === "antiques"
                ? "1枚目が一覧のメイン写真。別角度は追加で選べます。"
                : "撮った向き（縦・横）のまま掲載されます。"
            }
          />

          <label className="form-field">
            <span>タイトル</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={category === "antiques" ? "例：抜け殻の機構" : "例：点眼の切れ端"}
              required
            />
          </label>

          <label className="form-field">
            <span>説明（詳細ページの縦書き文）</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="そのまま見た印象を、短い文で。"
              required
            />
          </label>

          <label className="form-field">
            <span>場所・メモ</span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={category === "antiques" ? "京都" : "西成、岸辺 など"}
            />
          </label>

          {showFoundAt ? (
            <label className="form-field">
              <span>拾った時期</span>
              <input
                type="month"
                value={foundAt}
                onChange={(e) => setFoundAt(e.target.value)}
              />
            </label>
          ) : null}

          {showPrice ? (
            <>
              <label className="form-field form-field--row form-field--check">
                <input
                  type="checkbox"
                  checked={forSale}
                  onChange={(e) => setForSale(e.target.checked)}
                />
                <span>販売する（購入ボタンを表示）</span>
              </label>
              <label className="form-field">
                <span>価格表示</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={priceLabel}
                  onChange={(e) => setPriceLabel(e.target.value)}
                  placeholder="¥8,800"
                />
              </label>
            </>
          ) : null}

          <label className="form-field">
            <span>作業用パスワード</span>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <label className="form-field form-field--row form-field--check">
            <input
              type="checkbox"
              checked={rememberSecret}
              onChange={(e) => setRememberSecret(e.target.checked)}
            />
            <span>この iPhone にパスワードを記憶する</span>
          </label>
        </div>
      </article>

      {message ? (
        <p className={`form-message ${status === "error" ? "is-error" : ""}`}>{message}</p>
      ) : null}
    </form>
  );
}
