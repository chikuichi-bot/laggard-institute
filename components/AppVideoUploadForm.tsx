"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { loadAdminSecret, saveAdminSecret } from "@/lib/admin-auth";

type UploadStatus = {
  uploaded: boolean;
  filename: string | null;
  poster: string;
};

export default function AppVideoUploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [secret, setSecret] = useState("");
  const [rememberSecret, setRememberSecret] = useState(true);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [message, setMessage] = useState("");
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);

  useEffect(() => {
    setSecret(loadAdminSecret());
  }, []);

  useEffect(() => {
    fetch("/api/apps/video")
      .then((res) => res.json())
      .then((data: UploadStatus) => setUploadStatus(data))
      .catch(() => setUploadStatus(null));
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setMessage("動画ファイルを選んでください。");
      return;
    }
    if (!secret.trim()) {
      setMessage("管理パスワードを入力してください。");
      return;
    }

    setStatus("loading");
    setMessage("");

    const form = new FormData();
    form.set("secret", secret.trim());
    form.set("video", file);

    try {
      const response = await fetch("/api/apps/video", {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as { error?: string; filename?: string };
      if (!response.ok) {
        setMessage(data.error ?? "アップロードに失敗しました。");
        return;
      }

      if (rememberSecret) saveAdminSecret(secret.trim());
      setMessage("動画をアップロードしました。アプリページで再生できます。");
      setUploadStatus({
        uploaded: true,
        filename: data.filename ?? null,
        poster: "/videos/omikuji-bunko-poster.jpg",
      });
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      setMessage("通信エラーが発生しました。");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <label className="form-field">
        <span>管理パスワード</span>
        <input
          type="password"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          autoComplete="current-password"
        />
      </label>

      <label className="form-field form-field--checkbox">
        <input
          type="checkbox"
          checked={rememberSecret}
          onChange={(event) => setRememberSecret(event.target.checked)}
        />
        <span>この端末にパスワードを覚えておく</span>
      </label>

      <div className="form-field">
        <span>おみくじ文庫のデモ動画</span>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm"
        />
        <p className="form-hint">
          iPhone の写真アプリから .mov / .mp4 を選べます。チャット添付では動画本体が届かないことがあるため、ここから直接送ってください。
        </p>
      </div>

      {uploadStatus?.uploaded ? (
        <p className="form-message">
          現在のファイル: <code>{uploadStatus.filename}</code>
        </p>
      ) : (
        <p className="form-message">まだ動画は登録されていません（ポスター画像のみ）。</p>
      )}

      <button type="submit" className="action-btn action-btn--primary" disabled={status === "loading"}>
        {status === "loading" ? "送信中…" : "動画をアップロード"}
      </button>

      {message ? <p className="form-message">{message}</p> : null}
    </form>
  );
}
