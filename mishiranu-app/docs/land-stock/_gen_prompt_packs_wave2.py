#!/usr/bin/env python3
"""Wave2 land-prose packs (toward ~1000). Appends to PROMPT-batch-mass.md without wiping wave1."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "prompts"
INDEX = ROOT / "PROMPT-batch-mass.md"
WAVE2_NOTE = ROOT / "PROMPT-batch-wave2.md"

COMMON = """見知らぬ駅アプリ用の「土地文」だけを書いてください。最高精度で。

【書く】
stationIntro（3〜5文）
walkGuide（一周できる歩き。橋・坂・川・旧道・大通り・改札・出口など固有名を入れる）
historyNotes（見出し＋本文を必ず3件。地形・街区・由来といまの見え方）
sightseeingNotes（必ず1〜3件。空にしない。正式名＋駅からの徒歩分＋着いたら何が見えるか）
readings（この駅の文に出た固有名だけ。漢字名: ひらがな。駅名自身も含む）

【書かない】
- 店リスト・営業・座標
- storyNotes（本・映画・ドラマ）
- 隣の駅の名所の寄せ合い
- 観光パンフ口調・抽象語だけの紹介
- 店の固有名（チェーン含む。博物館など施設の正式名は sightseeing として可）

【必ず守る】
1. 開業年・駅名・路線名は正確に（路線名は「{line}」）
2. 同名・乗換駅の他社文をコピーしない（キー注意を守る）
3. sightseeing を空にしない
4. walkGuide は実際に歩ける一周。行きっぱなし禁止
5. この駅固有の地形・鉄道構造・街区を優先
6. 神社・寺・橋・陵の正式名を揺らさない
7. readings は音声ガイド用。誤読されやすい固有名を落とさない

