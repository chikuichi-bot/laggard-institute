import landPresentAnchors from "@/data/land-present-anchors.json";
import type {
  AreaHistoryNote,
  GuideKind,
  Spot,
  SpotGenre,
  StationSeed,
} from "@/data/mishiranu-stations";
import { isForeignDemachiPlace } from "@/lib/mishiranu-demachi-template";
import { landCorpus } from "@/lib/mishiranu-lore";
import { refineLandProse } from "@/lib/mishiranu-land-prose";

/**
 * 土地の顔アンカー。
 * 具体名は必ず残すが、文章の詳説は historyNotes に一度だけ。
 */
export type LandPresentAnchor = {
  name: string;
  kind: string;
  where: string;
  why?: string;
  present: string;
  aliases?: string[];
  mustVisit?: boolean;
  guide?: GuideKind;
  walkMinutes?: number;
  lat?: number;
  lng?: number;
};

type AnchorStation = {
  station: string;
  anchors: LandPresentAnchor[];
};

function bareStationName(name: string): string {
  return name.replace(/駅$/u, "").trim();
}

function anchorKeys(anchor: LandPresentAnchor): string[] {
  return [anchor.name, ...(anchor.aliases ?? [])].filter(Boolean);
}

function corpusHasAnchor(corpus: string, anchor: LandPresentAnchor): boolean {
  return anchorKeys(anchor).some((k) => corpus.includes(k));
}

function stationRowMatch(stationName: string, rowStation: string): boolean {
  const bare = bareStationName(stationName);
  const key = bareStationName(rowStation);
  if (!bare || !key) return false;
  if (bare === key) return true;
  // 「京阪出町柳」など接頭語付き。短いキーでの誤爆を防ぐ（3文字以上）。
  if (key.length >= 3 && bare.includes(key)) return true;
  if (bare.length >= 3 && key.includes(bare)) return true;
  return false;
}

export function landAnchorsFor(stationName: string): LandPresentAnchor[] {
  const row = (landPresentAnchors.stations as AnchorStation[]).find((s) =>
    stationRowMatch(stationName, s.station),
  );
  return row?.anchors ?? [];
}

export function isMustVisitLandFace(
  spotName: string,
  stationName: string,
): boolean {
  return landAnchorsFor(stationName).some(
    (a) =>
      a.mustVisit === true &&
      anchorKeys(a).some((k) => spotName.includes(k) || k.includes(spotName)),
  );
}

export function prioritizeMustVisitSpots(
  spots: Spot[],
  stationName: string,
): Spot[] {
  const must: Spot[] = [];
  const rest: Spot[] = [];
  for (const spot of spots) {
    if (isMustVisitLandFace(spot.name, stationName)) must.push(spot);
    else rest.push(spot);
  }
  return [...must, ...rest];
}

/** AI プロンプト用。具体名＋仕訳。 */
export function landAnchorPromptBlock(stationName: string): string {
  const anchors = landAnchorsFor(stationName);
  const role = [
    "同じ説明をセクション間で繰り返さない。詳説は historyNotes のみ。",
    "walkGuide は順番と方角だけ。stationIntro は路線と駅前だけ。",
    "ショートの正本は出町柳雛形の役割（landform・landmark・town）。揃う役割だけでよい（1〜3件）。",
  ].join(" ");
  if (!anchors.length) {
    return [
      role,
      "この駅の正本アンカーは未収録。出町柳雛形で firstVisitFaces を実在する役割だけ組み立てる（必ず3件そろえなくてよい）。",
      "町場・店が無ければ town を出さず、川・用水・坂・田畑の道・橋・神社・公園で歩く駅として書く。",
      "例の対応（出町だけ）: landform←鴨川デルタ、landmark←下鴨神社、town←枡形商店街。各駅で実在の正式名に置き換える。",
      "精度は出町並み: walkGuide は出口→通る順→方角。sightseeing は『正式名です。行き方。着いたら』。定番食べ方が分かれば walkGuide に1文。",
      "sightseeingNotes は顔のあとに実用メモ。店が無い駅は食べるメモを無理に増やさない。",
    ].join("\n");
  }
  const lines = anchors.map((a) => {
    const visit = a.mustVisit ? "【駅から寄る顔＝小回り雛形】" : "";
    const why = a.why ? `理由: ${a.why}` : "";
    return `- ${visit}${a.name}（${a.where}）… ${why} ${a.present}`.trim();
  });
  return [
    `【必須・土地の顔】この駅（${bareStationName(stationName)}）では次の正式名称を使う。`,
    ...lines,
    role,
    "名前の出し方: walkGuide か areaAbout に名前を一度。詳しい why/present は historyNotes に各1件だけ。sightseeingNotes は mustVisit／firstVisitFaces を先頭にし、実用メモを足す。",
  ].join("\n");
}

function noteTitle(anchor: LandPresentAnchor): string {
  if (anchor.kind === "university") return `${anchor.name}のいま`;
  if (anchor.kind === "arcade") return `${anchor.name}と土地の顔`;
  if (anchor.kind === "road") return `${anchor.name}のこと`;
  return anchor.name;
}

