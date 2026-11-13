export type SpotGenre = "history" | "gourmet" | "nature" | "odd";

/** 観光案内マップ用の見出し（物語＝撮影地・文学のゆかり） */
export type GuideKind = "meal" | "souvenir" | "sight" | "rest" | "tip" | "story";

/** ご飯の価格帯 */
export type MealTier = "casual" | "upscale";

/** ご飯の時間帯（複数可） */
export type MealTime = "morning" | "lunch" | "dinner";

export type Spot = {
  id: string;
  name: string;
  genre: SpotGenre;
  /** 観光案内の分類。未指定なら genre から推定 */
  guide?: GuideKind;
  /** ご飯向け: 庶民的 / 高級（guide=meal のとき） */
  mealTier?: MealTier;
  /** ご飯向け: 朝 / 昼 / 夜（guide=meal のとき） */
  mealTimes?: MealTime[];
  /** ご飯向け: 一人で入りやすいか（guide=meal） */
  soloOk?: boolean;
  /** ご飯向け: 予算の目安表示（例: 〜¥1,500） */
  budgetYen?: string;
  /**
   * 営業・開館・見学できる時間（わかるものだけ）。
   * 例: "8:30〜17:30（水曜定休）" / "終日（屋外）"
   */
  hours?: string;
  blurb: string;
  /** 詳細メモ（観光案内パネル向け・任意） */
  detail?: string;
  /** 0–1 relative map position */
  x: number;
  y: number;
  walkMinutes: number;
  secretWorthy?: boolean;
  /**
   * 散歩中心などで先に出す「その駅の顔」になる定番。
   * 各駅ちょうど5件を目安（名所・景色と名物店の合計）。
   */
  majorWorthy?: boolean;
  /** Optional WGS84 (AI / precise pins) */
  lat?: number;
  lng?: number;
  /**
   * 地図ピンの信頼度。lock / apple のみ地図に出す。
   * 未指定・unverified は案内文には出せるが地図禁止。
   */
  coordTrust?: "lock" | "apple" | "unverified";
};

export type StationMood = "story" | "empty";

export type AreaHistoryNote = {
  title: string;
  body: string;
};

/** local = 店頭の地元レンタ / app = アプリ登録のシェアサイクル */
export type BikeRentalKind = "local" | "app";

export type BikeRentalPlace = {
  name: string;
  kind: BikeRentalKind;
  note?: string;
  walkMinutes?: number;
};

/** 駅周辺のレンタサイクル（案内に必ず出す） */
export type BikeRentalInfo = {
  available: boolean;
  summary: string;
  places?: BikeRentalPlace[];
};

export function bikeRentalKindOf(place: BikeRentalPlace): BikeRentalKind {
  return place.kind;
}

export function bikePlacesByKind(
  places: BikeRentalPlace[] | undefined,
  kind: BikeRentalKind,
): BikeRentalPlace[] {
  return (places ?? []).filter((p) => bikeRentalKindOf(p) === kind);
}

export const BIKE_RENTAL_UNKNOWN: BikeRentalInfo = {
  available: false,
  summary:
    "この駅で確認できたレンタサイクルは、いまのところありません。観光案内所や駅掲示も見てください。",
};

export type StationSeed = {
  id: string;
  name: string;
  /** 駅名のひらがな読み（無いときは STATION_NAME_READINGS を参照） */
  nameReading?: string;
  line: string;
  prefecture: string;
  region: "北海道" | "東北" | "関東" | "中部" | "近畿" | "中国" | "四国" | "九州";
  mood: StationMood;
  /** radius km for 1h / 3h / half-day */
  radiiKm: [number, number, number];
  /** 駅の簡単な説明（観光案内） */
  stationIntro?: string;
  /** エリアのいまの様子（複数段落は空行区切り） */
  areaAbout?: string;
  /** 徒歩圏の歩き方・回り方 */
  walkGuide?: string;
  /** 土地メモ（歴史といまの姿） */
  historyNotes?: AreaHistoryNote[];
  /** 観光の見どころメモ（案内向け） */
  sightseeingNotes?: AreaHistoryNote[];
  /** ドラマ・映画・小説などの撮影地／舞台（徒歩圏・確かなものだけ） */
  storyNotes?: AreaHistoryNote[];
  /** レンタサイクルの有無（未設定時は未確認として表示） */
  bikeRental?: BikeRentalInfo;
  tourTitle: string;
  catchCopy: string;
  emptyCopy?: {
    headline: string;
    body: string;
  };
  /**
   * 運行の目安（任意・確信があるときだけ）。
   * 例: 「ローカル線・帰る前に時刻表を確認」
   */
  railHint?: string;
  spots: Spot[];
  /** Optional WGS84 station center (AI stations) */
  lat?: number;
  lng?: number;
  /** seed = 編集データ / ai = Gemini 生成 */
  source?: "seed" | "ai";
  /**
   * 出町柳雛形のショート3点（地形・名所・町場）。
   * 初めて駅に降りた人へ勧めるルート。観光案内・歩くショートの正本。
   */
  firstVisitFaces?: Array<{
    role: "landform" | "landmark" | "town";
    name: string;
    where?: string;
    why?: string;
    present?: string;
    walkMinutes?: number;
    lat?: number;
    lng?: number;
  }>;
  /**
   * 空気の道（点ではなく通る区間）。AI／正本。
   * 無い駅はクライアントが名もなき微地形フォールバックを足す。
   */
  corridors?: Array<{
    id: string;
    name: string;
    kind: string;
    blurb: string;
    path: Array<{ lat: number; lng: number }>;
    relatedSpotNames: string[];
    walkMinutes: number;
  }>;
};

