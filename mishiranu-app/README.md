# 見知らぬ駅

Lagado Lab のミニアプリ。研究所サイト本体とは別フォルダです。

- UI: `/lab/mishiranu-eki`
- API（任意）: `POST /api/mishiranu/*`（`GEMINI_API_KEY`）
- iOS: **静的バンドルを Xcode に同梱**（Cursor Apps Publish 不要）

## Web（開発）

```bash
npm install
npm run dev
```

## iPhone アプリ（Publish なし）

Mac で:

```bash
npm install
npm run ios:app
```

Xcode が開いたら Signing を設定して ▶ Run。詳細は [`ios/README.md`](./ios/README.md)。