【出力形式】
駅名
stationIntro
（本文）
walkGuide
（本文）
historyNotes
見出し
本文
（×3）
sightseeingNotes
⚬ 名称: 名称です。改札から○へ徒歩約○分。着いたら見えること。
readings
漢字名: ひらがな
（必要なだけ）
"""

PACKS: list[dict] = []


def add(
    id: str,
    title: str,
    line: str,
    md: str,
    stations: list[str],
    exclude: list[str],
    keys: list[str],
) -> None:
    n = len(stations)
    if not (3 <= n <= 18):
        raise SystemExit(f"{id}: bad count {n}")
    PACKS.append(
        {
            "id": id,
            "title": title,
            "line": line,
            "md": md,
            "stations": stations,
            "exclude": exclude,
            "keys": keys,
        }
    )


# —— 阪神武庫川線 ——
add(
    "T1",
    "阪神武庫川線 · 武庫川〜武庫川団地前",
    "阪神武庫川線",
    "hanshin-mukogawa.md",
    ["武庫川", "東鳴尾", "洲先", "武庫川団地前"],
    ["本線各駅の寄せ", "尼崎百科"],
    [
        "「武庫川」は本線乗換に触れてよいが本線百科にしない",
        "団地前は団地街の地形・川沿いを具体に",
    ],
)

# —— 能勢電鉄 ——
add(
    "T2",
    "能勢電鉄妙見線 · 滝山〜妙見口",
    "能勢電鉄妙見線",
    "nose.md",
    [
        "滝山",
        "絹延橋",
        "何鹿",
        "一の鳥居",
        "畦野",
        "山下",
        "笹部",
        "光風台",
        "ときわ台",
        "妙見口",
    ],
    ["川西能勢口（阪急正本）", "日生線（T3）"],
    [
        "阪急川西能勢口の文をコピーしない",
        "妙見山観光百科にしない（駅徒歩圏）",
        "「山下」は日生線分岐に触れてよいが寄せ禁止",
    ],
)
add(
    "T3",
    "能勢電鉄日生線 · 日生中央",
    "能勢電鉄日生線",
    "nose.md",
    ["日生中央", "一の鳥居", "山下"],
    ["妙見線各駅の寄せ（T2）", "川西能勢口"],
    [
        "日生中央はニュータウンの地形を具体に",
        "一の鳥居・山下は日生線側の見え方だけ（妙見線文のコピー禁止）",
    ],
)

# —— 神戸電鉄有馬線 ——
add(
    "T4",
    "神戸電鉄有馬線 · 湊川〜鈴蘭台",
    "神戸電鉄有馬線",
    "shintetsu-arima.md",
    ["湊川", "長田", "丸山", "鵯越", "鈴蘭台"],
    ["新開地", "有馬温泉百科", "大阪メトロ長田寄せ"],
    [
        "「長田」≠ 大阪メトロ長田・山陽長田",
        "湊川は神戸高速に触れてよいが寄せ禁止",
        "鵯越は峠道の地形を具体に",
    ],
)
add(
    "T5",
    "神戸電鉄有馬線 · 北鈴蘭台〜有馬温泉",
    "神戸電鉄有馬線",
    "shintetsu-arima.md",
    [
        "北鈴蘭台",
        "山の街",
        "箕谷",
        "谷上",
        "花山",
        "大池",
        "岡場",
        "五社",
        "二郎",
        "電鉄有馬",
        "有馬温泉",
    ],
    ["鈴蘭台以南（T4）", "有馬温泉街の観光百科"],
    [
        "谷上は北神に触れてよいが北神百科にしない",
        "有馬温泉は駅徒歩圏・湯けむりの気配まで。宿リスト禁止",
    ],
)

# —— JR草津線 ——
add(
    "T6",
    "JR草津線 · 草津〜柘植",
    "JR草津線",
    "jr-kusatsu.md",
    ["草津", "手原", "石部", "甲西", "三雲", "甲賀", "貴生川", "柘植"],
    ["琵琶湖線巨大百科", "関西本線伊賀百科"],
    [
        "「草津」は東海道線乗換に触れてよいが草津駅百科にしない",
        "貴生川で信楽に触れてよいが信楽全線寄せ禁止",
        "柘植は関西本線乗換に触れてよいが伊賀上野寄せ禁止",
    ],
)

# —— 神戸電鉄粟生線 ——
add(
    "T7",
    "神戸電鉄粟生線 · 鈴蘭台西口〜志染",
    "神戸電鉄粟生線",
    "shintetsu-ao.md",
    [
        "鈴蘭台西口",
        "西鈴蘭台",
        "藍那",
        "木津",
        "小林",
        "栄",
        "押部谷",
        "緑が丘",
        "広野ゴルフ場前",
        "志染",
    ],
    ["鈴蘭台（有馬線）", "三木以西（後続）"],
    [
        "鈴蘭台本線の文をコピーしない",
        "「木津」≠ JR木津",
        "丘陵ニュータウンの切り通し・谷を具体に",
    ],
)

# —— JR湖西線 ——
add(
    "T8",
    "JR湖西線 · 大津京〜堅田",
    "JR湖西線",
    "jr-kosei.md",
    ["大津京", "唐崎", "比叡山坂本", "おごと温泉", "堅田"],
    ["山科（既存）", "京都巨大百科"],
    [
        "比叡山坂本はケーブルに触れてよいが比叡山頂百科にしない",
        "おごと温泉は宿リスト禁止。湖岸と駅前の気配まで",
    ],
)
add(
    "T9",
    "JR湖西線 · 小野〜比良",
    "JR湖西線",
    "jr-kosei.md",
    ["小野", "和邇", "蓬莱", "志賀", "比良"],
    ["堅田以南（T8）", "近江舞子以北（T10）"],
    [
        "「小野」≠ 地下鉄東西線小野",
        "湖岸・段丘・田園の切り替わりを具体に",
    ],
)
add(
    "T10",
    "JR湖西線 · 近江舞子〜近江塩津",
    "JR湖西線",
    "jr-kosei.md",
    [
        "近江舞子",
        "北小松",
        "近江高島",
        "安曇川",
        "新旭",
        "近江中庄",
        "マキノ",
        "永原",
        "近江塩津",
    ],
    ["比良以南（T9）", "北陸本線巨大百科"],
    [
        "安曇川は川と旧街道の関係を具体に",
        "近江塩津は北陸・湖西の結節に触れてよいが寄せ集め禁止",
    ],
)

# —— 山陽電鉄 · 飾磨以西 ——
add(
    "T11",
    "山陽電鉄本線 · 人丸前〜飾磨",
    "山陽電鉄本線",
    "sanyo-west.md",
    ["人丸前", "中八木", "富士見町", "西新町", "山陽姫路", "亀山", "亀の井", "飾磨"],
    ["山陽明石以東（R1済）", "JR姫路百科"],
    [
        "山陽姫路≠ JR姫路の文コピー",
        "飾磨は網干線分岐に触れてよいが網干全線寄せ禁止",
    ],
)
add(
    "T12",
    "山陽電鉄本線 · 西飾磨〜山陽網干",
    "山陽電鉄本線",
    "sanyo-west.md",
    ["西飾磨", "夢前川", "広畑", "山陽天満", "平松", "山陽網干"],
    ["飾磨以東（T11）", "JR網干寄せ"],
    [
        "広畑は製鉄所跡地・街区のいまを具体に",
        "山陽網干≠ JR網干の文コピー",
    ],
)

# —— 和歌山電鐵 ——
add(
    "T13",
    "和歌山電鐵貴志川線 · 和歌山〜貴志",
    "和歌山電鐵貴志川線",
    "wakayama-kishigawa.md",
    [
        "和歌山",
        "田中口",
        "日前宮",
        "神前",
        "竈山",
        "交通センター前",
        "岡崎前",
        "吉礼",
        "伊太祈曽",
        "山東",
        "大池遊園",
        "西貴志",
        "貴志",
    ],
    ["JR和歌山百科", "南海和歌山市寄せ"],
    [
        "「和歌山」はJR乗換に触れてよいがJR百科にしない",
        "貴志はたま駅長話に寄らず、駅前の道と空気を書く",
        "日前宮・竈山は正式名を揺らさない",
    ],
)


def render_pack(p: dict) -> str:
    n = len(p["stations"])
    excl = "\n".join(f"- {x}" for x in p["exclude"]) or "- （特になし）"
    keys = "\n".join(f"- {x}" for x in p["keys"])
    stations = " / ".join(p["stations"])
    prompt = COMMON.format(line=p["line"])
    prompt += f"""
