# 見知らぬ駅（ローカル開発用ミニアプリ）

Lagado Lab の薄い公開用パッケージ。研究所サイト本体とは別フォルダです。

- UI: `/lab/mishiranu-eki`
- API: `POST /api/mishiranu/copy`（`GEMINI_API_KEY` → Gemini 3.1 Flash-Lite）
- iOS: **ローカルの Next.js を読む**（Cursor Apps の Publish は不要）

```bash
npm install
npm run build
npm run start
# 開発中は npm run dev でも可（ポート 3010）
```

## iPhone（Safari / ホーム画面）

1. Mac で上記サーバーを起動  
2. iPhone を同じ Wi‑Fi にし、Safari で `http://<MacのLAN-IP>:3010/lab/mishiranu-eki` を開く  
3. 共有 → **ホーム画面に追加**

画面が古いときは、ホーム画面アイコンを消してから追加し直してください。

## Xcode ネイティブアプリ

```bash
npm run start          # 別ターミナルで起動したまま
npm run ios:local      # ローカル URL に sync → Xcode を開く
```

詳細は [`ios/README.md`](./ios/README.md)。