function noteForAnchor(anchor: LandPresentAnchor): AreaHistoryNote {
  return {
    title: noteTitle(anchor),
    body: [
      `${anchor.name}は${anchor.where}にあります。`,
      anchor.why ?? "",
      anchor.present,
    ]
      .filter(Boolean)
      .join(""),
  };
}

function genreFor(anchor: LandPresentAnchor): SpotGenre {
  if (anchor.kind === "nature") return "nature";
  if (anchor.kind === "university" || anchor.kind === "arcade") return "history";
  return "odd";
}

function makeAnchorSpot(anchor: LandPresentAnchor, station: StationSeed): Spot {
  const guide = (anchor.guide ?? "sight") as GuideKind;
  return {
    id: `anchor-${anchor.name.replace(/\s+/g, "").slice(0, 28)}`,
    name: anchor.name,
    genre: genreFor(anchor),
    guide,
    mealTier: "casual",
    mealTimes: [],
    soloOk: true,
    budgetYen: "—",
    hours: "終日（屋外）",
    blurb: [anchor.why, anchor.present].filter(Boolean).join(" "),
    detail: anchor.where,
    walkMinutes: anchor.walkMinutes ?? 8,
    x: 0.48,
    y: 0.42,
    majorWorthy: anchor.mustVisit === true,
    secretWorthy: false,
    ...(anchor.lat != null && anchor.lng != null
      ? { lat: anchor.lat, lng: anchor.lng }
      : anchor.kind === "university"
        ? {}
        : station.lat != null && station.lng != null
          ? { lat: station.lat + 0.00012, lng: station.lng - 0.00015 }
          : {}),
  };
}

function spotMentionsAnchor(spotName: string, anchor: LandPresentAnchor): boolean {
  return anchorKeys(anchor).some(
    (k) => spotName.includes(k) || k.includes(spotName),
  );
}

export function ensureLandAnchorSpots(station: StationSeed): StationSeed {
  const anchors = landAnchorsFor(station.name);
  // mustVisit は必ずスポット化。大学など座標付きも正本で上書きする。
  const visit = anchors.filter(
    (a) =>
      a.mustVisit === true ||
      (a.kind === "university" && a.lat != null && a.lng != null),
  );
  if (!visit.length) return station;

  const spots = [...(station.spots ?? [])];
  for (const anchor of visit) {
    const idx = spots.findIndex((s) => spotMentionsAnchor(s.name, anchor));
    if (idx >= 0) {
      const cur = spots[idx]!;
      spots[idx] = {
        ...cur,
        name: cur.name.includes(anchor.name) ? cur.name : anchor.name,
        majorWorthy: anchor.mustVisit === true ? true : cur.majorWorthy,
        guide: cur.guide ?? anchor.guide ?? "sight",
        // 正本座標があれば上書き（駅・デルタ寄せの誤ピンを残さない）
        lat: anchor.lat ?? cur.lat,
        lng: anchor.lng ?? cur.lng,
        walkMinutes:
          anchor.walkMinutes != null
            ? anchor.walkMinutes
            : cur.walkMinutes,
      };
      continue;
    }
    spots.push(makeAnchorSpot(anchor, station));
  }
  return { ...station, spots };
}

function noteMentionsAnchor(
  note: AreaHistoryNote,
  anchor: LandPresentAnchor,
): boolean {
  const blob = `${note.title}${note.body}`;
  return anchorKeys(anchor).some((k) => k.length >= 2 && blob.includes(k));
}

function sightseeingTitle(anchor: LandPresentAnchor): string {
  if (anchor.name === "下鴨神社") return "下鴨神社と糺の森";
  if (anchor.name === "鴨川デルタ") return "鴨川デルタ";
  if (anchor.name === "枡形商店街") return "枡形商店街";
  return anchor.name;
}

function sightseeingBody(anchor: LandPresentAnchor): string {
  // 初めての人向け: 正式名 → 行き方 → 着いたら何があるか（由来は historyNotes）
  return [`${anchor.name}です。`, anchor.where, "。", anchor.present]
    .filter(Boolean)
    .join("");
}

function isWrongMasugataGateCopy(text: string): boolean {
  if (!text.includes("枡形") && !text.includes("桝形")) return false;
  if (
    text.includes("京阪改札のすぐ外") ||
    text.includes("改札のすぐ外") ||
    text.includes("改札近く") ||
    /京阪[^。]{0,12}すぐ/.test(text) ||
    text.includes("駅前の短いアーケード") ||
    /動線のすぐ外に[、,]?枡形/.test(text)
  ) {
    return true;
  }
  // 「枡形商店街です」なのに5番・出町橋が無い＝改札すぐと誤認した旧文
  if (/枡形商店街です/.test(text) && !/5番|出町橋/.test(text)) {
    return true;
  }
  return false;
}

