# 見知らぬ駅 — プロダクトブリーフ

> 降りた駅の、徒歩圏だけを、物語にする。

Lagado Lab の企画メモ。触れるプロトタイプは本サイトの `/lab/mishiranu-eki`（公開URLは `https://lagado.jp/lagado2026/lab/mishiranu-eki/`）。

## 確定方針（2026-11-09）

| # | 論点 | 決定 |
| --- | --- | --- |
| 1 | 出荷 | **Web アプリ先行 → あとから iOS** |
| 2 | データ | **編集キュレーション 20駅**（Places 自動は後段） |
| 3 | 地図 | **OSM/CARTO の実地図**（暗いタイル）。必要なら後で Mapbox / Google に差替 |
| 4 | AI | **コピー（タイトル・キャッチ・空白肯定）に使う**。ルート提案はしない |
| 5 | 公開URL | **`/lagado2026/lab/mishiranu-eki/`**（このまま） |
| 6 | `/apps` 掲載 | **しない** |
| 7 | Cursor Apps | **やめる**（本サイト一本。`mishiranu-app/` は退役） |
| 8 | ホスティング | **さくら**（旧 Lolipop から移行。手前は Cloudflare） |

ロードマップ一文:

**編集20駅 → 実地図で感触 → コピーにAI → lagado.jp（さくら）へ統合 → 後から iOS**

## コアバリュー

地図アプリではなく、「思いがけない寄り道」の演出装置。

- 検索疲れを終わらせる（時間と半径で切る）
- 有名スポット偏重を避ける（徒歩圏のローカル）
- 「何もない駅」を失敗ではなく体験にする

## MVP（いまのスコープ）

1. **会話でつくる** — 駅 → 時間 → 重点（ご飯 / お土産 / 見所 / おまかせ）を対話チップで選ぶ
2. **物語** — 編集コピー、または `GEMINI_API_KEY` があるとき AI 生成
3. **観光案内マップ** — OSM 実地図 + 案内カテゴリ色のピンとボード
4. **シークレット** — 「とりあえずここに行け」
5. **空白肯定** — 美瑛・姨捨・根府川・月崎など

## 非目標（当面）

- Places 自動取得の全国展開
- Mapbox / Google 実地図
- 乗り換え・時刻表・口コミ・予約
- 最適ルートナビ
- iOS 出荷（Web の感触が固まってから）

## 技術メモ

- 本サイト統合: `app/lab/mishiranu-eki/`（lagado.jp の静的公開対象）
- 駅データ: `data/mishiranu-stations.ts`（**21駅**。先頭は体感用の出町柳。物語駅は案内5種＋レンタサイクル要約を揃える）
- Cursor Apps 試作 `mishiranu-app/` と `https://mishiranu-eki.apps.grok.bot` は退役予定（Publish Settings で非公開）
- コピー API: `POST /api/mishiranu/copy`（静的公開では未配信。キーなし／失敗時は編集文）
- AI モデル: **Gemini 3.1 Flash-Lite**（`gemini-3.1-flash-lite`）— おみくじ文庫の AI 解説と同じ
- 秘密情報: `GEMINI_API_KEY`（未設定でもプロトは動く）
- 必須案内: ご飯 / お土産 / 観光 / 休むところ / 寄り道 / レンタサイクル
- ご飯の分け方: **庶民的 / 高級** × **朝 / 昼 / 夜**（`mealTier` / `mealTimes`）
- スポットの時間: `hours`（例: `8:30〜17:30` / `終日（屋外）`）。わかるものだけ記入
- 現状の公開形: Cloudflare 前面 + オリジンはさくら。パスは従来どおり `/lagado2026/...`（Basic 認証つき）

## プロトでできた温度固め

- 抽象マップに線路・霧・駅名ラベル、「何もない」用の薄い空
- 駅名検索、コピー引き直し、物語テキストのコピー

## さくら向けビルド確認（2026-11-09）

- コマンド: `npm run build:lolipop:minimal`（本番と同型のミニマル静的）
- 出力: `lolipop/index.html` + `lolipop/lagado2026/lab/mishiranu-eki/`
- 公開予定URL: `https://lagado.jp/lagado2026/lab/mishiranu-eki/`
- 注意: ページは `searchParams` をサーバーで読まない（クライアントで URL を読む）。これで静的 export が通る

## さくらへ上げる（手元 FTP / ファイルマネージャ）

この Cloud Agent からはさくら FTP に入れない（認証情報が未接続）。手元で:

1. `npm run build:lolipop:minimal`（済みなら `lolipop/` を使う）
2. `lolipop/` の中身を `public_html/` へ上書き  
   - `index.html` → `public_html/index.html`  
   - `lagado2026/` → `public_html/lagado2026/`（`_next` と `lab/mishiranu-eki` は必ずセット）
3. 確認: `https://lagado.jp/lagado2026/lab/mishiranu-eki/`（Basic 認証あり）

次回からエージェントに上げさせたい場合は、Cursor Secrets に FTP 用の名前だけ用意してもらう（値はチャットに貼らない）。

## 次の作業候補

1. 手元でさくらへ上げて公開確認する
2. リポジトリから `mishiranu-app/` を削除する
3. 編集20駅の文面を実地・写真メモで更新
4. Web が安定したら iOS