---
【{p['id']}回】{p['title']}（{n}駅）

除外（書かない）:
{excl}

キー注意:
{keys}

対象駅（この順で全部・{n}駅）:
{stations}

各駅について上記形式で書いてください。
"""
    return f"""# {p['title']} · 土地文プロンプト（{p['id']}）

運用 B: 返ってきたら Cursor に貼る → **配線のみ**（spots しない）。
Wave2: 土地文に **readings（音読み）** を同梱。取込時は読み辞書にも反映。

取込先: `{p['md']}` → `mishiranu-*-land-depth.ts`

---

## このまま Gemini に貼る（共通＋{p['id']}）

```
{prompt.strip()}
```
"""


def append_mass_rows(rows: list[tuple[str, str, int, str, str]]) -> None:
    text = INDEX.read_text(encoding="utf-8")
    existing_ids = set(
        re.findall(r"^\|\s*([A-Z0-9]+)\s*\|", text, flags=re.M),
    )
    new_lines = []
    for id_, title, n, path, md in rows:
        if id_ in existing_ids:
            continue
        new_lines.append(f"| {id_} | {title} | {n} | `{path}` | `{md}` |")
    if not new_lines:
        print("mass index: no new rows")
        return
    # Insert before 「まだ足せる」 or append to table
    marker = "## まだ足せる（次々回）"
    block = "\n".join(new_lines) + "\n"
    if marker in text:
        text = text.replace(marker, block + "\n" + marker, 1)
    else:
        text = text.rstrip() + "\n" + block
    # Update the "まだ足せる" bullet to note wave2 started
    text = text.replace(
        "- 近鉄名古屋線・山田線・鳥羽線、JR草津・湖西、京都市営烏丸以外、阪神武庫川線、山陽飾磨以西、和歌山電鐵、神戸電鉄、能勢電、京阪宇治以外の残り など\n",
        "- Wave2（T1〜）: 武庫川線・能勢電・神鉄有馬・草津・湖西・山陽以西・貴志川 **プロンプト化済**\n"
        "- さらに次: 近鉄名古屋線・山田線・鳥羽線、神鉄粟生線、京阪京津 など\n",
    )
    INDEX.write_text(text, encoding="utf-8")
    print(f"mass index: appended {len(new_lines)} rows")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    total = 0
    for p in PACKS:
        path = OUT / f"PROMPT-{p['id']}.md"
        path.write_text(render_pack(p), encoding="utf-8")
        n = len(p["stations"])
        total += n
        rows.append((p["id"], p["title"], n, f"prompts/{path.name}", p["md"]))
        print(f"wrote {path.name} ({n})")

    append_mass_rows(rows)

    note = f"""# 土地文 · Wave2（運用 B + readings）

**生成日:** 2026-11-22 · **パック:** T1〜T13 · **駅合計:** {total}

関西主要線（mass 480）取込後の続き。目標1000に向けた未収録線。

## 違い（Wave1 から）

- 各駅の出力に **readings（漢字: ひらがな）** を必須化
- 取込時: 土地文配線 + `speech-lexicon` へ読みを合流
- spots は走らない（運用 B 維持）

## 貼り方

```bash
cd mishiranu-app
npm run land:gemini:list
npm run land:gemini:next          # 未取込の先頭（T1〜）
npm run land:gemini -- --pack T1
```

返ってきたら Cursor に `T1です` と貼る。

## パック

| 回 | 内容 | 駅数 | 取込先 |
|----|------|------|--------|
"""
    for id_, title, n, path, md in rows:
        note += f"| {id_} | {title} | {n} | `{md}` |\n"
    note += f"\n**Wave2 合計:** {total}駅\n"
    WAVE2_NOTE.write_text(note, encoding="utf-8")
    print(f"wave2 note {WAVE2_NOTE} · {total} stations")


if __name__ == "__main__":
    main()
