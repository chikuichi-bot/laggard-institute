"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadAdminSecret, saveAdminSecret } from "@/lib/admin-auth";
import { catalogDisplayTitle, isPhotoOnlyCategory } from "@/lib/category";
import type { CatalogItem, ItemCategory } from "@/lib/types";

type AdminEditListProps = {
  category: ItemCategory;
  items: CatalogItem[];
};

export default function AdminEditList({ category, items }: AdminEditListProps) {
  const router = useRouter();
  const photoOnly = isPhotoOnlyCategory(category);
  const [secret, setSecret] = useState("");
  const [rememberSecret, setRememberSecret] = useState(true);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSecret(loadAdminSecret());
  }, []);

  async function deleteItem(item: CatalogItem) {
    if (!secret) {
      setMessage("作業用パスワードを入力してください。");
      return;
    }
    if (!window.confirm(`「${catalogDisplayTitle(item, category)}」を掲載から削除しますか？\n写真もまとめて消えます。`)) {
      return;
    }

    if (rememberSecret) {
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
        setMessage(data.error ?? "削除に失敗しました。");
        setStatus("idle");
        return;
      }

      router.refresh();
      setStatus("idle");
    } catch {
      setMessage("通信エラーが発生しました。");
      setStatus("idle");
    }
  }

  if (items.length === 0) {
    return <p className="admin-empty">まだ記録がありません。</p>;
  }

  return (
    <>
      <div className="admin-edit-toolbar">
        <label className="form-field">
          <span>作業用パスワード</span>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="current-password"
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

      <ul className="admin-item-list">
        {items.map((item) => (
          <li key={item.id} className="admin-item-list-entry">
            <Link href={`/admin/edit/${category}/${item.id}`} className="admin-item-row">
              <div className="admin-item-thumb-wrap">
                {item.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.images[0]} alt="" className="admin-item-thumb" />
                ) : (
                  <div className="admin-item-thumb admin-item-thumb--empty" aria-hidden>
                    無
                  </div>
                )}
              </div>
              <div className="admin-item-copy">
                <span className="admin-item-title">
                  {catalogDisplayTitle(item, category)}
                </span>
                {item.location && !photoOnly ? (
                  <span className="admin-item-meta">{item.location}</span>
                ) : null}
                {category === "antiques" && item.sold ? (
                  <span className="admin-item-meta">売約済み</span>
                ) : null}
              </div>
              <span className="admin-item-chevron" aria-hidden>
                ›
              </span>
            </Link>
            <button
              type="button"
              className="action-btn action-btn--danger admin-item-delete"
              disabled={status === "loading"}
              onClick={() => deleteItem(item)}
            >
              削除
            </button>
          </li>
        ))}
      </ul>

      {message ? <p className="form-message is-error">{message}</p> : null}
    </>
  );
}
