"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PhotoPicker from "@/components/PhotoPicker";
import { isPhotoOnlyCategory } from "@/lib/category";
import { loadAdminSecret, saveAdminSecret } from "@/lib/admin-auth";
import type { CatalogItem, ItemCategory } from "@/lib/types";

type EditItemFormProps = {
  category: ItemCategory;
  item: CatalogItem;
};

function foundAtForInput(foundAt?: string) {
  if (!foundAt) return "";
  return foundAt.length >= 7 ? foundAt.slice(0, 7) : foundAt;
}

export default function EditItemForm({ category, item }: EditItemFormProps) {
  const router = useRouter();
  const isAntique = category === "antiques";
  const photoOnly = isPhotoOnlyCategory(category);

  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [location, setLocation] = useState(item.location ?? "");
  const [foundAt, setFoundAt] = useState(foundAtForInput(item.foundAt));
  const [priceLabel, setPriceLabel] = useState(item.priceLabel ?? "");
  const [forSale, setForSale] = useState(item.forSale ?? false);
  const [sold, setSold] = useState(item.sold ?? false);
  const [secret, setSecret] = useState("");
  const [rememberSecret, setRememberSecret] = useState(true);
  const [removeImages, setRemoveImages] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<FileList | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSecret(loadAdminSecret());
  }, []);

  const keptImages = item.images.filter((url) => !removeImages.includes(url));

  async function removeImageNow(url: string) {
    const remaining = item.images.filter((entry) => entry !== url);
    const message =
      remaining.length === 0
        ? "最後の写真です。削除すると写真なしの記録になります。よろしいですか？"
        : "この写真を掲載から削除しますか？";

    if (!window.confirm(message)) return;

    if (!secret) {
      setMessage("作業用パスワードを入力してください。");
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
    body.set("id", item.id);
    body.set("title", photoOnly ? location.trim() : title);
    body.set("description", photoOnly ? "" : description);
    body.set("location", location);
    body.set("foundAt", foundAt);
    body.set("priceLabel", priceLabel);
    body.set("forSale", forSale ? "true" : "false");
    body.set("sold", sold ? "true" : "false");
    body.append("removeImages", url);

    try {
      const response = await fetch("/api/items", { method: "PATCH", body });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "写真の削除に失敗しました。");
        return;
      }

      setRemoveImages((current) => [...current, url]);
      setStatus("idle");
      setMessage("写真を削除しました。");
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("通信エラーが発生しました。");
    }
  }

  function toggleRemoveImage(url: string) {
    void removeImageNow(url);
  }

  function buildFormData() {
    const body = new FormData();
    body.set("secret", secret);
    body.set("category", category);
    body.set("id", item.id);
    body.set("title", photoOnly ? location.trim() : title);
    body.set("description", photoOnly ? "" : description);
    body.set("location", location);
    body.set("foundAt", foundAt);
    body.set("priceLabel", priceLabel);
    body.set("forSale", forSale ? "true" : "false");
    body.set("sold", sold ? "true" : "false");
    removeImages.forEach((url) => body.append("removeImages", url));
    if (newFiles) {
      Array.from(newFiles).forEach((file) => body.append("images", file));
    }
    return body;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (keptImages.length === 0 && (!newFiles || newFiles.length === 0)) {
      setMessage("写真を1枚以上残すか、新しい写真を追加してください。");
      setStatus("error");
      return;
    }

    if (rememberSecret && secret) {
      saveAdminSecret(secret);
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/items", {
        method: "PATCH",
        body: buildFormData(),
      });
      const data = (await response.json()) as { error?: string; id?: string };

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "保存に失敗しました。");
        return;
      }

      setStatus("done");
      setMessage("保存しました。");
      router.push(`/${category}/${data.id}`);
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("通信エラーが発生しました。");
    }
  }

  async function onDelete() {
    if (!window.confirm(`「${title}」を削除しますか？`)) return;

    if (rememberSecret && secret) {
      saveAdminSecret(secret);
    }

    setStatus("loading");
    setMessage("");

    const body = new FormData();
    body.set("secret", secret);
    body.set("category", category);
    body.set("id", item.id);

    try {
      const response = await fetch("/api/items", { method: "DELETE", body });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "削除に失敗しました。");
        return;
      }

      router.push(`/admin/edit/${category}`);
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("通信エラーが発生しました。");
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
          {status === "loading" ? "保存中…" : "変更を保存"}
        </button>
        <button
          type="button"
          className="action-btn"
          onClick={() => router.push(`/${category}/${item.id}`)}
          disabled={status === "loading"}
        >
          掲載を見る
        </button>
        <button
          type="button"
          className="action-btn action-btn--danger"
          onClick={onDelete}
          disabled={status === "loading"}
        >
          削除
        </button>
      </div>

      <article className="content-card content-card--flat admin-form-card">
        <div className="add-form-fields">
          {item.images.length > 0 ? (
            <div className="photo-picker">
              <span className="form-label">登録済みの写真</span>
              <p className="photo-picker-hint">
                × を押すと、その場で掲載から削除します。記録ごと消すときは上の「削除」。
              </p>
              <div className="photo-picker-previews photo-picker-previews--existing">
                {item.images
                  .filter((url) => !removeImages.includes(url))
                  .map((url) => (
                    <div key={url} className="photo-existing-wrap">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" />
                      <button
                        type="button"
                        className="photo-existing-remove"
                        onClick={() => toggleRemoveImage(url)}
                        disabled={status === "loading"}
                        aria-label="写真を削除する"
                      >
                        ×
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}

          <PhotoPicker
            files={newFiles}
            onChange={setNewFiles}
            label="写真を追加"
            hint="× で選び直せます。1枚目が一覧のメイン写真です。"
          />

          {!photoOnly ? (
            <>
              <label className="form-field">
                <span>タイトル</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>説明（詳細ページの縦書き文）</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  required
                />
              </label>
            </>
          ) : null}

          <label className="form-field">
            <span>{photoOnly ? "場所" : "場所・メモ"}</span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required={photoOnly}
            />
          </label>

          {!isAntique ? (
            <label className="form-field">
              <span>拾った時期</span>
              <input
                type="month"
                value={foundAt}
                onChange={(e) => setFoundAt(e.target.value)}
              />
            </label>
          ) : null}

          {isAntique ? (
            <>
              <label className="form-field form-field--row form-field--check">
                <input
                  type="checkbox"
                  checked={forSale}
                  onChange={(e) => setForSale(e.target.checked)}
                />
                <span>販売する（購入ボタンを表示）</span>
              </label>
              <label className="form-field form-field--row form-field--check">
                <input
                  type="checkbox"
                  checked={sold}
                  onChange={(e) => setSold(e.target.checked)}
                />
                <span>売約済み</span>
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
