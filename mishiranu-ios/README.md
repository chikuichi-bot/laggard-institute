# 見知らぬ駅（iPhone ネイティブ版）

SwiftUI で書いた iPhone アプリです。Web やサーバーには依存せず、駅データはアプリに同梱しています。

- 画面：到着の会話 → 地図／土地／歩く／案内／ほか
- 地図：Apple マップ（MapKit）。徒歩圏の円、コースの線、番号ピン
- 現在地：Core Location。座標は端末の中で最寄り駅を探すのにだけ使います
- コース生成：Web 版（`mishiranu-app/lib/mishiranu-courses.ts`）と同じ結果になるよう移植
- ピクトグラム：EXPERIENCE JAPAN PICTOGRAMS（形は変えず、色と大きさのみ変更）

必要なもの：Xcode 16 以上、iOS 17 以上の iPhone。

## Mac で動かす

ターミナルに、上から順に貼り付けます。

```bash
cd ~/Desktop/laggard-institute
git fetch origin
git checkout cursor/mishiranu-native-ios-64a3
git pull
open mishiranu-ios/MishiranuEki.xcodeproj
```

Xcode が開いたら：

1. 左の一覧でいちばん上の **MishiranuEki**（青いアイコン）を選ぶ
2. **Signing & Capabilities** → **Team** で自分の Apple ID を選ぶ
3. 上部の端末選択で、つないだ iPhone を選ぶ
4. ▶（Run）を押す

初回は iPhone の「設定 → 一般 → VPN とデバイス管理」で開発元を信頼してください。
バンドル ID は以前の Web 版（Capacitor）と同じ `jp.lagado.mishiranueki` なので、入れるとそのアプリが置き換わります。

## 駅データを更新したとき

駅やスポットは `mishiranu-app/data/mishiranu-stations.ts` が元データです。編集したら JSON を書き出し直します。

```bash
cd ~/Desktop/laggard-institute/mishiranu-app
npm install
node ../mishiranu-ios/scripts/export-stations.mjs
```

`mishiranu-ios/MishiranuEki/Resources/stations.json` が更新されます。

## 構成

| 場所 | 中身 |
|---|---|
| `MishiranuEki/Core/` | モデル、コース生成、最寄り駅、会話の読み取り、画面の状態（Foundation のみ） |
| `MishiranuEki/UI/` | SwiftUI の画面、地図、位置情報 |
| `MishiranuEki/Resources/` | `stations.json`、ピクトグラムの利用条件 |
| `MishiranuEki/Assets.xcassets/` | アプリアイコン、アクセント色、ピクトグラム（SVG） |
| `scripts/export-stations.mjs` | TS の駅データ → `stations.json` |

## クレジット

ピクトグラム素材提供：日本デザインセンター／[EXPERIENCE JAPAN PICTOGRAMS](https://experience-japan.info/)
