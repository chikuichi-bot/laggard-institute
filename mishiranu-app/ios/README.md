# 見知らぬ駅 — Xcode / iOS

Capacitor で作ったネイティブ iOS プロジェクトです。

- Bundle ID: `jp.lagado.mishiranueki`
- 表示名: 見知らぬ駅
- Xcode プロジェクト: `App/App.xcodeproj`
- 起動 URL（既定）: `https://mishiranu-eki.apps.grok.bot/lab/mishiranu-eki`

このクラウド環境は Linux のため、**シミュレータ実行や署名ビルドは Mac の Xcode で行ってください。**

## Mac での開き方

```bash
cd mishiranu-app
npm install
npx cap sync ios
npx cap open ios
```

Xcode が開いたら:

1. 左の **App** ターゲットを選択  
2. **Signing & Capabilities** で Team（Apple ID）を設定  
3. 実機またはシミュレータを選び **Run（▶）**

## ローカル Next.js に繋ぐ（開発）

Mac で `npm run start`（または `dev`）を 3010 で起動したうえで:

```bash
CAP_SERVER_URL=http://127.0.0.1:3010/lab/mishiranu-eki npx cap sync ios
npx cap open ios
```

実機のときは `127.0.0.1` の代わりに Mac の LAN IP を使います。

## 含まれているもの

- `@capacitor/geolocation`（位置情報の利用許可文を Info.plist に記載）
- `@capacitor/status-bar` / `@capacitor/splash-screen`
- App Icon / Splash（和紙トーンの「駅」マーク）

## App Store 提出メモ

- 現状は WebView がホスト上の Next.js を読みます（Cursor Apps / 自前ホスト）。
- 審査では「中身が Web」と見なされることがあります。オフライン同梱や機能のネイティブ化が必要になる場合あり。
- 提出前に `CAP_SERVER_URL` を本番 URL に固定し、`npx cap sync ios` してから Archive してください。
