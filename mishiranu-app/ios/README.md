# 見知らぬ駅 — Xcode / iOS（Publish 不要）

アプリ本体の Web UI を **Xcode プロジェクトに同梱**します。Cursor Apps の Publish は使いません。ネットワーク上の公開 URL も必須ではありません。

- Bundle ID: `jp.lagado.mishiranueki`
- 表示名: 見知らぬ駅
- Xcode: `App/App.xcodeproj`

このクラウド環境は Linux のため、**ビルドと実機実行は Mac の Xcode** で行ってください。

## いちばん簡単な手順（推奨）

白画面になったときは、この手順で **もう一度** sync し直してから Xcode で Run してください。

Mac のターミナルで:

```bash
cd ~/Desktop/laggard-institute
git pull
cd mishiranu-app
npm install
npm run ios:app
```

これで次をまとめて実行します。

1. 静的 Web を `ios-web/` に書き出し  
2. Capacitor が iOS プロジェクトへ同期  
3. Xcode が開く  

Xcode で:

1. 左の **App** ターゲットを選ぶ  
2. **Signing & Capabilities** で自分の Apple ID / Team を選ぶ  
3. iPhone またはシミュレータを選んで **▶ Run**

地図タイルや（任意の）AI 以外は、同梱ファイルだけで動きます。駅データ・コース・タブ（地図 / 土地 / 歩く / 案内 / ほか）はアプリ内に入っています。

## 開発中だけ Mac の Next に繋ぐ（任意）

```bash
npm run start          # 別ターミナル
npm run ios:live       # ライブ URL に sync → Xcode
```

## 注意

- Gemini の AI 駅生成・コピー生成はサーバー API が必要なため、同梱ビルドではオフライン時に種データへフォールバックします。  
- App Store 提出前は実機で位置情報許可と画面を確認してください。
