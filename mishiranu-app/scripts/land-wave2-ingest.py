#!/usr/bin/env python3
"""
Wave2 Neon 返り → md + land-depth.ts + AREA_DEPTH 配線 + readings merge。
spots は走らない。

Usage:
  python3 scripts/land-wave2-ingest.py T2 path/to/raw.txt
  pbpaste | python3 scripts/land-wave2-ingest.py T2 --stdin
  python3 scripts/land-wave2-ingest.py T2 --stdin   # 標準入力
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LAND = ROOT / "docs/land-stock"
LIB = ROOT / "lib"
AREA = LIB / "mishiranu-area-depth.ts"
BATCH_SPOTS = ROOT / "scripts/batch-land-spots.ts"
MASS = LAND / "PROMPT-batch-mass.md"
WAVE2 = LAND / "PROMPT-batch-wave2.md"
README = LAND / "README.md"
RAW_DIR = LAND / ".gemini-web/raw"
READINGS_RAW = LAND / "readings/raw"

PACKS: dict[str, dict] = {
    "T2": {
        "title": "能勢電鉄妙見線",
        "md": "nose.md",
        "ts": "mishiranu-nose-land-depth.ts",
        "export": "NOSE_LAND_DEPTH",
        "line": "nose",
        # 何鹿は実在しない。鶯の森・鼓滝・多田・平野は T2b へ。
        "ids": {
            "滝山": "takiyama",
            "絹延橋": "kinunobashi",
            "一の鳥居": "ichino-torii",
            "畦野": "uneno",
            "山下": "yamashita-nose",
            "笹部": "sasabe",
            "光風台": "kofudai",
            "ときわ台": "tokiwadai",
            "妙見口": "myokenguchi",
        },
        "override_existing": False,
    },
    "T2B": {
        "title": "能勢電鉄妙見線",
        "md": "nose.md",
        "ts": "mishiranu-nose-land-depth.ts",
        "export": "NOSE_LAND_DEPTH",
        "line": "nose",
        "ids": {
            "鶯の森": "uguisu-no-mori",
            "鼓滝": "tsuzumigataki",
            "多田": "tada-nose",
            "平野": "hirano-nose",
        },
        "append_md": True,
        "override_existing": True,
    },
    "T3": {
        "title": "能勢電鉄日生線",
        "md": "nose.md",
        "ts": "mishiranu-nose-land-depth.ts",
        "export": "NOSE_LAND_DEPTH",
        "line": "nose",
        # 一の鳥居・山下は妙見線文を既取込済のため上書きしない（日生中央のみ）
        "ids": {
            "日生中央": "nissei-chuo",
        },
        "override_existing": True,
        "append_md": True,
    },
    "T4": {
        "title": "神戸電鉄有馬線",
        "md": "shintetsu-arima.md",
        "ts": "mishiranu-shintetsu-arima-land-depth.ts",
        "export": "SHINTETSU_ARIMA_LAND_DEPTH",
        "line": "shintetsu-arima",
        "ids": {
            "湊川": "minatogawa-shintetsu",
            "長田": "nagata-shintetsu",
            "丸山": "maruyama-shintetsu",
            "鵯越": "hiyodorigoe",
            "鈴蘭台": "suzurandai",
        },
    },
    "T5": {
        "title": "神戸電鉄有馬線",
        "md": "shintetsu-arima.md",
        "ts": "mishiranu-shintetsu-arima-land-depth.ts",
        "export": "SHINTETSU_ARIMA_LAND_DEPTH",
        "line": "shintetsu-arima",
        # 岡場・五社・二郎は三田線。有馬線実順: 神鉄六甲・唐櫃台・有馬口・有馬温泉
        "ids": {
            "北鈴蘭台": "kita-suzurandai",
            "山の街": "yamanomachi",
            "箕谷": "mitani",
            "谷上": "tanigami",
            "花山": "hanayama",
            "大池": "oike-shintetsu",
            "神鉄六甲": "shintetsu-rokko",
            "唐櫃台": "karatodai",
            "有馬口": "arimaguchi",
            "有馬温泉": "arima-onsen",
        },
        "append_md": True,
        "override_existing": True,
    },
    "T5B": {
        "title": "神戸電鉄三田線",
        "md": "shintetsu-sanda.md",
        "ts": "mishiranu-shintetsu-sanda-land-depth.ts",
        "export": "SHINTETSU_SANDA_LAND_DEPTH",
        "line": "shintetsu-sanda",
        # JR三田・JR道場と衝突しないよう *-shintetsu / 固有名ID
        "ids": {
            "五社": "gosha",
            "岡場": "okaba",
            "田尾寺": "taoji",
            "二郎": "nirou",
            "道場南口": "dojo-minamiguchi",
            "神鉄道場": "shintetsu-dojo",
            "横山": "yokoyama-shintetsu",
            "三田本町": "sanda-honmachi",
            "三田": "sanda-shintetsu",
        },
    },
    "T5C": {
        "title": "神戸電鉄公園都市線",
        "md": "shintetsu-koen-toshi.md",
        "ts": "mishiranu-shintetsu-koen-toshi-land-depth.ts",
        "export": "SHINTETSU_KOEN_TOSHI_LAND_DEPTH",
        "line": "shintetsu-koen-toshi",
        # 横山は三田線側 T5B 済。公園都市線は3駅のみ
        "ids": {
            "フラワータウン": "flower-town",
            "南ウッディタウン": "minami-woody-town",
            "ウッディタウン中央": "woody-town-chuo",
        },
    },
    "T6": {
        "title": "JR草津線",
        "md": "jr-kusatsu.md",
        "ts": "mishiranu-jr-kusatsu-land-depth.ts",
        "export": "JR_KUSATSU_LAND_DEPTH",
        "line": "jr-kusatsu",
        "ids": {
            "草津": "kusatsu-jr",
            "手原": "tehara",
            "石部": "ishibe",
            "甲西": "kosei-kusatsu",
            "三雲": "mikumo",
            "甲賀": "koka",
            "貴生川": "kibukawa",
            "柘植": "tsuge",
        },
    },
    "T6A": {
        "title": "JR加古川線",
        "md": "jr-kakogawa.md",
        "ts": "mishiranu-jr-kakogawa-land-depth.ts",
        "export": "JR_KAKOGAWA_LAND_DEPTH",
        "line": "jr-kakogawa",
        # 神鉄市場・神鉄粟生と衝突回避
        "ids": {
            "加古川": "kakogawa",
            "日岡": "hioka",
            "神野": "kanno",
            "厄神": "yakujin",
            "市場": "ichiba-jr",
            "小野町": "onomachi",
            "粟生": "ao-jr",
            "河合西": "kawai-nishi",
            "青野ケ原": "aonogahara",
            "社町": "yashirocho",
            "滝野": "takino",
            "滝": "taki-kakogawa",
            "西脇市": "nishiwakishi",
        },
    },
    "T6B": {
        "title": "JR加古川線",
        "md": "jr-kakogawa.md",
        "ts": "mishiranu-jr-kakogawa-land-depth.ts",
        "export": "JR_KAKOGAWA_LAND_DEPTH",
        "line": "jr-kakogawa",
        "ids": {
            "新西脇": "shin-nishiwaki",
            "比延": "hie",
            "日本へそ公園": "nihon-heso-koen",
            "黒田庄": "kurodasho",
            "本黒田": "honkuroda",
            "船町口": "funamachiguchi",
            "久下村": "kugemura",
            "谷川": "tanikawa",
        },
        "append_md": True,
        "override_existing": True,
    },
    "T7": {
        "title": "神戸電鉄粟生線",
        "md": "shintetsu-ao.md",
        "ts": "mishiranu-shintetsu-ao-land-depth.ts",
        "export": "SHINTETSU_AO_LAND_DEPTH",
        "line": "shintetsu-ao",
        "ids": {
            "鈴蘭台西口": "suzurandai-nishiguchi",
            "西鈴蘭台": "nishi-suzurandai",
            "藍那": "aina",
            "木津": "kizu-shintetsu",
            "木幡": "kobata-shintetsu",
            "栄": "sakae-shintetsu",
            "押部谷": "oshibedani",
            "緑が丘": "midorigaoka-shintetsu",
            "広野ゴルフ場前": "hirono-golf",
            "志染": "shijimi",
        },
    },
    "T7B": {
        "title": "神戸電鉄粟生線",
        "md": "shintetsu-ao.md",
        "ts": "mishiranu-shintetsu-ao-land-depth.ts",
        "export": "SHINTETSU_AO_LAND_DEPTH",
        "line": "shintetsu-ao",
        "ids": {
            "緑が丘": "midorigaoka-shintetsu",
            "広野ゴルフ場前": "hirono-golf",
            "志染": "shijimi",
        },
        "append_md": True,
        "override_existing": True,
    },
    "T7C": {
        "title": "神戸電鉄粟生線",
        "md": "shintetsu-ao.md",
        "ts": "mishiranu-shintetsu-ao-land-depth.ts",
        "export": "SHINTETSU_AO_LAND_DEPTH",
        "line": "shintetsu-ao",
        # JR市場・JR小野等と衝突しないよう *-shintetsu / 固有ID
        "ids": {
            "恵比須": "ebisu-shintetsu",
            "三木上の丸": "miki-uenomaru",
            "三木": "miki-shintetsu",
            "大村": "omura-shintetsu",
            "樫山": "kashiyama",
            "市場": "ichiba-shintetsu",
            "小野": "ono-shintetsu",
            "葉多": "hata-shintetsu",
            "粟生": "ao",
        },
        "append_md": True,
        "override_existing": True,
    },
    "T7D": {
        "title": "北条鉄道北条線",
        "md": "hojo.md",
        "ts": "mishiranu-hojo-land-depth.ts",
        "export": "HOJO_LAND_DEPTH",
        "line": "hojo",
        "ids": {
            "網引": "abiki",
            "田原": "tahara-hojo",
            "法華口": "hokkeguchi",
            "播磨下里": "harima-shimosato",
            "長": "osa",
            "播磨横田": "harima-yokota",
            "北条町": "hojomachi",
        },
    },
    "T8": {
        "title": "JR湖西線",
        "md": "jr-kosei.md",
        "ts": "mishiranu-jr-kosei-land-depth.ts",
        "export": "JR_KOSEI_LAND_DEPTH",
        "line": "jr-kosei",
        "ids": {
            "大津京": "otsukyo",
            "唐崎": "karasaki",
            "比叡山坂本": "hieizan-sakamoto",
            "おごと温泉": "ogoto-onsen",
            "堅田": "katata",
        },
    },
    "T9": {
        "title": "JR湖西線",
        "md": "jr-kosei.md",
        "ts": "mishiranu-jr-kosei-land-depth.ts",
        "export": "JR_KOSEI_LAND_DEPTH",
        "line": "jr-kosei",
        "ids": {
            "小野": "ono-kosei",
            "和邇": "wani",
            "蓬莱": "horai",
            "志賀": "shiga-kosei",
            "比良": "hira",
        },
        "append_md": True,
        "override_existing": True,
    },
    "T10": {
        "title": "JR湖西線",
        "md": "jr-kosei.md",
        "ts": "mishiranu-jr-kosei-land-depth.ts",
        "export": "JR_KOSEI_LAND_DEPTH",
        "line": "jr-kosei",
        "ids": {
            "近江舞子": "omi-maiko",
            "北小松": "kita-komatsu",
            "近江高島": "omi-takashima",
            "安曇川": "adogawa",
            "新旭": "shin-asahi",
            "近江中庄": "omi-nakasho",
            "マキノ": "makino",
            "永原": "nagahara",
            "近江塩津": "omi-shiotsu",
        },
        "append_md": True,
        "override_existing": True,
    },
    "T11": {
        "title": "山陽電鉄本線",
        "md": "sanyo-west.md",
        "ts": "mishiranu-sanyo-west-land-depth.ts",
        "export": "SANYO_WEST_LAND_DEPTH",
        "line": "sanyo-west",
        "ids": {
            "人丸前": "hitomarumae",
            "中八木": "naka-yagi",
            "富士見町": "fujimicho",
            "西新町": "nishi-shinmachi",
            "山陽姫路": "sanyo-himeji",
            "亀山": "kameyama-sanyo",
            "亀の井": "kamenoi",
            "飾磨": "shikama",
        },
    },
    "T12": {
        "title": "山陽電鉄本線",
        "md": "sanyo-west.md",
        "ts": "mishiranu-sanyo-west-land-depth.ts",
        "export": "SANYO_WEST_LAND_DEPTH",
        "line": "sanyo-west",
        "ids": {
            "西飾磨": "nishi-shikama",
            "夢前川": "yumesakigawa",
            "広畑": "hirohata",
            "山陽天満": "sanyo-temma",
            "平松": "hiramatsu",
            "山陽網干": "sanyo-aboshi",
        },
        "append_md": True,
        "override_existing": True,
    },
    "T13": {
        "title": "和歌山電鐵貴志川線",
        "md": "wakayama-kishigawa.md",
        "ts": "mishiranu-wakayama-kishigawa-land-depth.ts",
        "export": "WAKAYAMA_KISHIGAWA_LAND_DEPTH",
        "line": "wakayama-kishigawa",
        "ids": {
            "和歌山": "wakayama-dentetsu",
            "田中口": "tanakaguchi",
            "日前宮": "nichizengu",
            "神前": "kozaki",
            "竈山": "kamayama",
            "交通センター前": "kotsu-center-mae",
            "岡崎前": "okazakimae",
            "吉礼": "kire",
            "伊太祈曽": "idakiso",
            "山東": "sando",
            "大池遊園": "oike-yuen",
            "西貴志": "nishi-kishi",
            "貴志": "kishi",
        },
    },
}


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def parse_stations(text: str, ids: dict[str, str]) -> tuple[list[dict], dict[str, str]]:
    stations: list[dict] = []
    current = None
    section = None
    hist_title = None
    hist_buf: list[str] = []
    readings_all: dict[str, str] = {}

    def flush_hist() -> None:
        nonlocal hist_title, hist_buf
        if current is None or hist_title is None:
            hist_title = None
            hist_buf = []
            return
        body = "".join(hist_buf).strip()
        if hist_title and body:
            current["historyNotes"].append({"title": hist_title, "body": body})
        hist_title = None
        hist_buf = []

    lines = text.replace("\r\n", "\n").split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        if line in ids:
            nxt = lines[i + 1].strip() if i + 1 < len(lines) else ""
            if nxt == "stationIntro":
                flush_hist()
                if current:
                    stations.append(current)
                current = {
                    "name": line,
                    "id": ids[line],
                    "stationIntro": "",
                    "walkGuide": "",
                    "historyNotes": [],
                    "sightseeingNotes": [],
                    "readings": [],
                }
                section = None
                i += 1
                continue
        if line in (
            "stationIntro",
            "walkGuide",
            "historyNotes",
            "sightseeingNotes",
            "readings",
        ):
            flush_hist()
            section = line
            i += 1
            continue
        if current is None:
            i += 1
            continue
        if section in ("stationIntro", "walkGuide"):
            if line:
                current[section] += line
            i += 1
            continue
        if section == "historyNotes":
            if not line:
                i += 1
                continue
            if "。" not in line and hist_buf:
                flush_hist()
                hist_title = line
            elif hist_title is None:
                hist_title = line
            else:
                hist_buf.append(line)
            i += 1
            continue
        if section == "sightseeingNotes":
            m = re.match(r"^[⚬○]\s*(.+?):\s*(.+)$", line)
            if m:
                current["sightseeingNotes"].append(
                    {"title": m.group(1).strip(), "body": m.group(2).strip()}
                )
            i += 1
            continue
        if section == "readings":
            m = re.match(r"^(.+?):\s*(.+)$", line)
            if m:
                k, v = m.group(1).strip(), m.group(2).strip()
                current["readings"].append((k, v))
                readings_all[k] = v
            i += 1
            continue
        i += 1
    flush_hist()
    if current:
        stations.append(current)
    return stations, readings_all


def write_md(path: Path, pack_id: str, meta: dict, stations: list[dict], append: bool) -> None:
    header = [
        f"# {meta['title']} · 土地文ストック",
        "",
        f"> Gemini Neon（2026-11-22）。{pack_id}。運用B · spots遅延。",
        "",
    ]
    body: list[str] = []
    for s in stations:
        body += [
            f"### {s['name']}",
            "",
            "**stationIntro**",
            s["stationIntro"],
            "",
            "**walkGuide**",
            s["walkGuide"],
            "",
            "**historyNotes**",
        ]
        for h in s["historyNotes"]:
            body += [f"- **{h['title']}**", f"  {h['body']}"]
        body += ["", "**sightseeingNotes**"]
        for g in s["sightseeingNotes"]:
            body.append(f"- **{g['title']}:** {g['body']}")
        body += ["", "**readings**"]
        for k, v in s["readings"]:
            body.append(f"- {k}: {v}")
        body.append("")
    if append and path.exists():
        path.write_text(path.read_text(encoding="utf-8").rstrip() + "\n\n" + "\n".join(body), encoding="utf-8")
    else:
        path.write_text("\n".join(header + body), encoding="utf-8")


def station_ts_block(s: dict) -> str:
    parts = [f'  "{s["id"]}": {{\n']
    parts.append(f'    stationIntro: "{esc(s["stationIntro"])}",\n')
    parts.append("    areaAbout: undefined,\n")
    parts.append(f'    walkGuide: "{esc(s["walkGuide"])}",\n')
    parts.append("    historyNotes: [\n")
    for h in s["historyNotes"]:
        parts.append(
            f'      {{\n        title: "{esc(h["title"])}",\n        body: "{esc(h["body"])}",\n      }},\n'
        )
    parts.append("    ],\n    sightseeingNotes: [\n")
    for g in s["sightseeingNotes"]:
        parts.append(
            f'      {{\n        title: "{esc(g["title"])}",\n        body: "{esc(g["body"])}",\n      }},\n'
        )
    parts.append("    ],\n  },\n")
    return "".join(parts)


def write_or_merge_ts(path: Path, meta: dict, stations: list[dict], merge: bool) -> None:
    export = meta["export"]
    by_name = f"{export}_BY_NAME"
    type_name = "".join(p.capitalize() for p in meta["line"].replace("-", "_").split("_")) + "LandDepth"
    # simpler type name from export
    type_name = export.replace("_LAND_DEPTH", "") + "_LandDepth"
    type_name = "".join(x.capitalize() for x in export.lower().split("_")) 

    if merge and path.exists():
        text = path.read_text(encoding="utf-8")
        # insert station blocks before closing of DEPTH object
        marker = f"export const {export}"
        if marker not in text:
            raise SystemExit(f"{export} not in {path}")
        # find BY_NAME start to insert before end of DEPTH
        m = re.search(
            rf"export const {export}: Record<string, [^=]+> = \{{",
            text,
        )
        if not m:
            raise SystemExit("DEPTH object not found")
        # find matching close before BY_NAME
        by = text.find(f"export const {by_name}")
        if by < 0:
            raise SystemExit("BY_NAME not found")
        # last `};` before BY_NAME
        close = text.rfind("};", 0, by)
        blocks = "".join(station_ts_block(s) for s in stations)
        text = text[:close] + blocks + text[close:]
        # merge BY_NAME entries
        by_m = re.search(
            rf"export const {by_name}: Record<string, string> = \{{([\s\S]*?)\n\}};",
            text,
        )
        if not by_m:
            raise SystemExit("BY_NAME block parse fail")
        extra = "".join(
            f'  "{s["name"]}": "{s["id"]}",\n  "{meta["title"][:2]}{s["name"]}": "{s["id"]}",\n'
            for s in stations
        )
        # simpler unique keys
        extra = ""
        for s in stations:
            extra += f'  "{s["name"]}": "{s["id"]}",\n'
        text = (
            text[: by_m.start(1)]
            + by_m.group(1)
            + ("\n" if not by_m.group(1).endswith("\n") else "")
            + extra
            + text[by_m.end(1) :]
        )
        path.write_text(text, encoding="utf-8")
        return

    # fresh file
    type_name = meta["export"].title().replace("_", "") + "Entry"
    parts = [
        'import type { AreaHistoryNote } from "@/data/mishiranu-stations";\n\n',
        f'/** docs/land-stock/{meta["md"]} と同型。 */\n',
        "export type Wave2LandDepth = {\n",
        "  stationIntro?: string;\n  areaAbout?: string;\n  walkGuide?: string;\n",
        "  historyNotes?: AreaHistoryNote[];\n  sightseeingNotes?: AreaHistoryNote[];\n  storyNotes?: AreaHistoryNote[];\n};\n\n",
        f'/** {meta["title"]} · Neon Wave2。 */\n',
        f"export const {export}: Record<string, Wave2LandDepth> = {{\n",
    ]
    for s in stations:
        parts.append(station_ts_block(s))
    parts.append("};\n\n")
    parts.append(f"export const {by_name}: Record<string, string> = {{\n")
    for s in stations:
        parts.append(f'  "{s["name"]}": "{s["id"]}",\n')
    parts.append("};\n")
    path.write_text("".join(parts), encoding="utf-8")


def ensure_area_wiring(meta: dict) -> None:
    export = meta["export"]
    by_name = f"{export}_BY_NAME"
    mod = meta["ts"].replace(".ts", "")
    text = AREA.read_text(encoding="utf-8")
    import_line = (
        f'import {{\n  {export},\n  {by_name},\n}} from "@/lib/{mod}";\n'
    )
    if export not in text:
        # insert after last land-depth import block near HANSHIN_MUKOGAWA or end of imports
        anchor = 'from "@/lib/mishiranu-hanshin-mukogawa-land-depth";\n'
        if anchor in text:
            text = text.replace(anchor, anchor + import_line)
        else:
            raise SystemExit("import anchor missing")
        # spread after HANSHIN_MUKOGAWA
        text = text.replace(
            "...HANSHIN_MUKOGAWA_LAND_DEPTH,\n",
            f"...HANSHIN_MUKOGAWA_LAND_DEPTH,\n  ...{export},\n",
        )
        text = text.replace(
            "...HANSHIN_MUKOGAWA_LAND_DEPTH_BY_NAME,\n",
            f"...HANSHIN_MUKOGAWA_LAND_DEPTH_BY_NAME,\n  ...{by_name},\n",
        )
        # line union type
        line = meta["line"]
        if f'| "{line}"' not in text:
            text = text.replace(
                '| "hanshin-mukogawa"',
                f'| "hanshin-mukogawa"\n    | "{line}"',
            )
        AREA.write_text(text, encoding="utf-8")

    # batch spots Line type
    bt = BATCH_SPOTS.read_text(encoding="utf-8")
    line = meta["line"]
    if f'| "{line}"' not in bt:
        bt = bt.replace(
            '| "hanshin-mukogawa"',
            f'| "hanshin-mukogawa"\n  | "{line}"',
        )
        BATCH_SPOTS.write_text(bt, encoding="utf-8")

    # LAND_STOCK_SPOT_BATCH entries
    text = AREA.read_text(encoding="utf-8")
    marker = f'{{ line: "{line}", name:'
    if marker not in text:
        names = list(meta["ids"].keys())
        block = "".join(f'  {{ line: "{line}", name: "{n}" }},\n' for n in names)
        # before closing of array `];` of LAND_STOCK_SPOT_BATCH - find last monorail entries end
        insert_at = text.rfind('{ line: "osaka-monorail"')
        if insert_at < 0:
            raise SystemExit("batch insert point missing")
        # find end of monorail section - after last monorail line before `];`
        close = text.find("];", insert_at)
        text = text[:close] + block + text[close:]
        AREA.write_text(text, encoding="utf-8")


def mark_done(pack_id: str, n: int) -> None:
    for path in (MASS, WAVE2):
        if not path.exists():
            continue
        t = path.read_text(encoding="utf-8")
        t2 = re.sub(
            rf"(\| {pack_id} \|[^|]+\| )\d+( \|)",
            rf"\1**取込済{n}**\2",
            t,
            count=1,
        )
        t2 = re.sub(
            rf"(\| {pack_id} \|[^|]+\| )\*\*取込済\d+\*\*( \|)",
            rf"\1**取込済{n}**\2",
            t2,
            count=1,
        )
        path.write_text(t2, encoding="utf-8")
    note = f"- **2026-11-22 {pack_id} Neon取込:** {n}駅。運用B · spots未実行\n"
    if README.exists() and f"{pack_id} Neon取込" not in README.read_text(encoding="utf-8"):
        README.write_text(README.read_text(encoding="utf-8").rstrip() + "\n" + note, encoding="utf-8")


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    pack_id = sys.argv[1].upper()
    if pack_id not in PACKS:
        raise SystemExit(f"unknown pack {pack_id}. known: {', '.join(PACKS)}")
    meta = PACKS[pack_id]
    if "--stdin" in sys.argv or (len(sys.argv) >= 3 and sys.argv[2] == "--stdin"):
        text = sys.stdin.read()
    elif len(sys.argv) >= 3:
        text = Path(sys.argv[2]).read_text(encoding="utf-8")
    else:
        raise SystemExit("need raw file or --stdin")

    stations, readings = parse_stations(text, meta["ids"])
    expected = list(meta["ids"].keys())
    got = [s["name"] for s in stations]
    if got != expected:
        # allow subset only if all got are expected and order preserved
        if not got or any(g not in expected for g in got):
            raise SystemExit(f"station mismatch.\n expected {expected}\n got {got}")
        print(f"warn: partial stations {got} (expected {len(expected)})")

    for s in stations:
        if len(s["historyNotes"]) != 3:
            raise SystemExit(f"{s['name']}: history {len(s['historyNotes'])} != 3")
        if not s["sightseeingNotes"]:
            raise SystemExit(f"{s['name']}: no sightseeing")

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    READINGS_RAW.mkdir(parents=True, exist_ok=True)
    (RAW_DIR / f"{pack_id}-neon.txt").write_text(text, encoding="utf-8")
    (READINGS_RAW / f"{pack_id}.tsv").write_text(
        "".join(f"{k}\t{v}\n" for k, v in sorted(readings.items(), key=lambda x: (-len(x[0]), x[0]))),
        encoding="utf-8",
    )

    md_path = LAND / meta["md"]
    ts_path = LIB / meta["ts"]
    merge = bool(meta.get("override_existing")) and ts_path.exists()
    append_md = bool(meta.get("append_md")) and md_path.exists()
    write_md(md_path, pack_id, meta, stations, append=append_md)
    write_or_merge_ts(ts_path, meta, stations, merge=merge)
    ensure_area_wiring(meta)
    mark_done(pack_id, len(stations))

    subprocess.run(
        ["npm", "run", "land:readings:merge", "--", str(READINGS_RAW / f"{pack_id}.tsv")],
        cwd=ROOT,
        check=False,
    )
    print(f"OK {pack_id}: {got}")
    print(f"md {md_path}")
    print(f"ts {ts_path}")
    print("next: npm run build  （spots しない）")


if __name__ == "__main__":
    main()