export function bikeRentalFor(station: StationSeed): BikeRentalInfo {
  const raw = station.bikeRental;
  if (!raw) return BIKE_RENTAL_UNKNOWN;
  const places = (raw.places ?? []).filter((p) => {
    if (!p.name) return false;
    if (
      /^(駅前のレンタ|周辺のレンタ|レンタサイクル店|貸自転車|シェアサイクル|レンタサイクル)$/.test(
        p.name,
      )
    ) {
      return false;
    }
    if (typeof p.walkMinutes === "number" && p.walkMinutes > 8) return false;
    if (!/出町柳/.test(station.name) && /出町柳|京阪出町柳/.test(p.name)) {
      return false;
    }
    return true;
  });
  if (places.length === 0) {
    return {
      available: false,
      summary:
        "この駅で確認できたレンタサイクルは、いまのところありません。観光案内所や駅掲示も見てください。",
    };
  }
  return {
    available: true,
    summary: raw.summary,
    places,
  };
}

export const GENRE_LABEL: Record<SpotGenre, string> = {
  history: "歴史・文化",
  gourmet: "ローカルグルメ",
  nature: "自然・公園",
  odd: "ちょっと変わった",
};

export const GUIDE_LABEL: Record<GuideKind, string> = {
  meal: "ご飯",
  souvenir: "お土産",
  sight: "観光",
  rest: "休むところ",
  tip: "寄り道",
  story: "物語",
};

export const GUIDE_COLOR: Record<GuideKind, string> = {
  meal: "#b5493a",
  souvenir: "#9a7a8c",
  sight: "#5f7d6a",
  rest: "#c5a059",
  tip: "#6b8cca",
  story: "#7a5a6e",
};

/** 地図・案内チップ。物語は土地タブ＋ピン補足なのでここに載せない。 */
export const GUIDE_ORDER: GuideKind[] = [
  "sight",
  "meal",
  "souvenir",
  "rest",
  "tip",
];

export function spotGuide(spot: Spot): GuideKind {
  if (spot.guide) return spot.guide;
  switch (spot.genre) {
    case "gourmet":
      return "meal";
    case "nature":
    case "history":
      return "sight";
    default:
      return "tip";
  }
}

export const MEAL_TIER_LABEL: Record<MealTier, string> = {
  casual: "庶民的",
  upscale: "高級",
};

export const MEAL_TIER_ORDER: MealTier[] = ["casual", "upscale"];

export const MEAL_TIME_LABEL: Record<MealTime, string> = {
  morning: "朝",
  lunch: "昼",
  dinner: "夜",
};

export const MEAL_TIME_ORDER: MealTime[] = ["morning", "lunch", "dinner"];

/** ご飯スポットの価格帯（未設定は庶民的） */
export function mealTierFor(spot: Spot): MealTier {
  return spot.mealTier ?? "casual";
}

/** ご飯スポットの時間帯（未設定は昼） */
export function mealTimesFor(spot: Spot): MealTime[] {
  if (spot.mealTimes && spot.mealTimes.length > 0) return spot.mealTimes;
  return ["lunch"];
}

