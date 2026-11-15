# 土地文 · 量産プロンプト索引（運用 B）

**生成日:** 2026-11-15 · **パック数:** 42 · **駅合計:** 480

1000駅を1チャットには載せない。**この索引の各ファイルを別 Gemini チャットに並列貼付**する。

## 貼り方（半自動 · API課金なし · Gemini Web Hydrogen）

```bash
cd mishiranu-app
npm run land:gemini:list          # 未取込一覧
npm run land:gemini:next          # 次の未取込をコピー＋Gemini起動
npm run land:gemini -- --pack L   # 指定パック
```

1. 上のコマンドで **クリップボードにプロンプトが入る**＋Gemini Web が開く
2. **新規チャット** · モデルは **Hydrogen 高**のまま · Cmd+V → 送信
3. 返ってきたら Cursor に `{id}です` と貼る → 配線のみ（spots しない）

手動のままやる場合: 下表のファイルを開き、コードブロックをコピーして同じ手順。

## 既収録（参考）

- 土地ストック済 **284駅**（K＋J3＋J4＋阪神L0/L2 まで）
- 本索引は **追加パック**（L 残り＋周辺〜関西主要線）

## パック一覧

| 回 | 内容 | 駅数 | ファイル | 取込先 |
|----|------|------|----------|--------|
| L | 阪神本線 · 尼崎〜魚崎 | **取込済15** | `PROMPT-hanshin.md` | `hanshin.md` |
| L0 | 阪神本線 · 福島〜大物 | **取込済7** | `prompts/PROMPT-L0.md` | `hanshin.md` |
| L2 | 阪神本線 · 住吉〜春日野道 | **取込済8** | `prompts/PROMPT-L2.md` | `hanshin.md` |
| L3 | 阪神なんば線 · 桜川〜伝法 | **取込済8** | `prompts/PROMPT-L3.md` | `hanshin-namba.md` |
| M1 | 阪急神戸本線 · 中津〜春日野道 | **取込済14** | `prompts/PROMPT-M1.md` | `hankyu-kobe.md` |
| M2 | 阪急宝塚本線 · 三国〜宝塚 | **取込済16** | `prompts/PROMPT-M2.md` | `hankyu-takarazuka.md` |
| M3 | 阪急京都本線 · 南方〜西山天王山 | **取込済15** | `prompts/PROMPT-M3.md` | `hankyu-kyoto-osaka.md` |
| M4 | 阪急今津線 · 今津〜宝塚 | **取込済10** | `prompts/PROMPT-M4.md` | `hankyu-imazu.md` |
| M5 | 阪急千里線 · 柴島〜北千里 | **取込済11** | `prompts/PROMPT-M5.md` | `hankyu-senri.md` |
| N1 | JR東西線 · 京橋〜尼崎 | **取込済9** | `prompts/PROMPT-N1.md` | `jr-tozai.md` |
| N2 | 大阪環状線 · 福島〜寺田町 | **取込済18** | `prompts/PROMPT-N2.md` | `jr-loop.md` |
| N3 | JR神戸線 · 塚本〜三ノ宮手前 | **取込済14** | `prompts/PROMPT-N3.md` | `jr-kobe.md` |
| N4 | JR宝塚線 · 塚口〜新三田 | **取込済13** | `prompts/PROMPT-N4.md` | `jr-takarazuka.md` |
| N5 | JR阪和線 · 美章園〜鳳 | **取込済13** | `prompts/PROMPT-N5.md` | `jr-hanwa.md` |
| N6 | JR阪和線 · 富木〜紀伊 | **取込済16** | `prompts/PROMPT-N6.md` | `jr-hanwa.md` |
| N7 | 大和路線 · 東部市場前〜郡山 | **取込済14** | `prompts/PROMPT-N7.md` | `jr-yamato.md` |
| Q1 | 御堂筋線 · 江坂〜あびこ（巨大駅除外） | **取込済13** | `prompts/PROMPT-Q1.md` | `midosuji.md` |
| Q2 | 御堂筋線 · 北花田〜なかもず | **取込済3** | `prompts/PROMPT-Q2.md` | `midosuji.md` |
| Q3 | 谷町線 · 東梅田〜八尾南手前 | **取込済17** | `prompts/PROMPT-Q3.md` | `tanimachi.md` |
| Q4 | 谷町線 · 大日〜都島 | **取込済7** | `prompts/PROMPT-Q4.md` | `tanimachi.md` |
| Q5 | 四つ橋線 · 西梅田〜住之江公園 | **取込済11** | `prompts/PROMPT-Q5.md` | `yotsubashi.md` |
| Q6 | 中央線 · コスモスクエア〜長田 | **取込済15** | `prompts/PROMPT-Q6.md` | `chuo.md` |
| Q7 | 堺筋線 · 天神橋筋六丁目〜天下茶屋 | **取込済10** | `prompts/PROMPT-Q7.md` | `sakaisuji.md` |
| Q8 | 千日前線 · 野田阪神〜南巽 | **取込済13** | `prompts/PROMPT-Q8.md` | `sennichimae.md` |
| Q9 | 長堀鶴見緑地線 · 大正〜門真南 | **取込済17** | `prompts/PROMPT-Q9.md` | `nagahori.md` |
| P1 | 南海高野線 · 今宮戎〜中百舌鳥 | **取込済13** | `prompts/PROMPT-P1.md` | `nankai-koya.md` |
| P2 | 南海高野線 · 白鷺〜天見 | **取込済14** | `prompts/PROMPT-P2.md` | `nankai-koya.md` |
| P3 | 南海本線 · 粉浜〜浜寺公園 | **取込済9** | `prompts/PROMPT-P3.md` | `nankai-main.md` |
| P4 | 南海本線 · 羽衣〜蛸地蔵 | **取込済10** | `prompts/PROMPT-P4.md` | `nankai-main.md` |
| P5 | 南海本線 · 貝塚〜みさき公園 | **取込済13** | `prompts/PROMPT-P5.md` | `nankai-main.md` |
| K2 | 近鉄大阪線 · 桜井〜名張 | **取込済8** | `prompts/PROMPT-K2.md` | `kintetsu-osaka-east.md` |
| K3 | 近鉄南大阪線 · 大阪阿部野橋〜古市 | **取込済15** | `prompts/PROMPT-K3.md` | `kintetsu-minami-osaka.md` |
| K4 | 近鉄南大阪線 · 駒ヶ谷〜橿原神宮前 | **取込済12** | `prompts/PROMPT-K4.md` | `kintetsu-minami-osaka.md` |
| J3 | 京阪本線 · 京橋〜淀屋橋 | **取込済4** | `prompts/PROMPT-J3.md` | `keihan-osaka.md` |
| J4 | 京阪中之島線 · 中之島〜なにわ橋 | **取込済4** | `prompts/PROMPT-J4.md` | `keihan-nakanoshima.md` |
| J5 | 京阪交野線 · 枚方市〜私市 | 7 | `prompts/PROMPT-J5.md` | `keihan-katano.md` |
| R1 | 山陽電鉄本線 · 西代〜明石 | 16 | `prompts/PROMPT-R1.md` | `sanyo.md` |
| R2 | 神戸市営地下鉄西神・山手線 · 新神戸〜西神中央 | 15 | `prompts/PROMPT-R2.md` | `kobe-subway.md` |
| N9 | JR福知山線 · 篠山口〜福知山 | 9 | `prompts/PROMPT-N9.md` | `jr-fukuchiyama.md` |
| S1 | 泉北高速鉄道 · 深井〜和泉中央 | 5 | `prompts/PROMPT-S1.md` | `senboku.md` |
| S2 | 北大阪急行 · 江坂以北〜箕面萱野 | 5 | `prompts/PROMPT-S2.md` | `kitakyu.md` |
| S3 | 大阪モノレール · 大阪空港〜門真市 | 14 | `prompts/PROMPT-S3.md` | `osaka-monorail.md` |

**このバッチ合計:** 480駅

**見込みストック:** 261 + 480 ≒ **741駅**（重複名・巨大除外の関係で実取込は前後する）

## まだ足せる（次々回）

- 近鉄名古屋線・山田線・鳥羽線、JR草津・湖西、京都市営烏丸以外、阪神武庫川線、山陽飾磨以西、和歌山電鐵、神戸電鉄、能勢電、京阪宇治以外の残り など
- 目標1000に向けて、返ってきた線から順に追記パックを足す

## エージェント向け

貼付を受けたら `PROMPT-batch-next.md` と同じ:
1. raw → md + land-depth.ts
2. AREA_DEPTH 配線
3. build（spots しない）

再生成: `python3 docs/land-stock/_gen_prompt_packs.py`
