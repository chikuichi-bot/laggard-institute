# 見知らぬ駅 — Xcode / iOS（ローカル基準）

Capacitor のネイティブ iOS プロジェクトです。**Cursor Apps の Publish は不要**です。Mac 上の Next.js（いま作っているローカル版）を読みます。

- Bundle ID: `jp.lagado.mishiranueki`
- 表示名: 見知らぬ駅
- Xcode プロジェクト: `App/App.xcodeproj`
- 起動 URL（既定）: `http://127.0.0.1:3010/lab/mishiranu-eki`

このクラウド環境は Linux のため、シミュレータ実行は **Mac の Xcode** で行ってください。

## Mac での手順（ローカル最新版）

ターミナルを2つ使います。

**1. Next.js を起動**

```bash
cd mishiranu-app
npm install
npm run build
npm run start
```

**2. Capacitor をローカル URL に同期して Xcode を開く**

```bash
cd mishiranu-app
npm run ios:sync
npm run ios:open
```

`ios:sync` は同じ Wi‑Fi の LAN IP があればそれを使い、なければ `127.0.0.1` です（シミュレータ向け）。

Xcode が開いたら:

1. 左の **App** ターゲットを選択  
2. **Signing & Capabilities** で Team（Apple ID）を設定  
3. シミュレータまたは実機を選び **Run（▶）**

### 実機（iPhone）のとき

iPhone と Mac を同じ Wi‑Fi にしてから `npm run ios:sync` してください。手動指定もできます:

```bash
CAP_SERVER_URL=http://192.168.x.x:3010/lab/mishiranu-eki npm run ios:sync
npm run ios:open
```

Mac の IP は「システム設定 → ネットワーク」、または `ipconfig getifaddr en0` で確認できます。

## Safari / ホーム画面（Publish なし）

1. iPhone の Safari で `http://<MacのLAN-IP>:3010/lab/mishiranu-eki` を開く  
2. 共有 → 「ホーム画面に追加」

古いホーム画面アイコンは一度消してから追加し直してください。

## 含まれているもの

- `@capacitor/geolocation`（Info.plist に利用目的を記載）
- `@capacitor/status-bar` / `@capacitor/splash-screen`
- App Icon / Splash（和紙トーンの「駅」マーク）
