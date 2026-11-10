# 見知らぬ駅（公開用ミニアプリ）

Lagado Lab の薄い公開用パッケージ。研究所サイト本体とは別フォルダです。

- UI: `/lab/mishiranu-eki`
- API: `POST /api/mishiranu/copy`（`GEMINI_API_KEY` → Gemini 3.1 Flash-Lite）
- iOS: Safari の「ホーム画面に追加」で standalone アプリ化（`manifest.webmanifest` + Service Worker）

```bash
npm install
npm run dev
```

## iPhone への入れ方（PWA）

1. Safari でアプリの URL を開く  
2. 共有 → **ホーム画面に追加**  
3. ホーム画面の「見知らぬ駅」から起動（Safari 枠なし）

## Xcode ネイティブアプリ

Capacitor の iOS プロジェクトは `ios/` にあります。詳細は [`ios/README.md`](./ios/README.md)。

```bash
npm run ios:sync
npm run ios:open   # Mac + Xcode が必要
```
