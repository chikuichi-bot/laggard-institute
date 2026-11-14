# 土地文ストック

Gemini Pro（チャット月額）で先に貯めた **駅の土地の文章だけ**。
店リスト・座標・営業は含めない。アプリ本番の `AREA_DEPTH` / 生成 API とは別層。

## 方針

- 量産の第一稿。正本（出町柳・二ノ瀬・中書島など）は上書きしない
- 取り込み前に徒歩分・出口・固有名を通す
- 店の固有名は書かない（書いたら削る）
- **storyNotes（本・映画）はここでは作らない**（アプリの物語経路）
- **walkGuide（歩き方）がいちばん大事**（2026-11-14）。ここが「歩く」コースの正本。spots は文章に書いた場所を地図で支える側

## ファイル

| ファイル | 内容 |
|----------|------|
| `eizan.md` | 叡山電鉄（本線＋鞍馬線。出町柳・二ノ瀬除く）14駅 · 最良AI稿直取込済 |
| `keihan.md` | 京阪（鴨東〜洛南＋宇治線。出町・中書島除く）21駅 |
| `randen.md` | 嵐電（嵐山本線＋北野線）15駅 |
| `hankyu.md` | 阪急京都本線9駅＋嵐山線3駅（上桂〜嵐山） |
| `sagano.md` | JR嵯峨野線（二条〜嵯峨嵐山）5駅 |
| `karasuma.md` | 地下鉄烏丸線・洛内寄り7駅（鞍馬口〜京都）· 最良AI稿直取込済 |

## アプリへの取り込み

- Web: `lib/mishiranu-*-land-depth.ts` → `AREA_DEPTH` にマージ
- iOS: `AreaDepth.swift` の `byBareName` に同文
- 駅を開く／生成したあと `withAreaDepth` / `AreaDepth.overlay` で土地文が載る

## 生成の節約（2026-11-14）

収録土地文がある駅は API 生成時:

1. 土地文は正本のまま（Flash-Lite に書き直させない）
2. Search は spots・路線・座標など地図用だけ
3. 穴埋め Search は sight spots 不足のときだけ（土地の薄さでは打たない）

## spots バッチ（散歩地図）

収録土地がある駅だけ、spots 寄り Search → さくらキャッシュへ。

```bash
cd mishiranu-app
npm run batch:land-spots:dry          # 対象と cache hit 確認
npm run batch:land-spots              # 未キャッシュ分を生成
npm run batch:land-spots -- --line eizan --limit 5
npm run batch:land-spots -- --force   # 既存キャッシュも作り直し
```

- 月の Search 無料枠内で週1〜2回（`docs/MONETIZATION.md`）
- 正本名は `LAND_STOCK_SPOT_BATCH`（`lib/mishiranu-area-depth.ts`）＝この md の見出し
- 進捗確認: `npx tsx --env-file=.env.local scripts/_check-cache.ts`（間隔付き）
- **2026-11-14 バッチ:** さくら約 62/67。残り（Search 薄／混雑）: 帷子ノ辻 · 嵐電嵯峨 · 妙心寺 · 等持院・立命館… · 太秦 → 次の週バッチで
