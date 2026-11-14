/**
 * 初めて駅を降りた人が通る「メジャーな普通のところ」だけを残す。
 * 近所の無名な寺・小社は、社寺というだけで顔にしない。
 */

const FAME_TOKENS = [
  "大社",
  "神宮",
  "八幡",
  "天満宮",
  "東照宮",
  "稲荷大社",
  "別雷",
  "御祖",
  "春日",
  "明治神宮",
  "平安神宮",
  "熱田",
  "住吉大社",
  "太宰府",
  "鶴岡",
  "浅草寺",
  "清水寺",
  "金閣",
  "銀閣",
  "東大寺",
  "興福寺",
  "法隆寺",
  "中尊寺",
  "平等院",
  "厳島",
  "出雲大社",
  "善光寺",
  "永平寺",
  "金剛峯",
  "総本山",
  "大本山",
  "国宝",
  "世界遺産",
  "飛行神社",
  "石清水",
  "下鴨",
  "上賀茂",
  "賀茂",
];

const ORDINARY_FACE_RE =
  /デルタ|三角州|合流|河原|河川敷|商店街|市場|朝市|港|桟橋|灯台|城|城跡|公園|橋|並木|参道/;

export function bareStationName(name: string): string {
  return name.replace(/駅$/, "").trim();
}

export function isWorshipName(name: string): boolean {
  if (/茶屋|茶房|食堂|本店$|店$/.test(name)) return false;
  return /寺$|神社$|神宮$|大社$|寺院$|神社/.test(name);
}

function stationNameCores(bare: string): string[] {
  const cores = [bare];
  const prefixes = ["元", "新", "旧", "本", "上", "下", "東", "西", "南", "北"];
  const first = bare.slice(0, 1);
  if (prefixes.includes(first)) {
    const rest = bare.slice(1);
    if (rest.length >= 2) cores.push(rest);
  }
  return cores;
}

export function isGuidebookWorship(
  name: string,
  stationName?: string,
): boolean {
  if (!isWorshipName(name)) return false;
  if (FAME_TOKENS.some((t) => name.includes(t))) return true;
  if (stationName) {
    const bare = bareStationName(stationName);
    if (bare.length >= 2 && name.includes(bare)) return true;
    // 元田中 → 田中神社 のように、接頭を外した核が社寺名に入る
    if (
      stationNameCores(bare).some(
        (core) => core.length >= 2 && name.includes(core),
      )
    ) {
      return true;
    }
  }
  return false;
}

export function isNeighborhoodWorship(
  name: string,
  stationName?: string,
): boolean {
  if (!isWorshipName(name)) return false;
  return !isGuidebookWorship(name, stationName);
}

export function isOrdinaryPublicFace(name: string): boolean {
  return ORDINARY_FACE_RE.test(name);
}

/** 楼門・参拝記念など、社寺の付属ピン。 */
export function isWorshipSatellite(name: string): boolean {
  return /楼門|神門|南門|東門|西門|北門|表門|参拝記念|手水|摂社|末社|授与所|社務所|絵馬殿|境内図|御朱印|お守り/.test(
    name,
  );
}

/** 「参拝記念 下鴨神社」「下鴨神社 楼門」→ 核は「下鴨神社」。 */
export function worshipCoreName(name: string): string | null {
  const re =
    /([一-龥々ぁ-んァ-ヶーA-Za-z0-9]{2,14}(?:神社|神宮|大社|寺院|寺))/g;
  let match: RegExpExecArray | null;
  let last: string | null = null;
  while ((match = re.exec(name)) != null) {
    last = match[1] ?? null;
  }
  if (!last) return null;
  if (name.includes("下鴨") && last.includes("賀茂御祖")) return "下鴨神社";
  return last;
}

function worshipPickScore(
  spot: { name: string; majorWorthy?: boolean },
  core: string,
): number {
  let score = 0;
  if (spot.name === core || spot.name.startsWith(core)) score += 40;
  if (spot.name.includes("賀茂御祖") || spot.name.includes("（")) score += 20;
  if (spot.majorWorthy) score += 15;
  if (isWorshipSatellite(spot.name)) score -= 50;
  score += Math.max(0, 20 - spot.name.length);
  return score;
}

/** 「同志社大学 今出川キャンパス」→「同志社大学」。 */
export function universityCoreName(name: string): string | null {
  if (!name.includes("大学")) return null;
  const m = name.match(/([一-龥々ぁ-んァ-ヶーA-Za-z0-9]{2,16}大学)/u);
  return m?.[1] ?? null;
}

function universityPickScore(
  spot: { name: string; majorWorthy?: boolean },
  core: string,
): number {
  let score = 0;
  if (spot.name === core) score += 50;
  if (spot.majorWorthy) score += 15;
  if (spot.name.includes("キャンパス")) score -= 20;
  score += Math.max(0, 24 - spot.name.length);
  return score;
}

/** 正本の「○○大学」と Apple の「○○大学 ○○キャンパス」を1件に。 */
export function collapseUniversityDuplicates<
  T extends { name: string; majorWorthy?: boolean },
>(spots: T[]): T[] {
  const groups = new Map<string, T[]>();
  const passthrough: T[] = [];
  for (const spot of spots) {
    const core = universityCoreName(spot.name);
    if (!core) {
      passthrough.push(spot);
      continue;
    }
    const isCampusVariant =
      spot.name !== core &&
      (spot.name.includes("キャンパス") || spot.name.includes(core));
    if (spot.name === core || isCampusVariant) {
      const list = groups.get(core) ?? [];
      list.push(spot);
      groups.set(core, list);
    } else {
      passthrough.push(spot);
    }
  }
  const collapsed: T[] = [];
  for (const [core, members] of groups) {
    const ranked = [...members].sort((a, b) => {
      const d = universityPickScore(b, core) - universityPickScore(a, core);
      if (d !== 0) return d;
      return a.name.length - b.name.length;
    });
    let best = ranked[0]!;
    if (best.name !== core) best = { ...best, name: core };
    collapsed.push(best);
  }
  return [...passthrough, ...collapsed];
}

/** 同じ社の楼門・記念所などを1件に畳む。大学キャンパス付きも畳む。 */
export function collapseWorshipDuplicates<
  T extends { name: string; majorWorthy?: boolean },
>(spots: T[]): T[] {
  const groups = new Map<string, T[]>();
  const passthrough: T[] = [];
  for (const spot of spots) {
    const core =
      isWorshipName(spot.name) || isWorshipSatellite(spot.name)
        ? worshipCoreName(spot.name)
        : null;
    if (!core) {
      passthrough.push(spot);
      continue;
    }
    const list = groups.get(core) ?? [];
    list.push(spot);
    groups.set(core, list);
  }
  const collapsed: T[] = [];
  for (const [core, members] of groups) {
    const ranked = [...members].sort((a, b) => {
      const d = worshipPickScore(b, core) - worshipPickScore(a, core);
      if (d !== 0) return d;
      return a.name.length - b.name.length;
    });
    let best = ranked[0]!;
    if (isWorshipSatellite(best.name) || best.name !== core) {
      best = { ...best, name: core.includes("下鴨") ? "下鴨神社" : core };
    }
    collapsed.push(best);
  }
  return collapseUniversityDuplicates([...passthrough, ...collapsed]);
}

export function filterFirstVisitSpots<T extends { name: string; majorWorthy?: boolean }>(
  spots: T[],
  stationName: string,
): T[] {
  return collapseWorshipDuplicates(
    spots.filter((s) => !isNeighborhoodWorship(s.name, stationName)),
  );
}
