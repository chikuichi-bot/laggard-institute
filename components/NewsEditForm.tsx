"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadAdminSecret, saveAdminSecret } from "@/lib/admin-auth";
import { makeNewsId, type NewsItem } from "@/lib/news-types";

type NewsEditFormProps = {
  initialItems: NewsItem[];
};

function blankItem(): NewsItem {
  return {
    id: makeNewsId(""),
    title: "",
    body: "",
    href: "",
    createdAt: new Date().toISOString(),
  };
}

function foundAtForInput(createdAt: string) {
  if (!createdAt) return "";
  return createdAt.length >= 10 ? createdAt.slice(0, 10) : createdAt;
}

export default function NewsEditForm({ initialItems }: NewsEditFormProps) {
  const router = useRouter();
  const [items, setItems] = useState<NewsItem[]>(initialItems);
  const [secret, setSecret] = useState("");
  const [rememberSecret, setRememberSecret] = useState(true);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSecret(loadAdminSecret());
  }, []);

  function updateItem(index: number, patch: Partial<NewsItem>) {
    setItems((current) =>
      current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    );
  }

  function addItem() {
    setItems((current) => [blankItem(), ...current]);
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, i) => i !== index));
  }

  function moveItem(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= items.length) return;
    setItems((current) => {
      const copy = [...current];
      const [entry] = copy.splice(index, 1);
      copy.splice(next, 0, entry);
      return copy;
    });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    for (const item of items) {
      if (!item.title.trim() || !item.body.trim()) {
        setStatus("error");
        setMessage("空のタイトルや本文がある項目があります。");
        return;
      }
    }

    if (rememberSecret && secret) {
      saveAdminSecret(secret);
    }

    setStatus("loading");
    setMessage("");

    const payload = {
      secret,
      items: items.map((item) => ({
        id: item.id,
        title: item.title.trim(),
        body: item.body.trim(),
        href: item.href?.trim() || undefined,
        createdAt: item.createdAt,
      })),
    };

    try {
      const response = await fetch("/api/news", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string; items?: NewsItem[] };

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "保存に失敗しました。");
        return;
      }

      if (data.items) {
        setItems(data.items);
      }

      setStatus("done");
      setMessage("保存しました。");
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("通信エラーが発生しました。");
    }
  }

  return (
    <form className="add-form" onSubmit={onSubmit}>
      <div className="admin-action-bar action-bar">
        <button type="button" className="action-btn" onClick={addItem}>
          項目を追加
        </button>
        <button
          type="submit"
          className="action-btn action-btn--primary action-btn--large"
          disabled={status === "loading"}
        >
          {status === "loading" ? "保存中…" : "保存する"}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="form-message">項目がありません。「項目を追加」で始めてください。</p>
      ) : null}

      {items.map((item, index) => (
        <article key={item.id} className="content-card content-card--flat admin-form-card">
          <div className="news-edit-item-header">
            <span className="form-label">お知らせ {index + 1}</span>
            <div className="news-edit-item-actions">
              <button
                type="button"
                className="action-btn action-btn--small"
                onClick={() => moveItem(index, -1)}
                disabled={index === 0}
                aria-label="上へ"
              >
                ↑
              </button>
              <button
                type="button"
                className="action-btn action-btn--small"
                onClick={() => moveItem(index, 1)}
                disabled={index === items.length - 1}
                aria-label="下へ"
              >
                ↓
              </button>
              <button
                type="button"
                className="action-btn action-btn--danger action-btn--small"
                onClick={() => removeItem(index)}
              >
                削除
              </button>
            </div>
          </div>

          <div className="add-form-fields">
            <label className="form-field">
              <span>タイトル</span>
              <input
                type="text"
                value={item.title}
                onChange={(e) => updateItem(index, { title: e.target.value })}
                required
              />
            </label>

            <label className="form-field">
              <span>本文</span>
              <textarea
                value={item.body}
                onChange={(e) => updateItem(index, { body: e.target.value })}
                rows={4}
                required
              />
            </label>

            <label className="form-field">
              <span>リンク（任意）</span>
              <input
                type="text"
                value={item.href ?? ""}
                onChange={(e) => updateItem(index, { href: e.target.value })}
                placeholder="/antiques または https://..."
              />
            </label>

            <label className="form-field">
              <span>日付</span>
              <input
                type="date"
                value={foundAtForInput(item.createdAt)}
                onChange={(e) => {
                  const day = e.target.value;
                  if (!day) return;
                  const createdAt = new Date(`${day}T12:00:00`).toISOString();
                  updateItem(index, { createdAt });
                }}
              />
            </label>
          </div>
        </article>
      ))}

      <article className="content-card content-card--flat admin-form-card">
        <div className="add-form-fields">
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