/** 一人で入りやすいか（未設定は入りやすい寄り） */
export function soloOkFor(spot: Spot): boolean {
  if (typeof spot.soloOk === "boolean") return spot.soloOk;
  return mealTierFor(spot) !== "upscale";
}

/** 予算表示（未設定は価格帯からの目安） */
export function budgetYenFor(spot: Spot): string {
  const custom = spot.budgetYen?.trim();
  if (custom) return custom;
  return mealTierFor(spot) === "upscale" ? "¥3,000〜" : "〜¥1,500";
}

export const SOLO_OK_LABEL = {
  yes: "一人OK",
  no: "予約・人数向き",
} as const;

/** 営業・開館時間。分かっているときだけ返す（無いときは書かない）。 */
export function hoursFor(spot: Spot): string | undefined {
  const h = spot.hours?.trim();
  return h ? h : undefined;
}

export const TIME_OPTIONS = [
  { id: "1h", label: "1時間", index: 0 as const },
  { id: "3h", label: "3時間", index: 1 as const },
  { id: "half", label: "半日", index: 2 as const },
] as const;

export type TimeOptionId = (typeof TIME_OPTIONS)[number]["id"];

/** 地図・表示用の徒歩圏（約1km）。保存データの古い radiiKm は使わない。 */
export const WALK_RADIUS_KM: Record<TimeOptionId, number> = {
  "1h": 0.9,
  "3h": 1.0,
  half: 1.2,
};

export function walkRadiusKm(timeId: TimeOptionId): number {
  return WALK_RADIUS_KM[timeId] ?? 1.0;
}

/** 散歩道の地図円。小回り 1.2km / 大回り 1.5km（滞在時間設定は廃止）。 */
export const PROMENADE_RADIUS_KM = {
  short: 1.2,
  long: 1.5,
} as const;

export function walkRadiusKmForCourse(
  course: { id: string } | null | undefined,
): number {
  if (course?.id.includes("ordinary-long")) return PROMENADE_RADIUS_KM.long;
  return PROMENADE_RADIUS_KM.short;
}

/** 収録カタログは空。駅は検索（Gemini）→端末ライブラリにだけ貯める。 */
export const STATIONS: StationSeed[] = [];

/** かつて同梱していた種駅（端末ライブラリからも外す）。 */
export const RETIRED_STATION_IDS = [
  "demachiyanagi",
  "chushojima",
  "iwashimizu-hachimangu",
  "oyamazaki",
  "biei",
  "kanita",
  "ashio",
  "sawara",
  "manazuru",
  "hamakanaya",
  "nagatoro",
  "katsunuma",
  "kobuchizawa",
  "obasute",
  "shimosuwa",
  "yui",
  "nebukawa",
  "amarube",
  "onomichi",
  "misumi",
  "usuki",
  "hitoyoshi",
  "tsukazaki",
  "tamatsukuri",
] as const;

/** 駅未選択時の仮データ（画面を落とさないため）。 */
export const EMPTY_STATION: StationSeed = {
  id: "__empty__",
  name: "未選択",
  line: "",
  prefecture: "",
    region: "近畿",
    mood: "empty",
  radiiKm: [0.9, 1.0, 1.2],
  tourTitle: "駅を検索してから開く",
  catchCopy: "知らない駅の名前を入れて、徒歩圏の案内をつくります。",
    emptyCopy: {
    headline: "駅を探してください",
    body: "収録の定番駅はありません。検索した駅だけが、ここに残ります。",
  },
  spots: [],
};


export const REGIONS = [
  "北海道",
  "東北",
  "関東",
  "中部",
  "近畿",
  "中国",
  "四国",
  "九州",
] as const;

export function spotsForTime(
  station: StationSeed,
  timeIndex: 0 | 1 | 2,
): Spot[] {
  // 徒歩圏 約1km。半日（index 2）だけ reach- の1件を円の外に足す。
  const maxMinutes = [16, 18, 22][timeIndex];
  const inner = station.spots.filter(
    (s) => !s.id.startsWith("reach-") && s.walkMinutes <= maxMinutes,
  );
  if (timeIndex !== 2) return inner;
  const reach = station.spots.find((s) => s.id.startsWith("reach-"));
  return reach ? [...inner, reach] : inner;
}

export function pickSecret(spots: Spot[]): Spot | undefined {
  const marked = spots.filter((s) => s.secretWorthy);
  const pool = marked.length > 0 ? marked : spots;
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getStation(id: string): StationSeed | undefined {
  return STATIONS.find((s) => s.id === id);
}
