# 第一稿 50駅 · Argon 再生成（手動）

**目的:** 2026-11-14 前後に Hydrogen / 初稿で書いた京都コアを、**Argon 高**でちゃんとした土地文に置き換える。  
**出町柳を含める**（正本も上書き可）。

**自動送信は使わない。** 各ファイルのコードブロックを Gemini 新規チャットへ手動貼付。

## セット（合計 50駅）

| 順 | 回 | 内容 | 駅数 | ファイル | 取込先 |
|----|-----|------|------|----------|--------|
| 1 | **D0** | **出町柳** / 二ノ瀬 / 中書島 | **取込済3** | `prompts/PROMPT-D0.md` | `AREA_DEPTH` 正本 |
| 2 | EY1 | 叡電本線 · 元田中〜八瀬比叡山口 | **取込済7** | `prompts/PROMPT-EY1.md` | `eizan.md` |
| 3 | EY2 | 叡電鞍馬線 · 八幡前〜鞍馬 | **取込済7** | `prompts/PROMPT-EY2.md` | `eizan.md` |
| 4 | KY1 | 京阪 · 神宮丸太町〜伏見稲荷 | **取込済7** | `prompts/PROMPT-KY1.md` | `keihan.md` |
| 5 | KY2 | 京阪本線 · 深草〜淀 | **取込済6** | `prompts/PROMPT-KY2.md` | `keihan.md` |
| 6 | KY3 | 京阪 · 石清水〜宇治 | **取込済8** | `prompts/PROMPT-KY3.md` | `keihan.md` |
| 7 | KR1 | 烏丸洛内 · 鞍馬口〜京都 | **取込済7** | `prompts/PROMPT-KR1.md` | `karasuma.md` |
| 8 | SG1 | JR嵯峨野 · 二条〜嵯峨嵐山 | **取込済5** | `prompts/PROMPT-SG1.md` | `sagano.md` |

**内訳:** 正本3 + 叡電14 + 京阪21 + 烏丸7 + 嵯峨野5 = **50**

## 貼り方

**コピペ正本:** [`PROMPT-first50-paste.md`](./PROMPT-first50-paste.md)（8ブロック全部）  
**個別 txt:** `paste-first50/D0.txt` … `SG1.txt`（`pbcopy < paste-first50/D0.txt`）

1. Gemini **新規チャット** → モデル **Argon** · 思考 **高**
2. 上表の順（まず **D0＝出町柳**）でコードブロックを貼って送信
3. 返ってきたら Cursor に `{id}です` と全文貼る → 配線のみ（spots しない）

## 含めない（この50の外）

- 嵐電15 · 阪急京都12（同日稿だが別セット）
- 烏丸南北（karasuma-extends）· 東西線 · 近鉄京都 など量産パック

必要なら次の50として別索引を作る。
