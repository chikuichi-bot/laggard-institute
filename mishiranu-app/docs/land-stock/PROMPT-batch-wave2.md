# 土地文 · Wave2（運用 B + readings）

**生成日:** 2026-11-22 · **パック:** T1〜T13 · **駅合計:** 97

関西主要線（mass 480）取込後の続き。目標1000に向けた未収録線。

## 違い（Wave1 から）

- 各駅の出力に **readings（漢字: ひらがな）** を必須化
- 取込時: 土地文配線 + `speech-lexicon` へ読みを合流
- spots は走らない（運用 B 維持）

## 貼り方（Neon）

```bash
cd mishiranu-app
npm run land:gemini:list
npm run land:gemini:next                 # 次の未取込 → Neon 高 → 貼付
npm run land:gemini:until-limit          # 制限まで連続
# 手動コピペ: docs/land-stock/paste-neon/T2.txt …
```

返ってきたら Cursor に全文を貼る（または）:

```bash
pbpaste | npm run land:wave2:ingest -- T2 --stdin
npm run build   # spots しない
```

## パック

| 回 | 内容 | 駅数 | 取込先 |
|----|------|------|--------|
| T1 | 阪神武庫川線 · 武庫川〜武庫川団地前 | **取込済4** | `hanshin-mukogawa.md` |
| T2 | 能勢電鉄妙見線 · 滝山〜妙見口 | **取込済9**（何鹿除外） | `nose.md` |
| T2B | 能勢電鉄妙見線 · 鶯の森〜平野 | **取込済4** | `nose.md` |
| T3 | 能勢電鉄日生線 · 日生中央 | **取込済1** | `nose.md` |
| T4 | 神戸電鉄有馬線 · 湊川〜鈴蘭台 | **取込済5** | `shintetsu-arima.md` |
| T5 | 神戸電鉄有馬線 · 北鈴蘭台〜有馬温泉 | **取込済10** | `shintetsu-arima.md` |
| T5B | 神戸電鉄三田線 · 五社〜三田 | **取込済9** | `shintetsu-sanda.md` |
| T5C | 神戸電鉄公園都市線 · フラワータウン〜ウッディタウン中央 | **取込済3** | `shintetsu-koen-toshi.md` |
| T6 | JR草津線 · 草津〜柘植 | 8 | `jr-kusatsu.md` |
| T6A | JR加古川線 · 加古川〜西脇市 | **取込済13** | `jr-kakogawa.md` |
| T6B | JR加古川線 · 新西脇〜谷川 | **取込済8** | `jr-kakogawa.md` |
| T7 | 神戸電鉄粟生線 · 鈴蘭台西口〜志染 | **取込済10/10** | `shintetsu-ao.md` |
| T7B | 神戸電鉄粟生線 · 緑が丘〜志染 | **取込済3** | `shintetsu-ao.md` |
| T7C | 神戸電鉄粟生線 · 恵比須〜粟生 | **取込済9** | `shintetsu-ao.md` |
| T7D | 北条鉄道北条線 · 網引〜北条町 | **取込済7** | `hojo.md` |
| T8 | JR湖西線 · 大津京〜堅田 | 5 | `jr-kosei.md` |
| T9 | JR湖西線 · 小野〜比良 | 5 | `jr-kosei.md` |
| T10 | JR湖西線 · 近江舞子〜近江塩津 | 9 | `jr-kosei.md` |
| T11 | 山陽電鉄本線 · 人丸前〜飾磨 | 8 | `sanyo-west.md` |
| T12 | 山陽電鉄本線 · 西飾磨〜山陽網干 | 6 | `sanyo-west.md` |
| T13 | 和歌山電鐵貴志川線 · 和歌山〜貴志 | 13 | `wakayama-kishigawa.md` |

**Wave2 合計:** 97駅