/** 保存済みの誤案内（京阪改札すぐ＝枡形）を正本の行き方に直す。 */
export function scrubWrongMasugataGateCopy(
  station: StationSeed,
): StationSeed {
  const notes = station.sightseeingNotes ?? [];
  if (!notes.length) return station;
  const masugata = landAnchorsFor(station.name).find(
    (a) => a.name === "枡形商店街",
  );
  if (!masugata) return station;
  let changed = false;
  const next = notes.map((n) => {
    if (isWrongMasugataGateCopy(`${n.title}${n.body}`)) {
      changed = true;
      return {
        title: "枡形商店街",
        body: sightseeingBody(masugata),
      };
    }
    return n;
  });
  return changed ? { ...station, sightseeingNotes: next } : station;
}

/**
 * 観光案内メモ＝出町柳雛形の3点（JSON mustVisit または AI firstVisitFaces）。
 * 旧三井家など雛形外は落とす。
 */
export function ensureSightseeingFromMustVisits(
  station: StationSeed,
): StationSeed {
  const must = landAnchorsFor(station.name).filter((a) => a.mustVisit === true);
  if (must.length >= 2) {
    const existing = station.sightseeingNotes ?? [];
    const core = must.map((anchor) => {
      const hit = existing.find((n) => noteMentionsAnchor(n, anchor));
      const raw = (hit?.body ?? "").trim();
      const body =
        raw && !isWrongMasugataGateCopy(`${hit?.title ?? ""}${raw}`)
          ? raw
          : sightseeingBody(anchor);
      return {
        title: sightseeingTitle(anchor),
        body,
      };
    });
    const extras = existing.filter(
      (n) =>
        !isForeignDemachiPlace(n.title, station.name) &&
        !must.some((a) => noteMentionsAnchor(n, a)) &&
        !isWrongMasugataGateCopy(`${n.title}${n.body}`),
    );
    return {
      ...station,
      sightseeingNotes: [...core, ...extras].slice(0, 7),
    };
  }

  const faces = (station.firstVisitFaces ?? []).filter(
    (face) => !isForeignDemachiPlace(face.name, station.name),
  );
  if (faces.length < 2) return station;
  const existing = station.sightseeingNotes ?? [];
  const core = faces.map((face) => {
    const hit = existing.find(
      (n) => n.title.includes(face.name) || n.body.includes(face.name),
    );
    return {
      title: face.name === "下鴨神社" ? "下鴨神社と糺の森" : face.name,
      body:
        (hit?.body ?? "").trim() ||
        [face.why, face.present].filter(Boolean).join("") ||
        `${face.name}。この駅の土地の顔。`,
    };
  });
  const extras = existing.filter(
    (n) =>
      !isForeignDemachiPlace(n.title, station.name) &&
      !faces.some(
        (f) => n.title.includes(f.name) || f.name.includes(n.title),
      ),
  );
  return {
    ...station,
    sightseeingNotes: [...core, ...extras].slice(0, 7),
  };
}

/**
 * 具体名が土地全体に無ければ historyNotes に一度だけ足す。
 * すでに名前があるセクションへ、同じ説明を重ね書きしない。
 * 観光案内は mustVisit 雛形に揃える。
 */
export function ensureLandPresentAnchors(station: StationSeed): StationSeed {
  station = scrubWrongMasugataGateCopy(station);
  const anchors = landAnchorsFor(station.name);
  if (!anchors.length) {
    return refineLandProse(ensureLandAnchorSpots(station));
  }

  const corpus = landCorpus(station);
  let walkGuide = station.walkGuide ?? "";
  const notes = [...(station.historyNotes ?? [])];

  for (const anchor of anchors) {
    const namedAnywhere = corpusHasAnchor(corpus, anchor);
    const inNotes = notes.some(
      (n) => n.title.includes(anchor.name) || n.body.includes(anchor.name),
    );

    // 詳説はメモに一度だけ
    if (!inNotes && (anchor.kind !== "road" || !namedAnywhere)) {
      // 鯖街道は枡形メモに含め済みなら個別追加しない
      if (
        anchor.kind === "road" &&
        notes.some((n) => n.body.includes("鯖街道") || n.title.includes("鯖街道"))
      ) {
        continue;
      }
      if (
        anchor.name === "枡形商店街" &&
        notes.some((n) => /枡形/.test(n.title) || /枡形/.test(n.body))
      ) {
        continue;
      }
      notes.push(noteForAnchor(anchor));
    }

    // mustVisit で土地全体に名前が無いときだけ、歩き方に短い経由を足す
    if (
      anchor.mustVisit &&
      !namedAnywhere &&
      !walkGuide.includes(anchor.name)
    ) {
      const line = `駅を出たら${anchor.name}へ寄ります。`;
      walkGuide = walkGuide.trim() ? `${walkGuide.trim()}${line}` : line;
    }
  }

  const withProse: StationSeed = ensureSightseeingFromMustVisits({
    ...station,
    walkGuide: walkGuide || station.walkGuide,
    historyNotes: notes,
  });
  return refineLandProse(ensureLandAnchorSpots(withProse));
}
