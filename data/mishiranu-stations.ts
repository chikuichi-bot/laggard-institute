export type SpotGenre = "history" | "gourmet" | "nature" | "odd";

/** 観光案内マップ用の見出し（必ず出す5種） */
export type GuideKind = "meal" | "souvenir" | "sight" | "rest" | "tip";

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
  /** Optional WGS84 (AI / precise pins) */
  lat?: number;
  lng?: number;
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
    "この駅周辺のレンタサイクルは、まだ編集確認中です。現地の観光案内所や駅掲示もあわせて見てください。",
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
  /** 過去の歴史メモ */
  historyNotes?: AreaHistoryNote[];
  /** 観光の見どころメモ（案内向け） */
  sightseeingNotes?: AreaHistoryNote[];
  /** レンタサイクルの有無（未設定時は未確認として表示） */
  bikeRental?: BikeRentalInfo;
  tourTitle: string;
  catchCopy: string;
  emptyCopy?: {
    headline: string;
    body: string;
  };
  spots: Spot[];
  /** Optional WGS84 station center (AI stations) */
  lat?: number;
  lng?: number;
  /** seed = 編集データ / ai = Gemini 生成 */
  source?: "seed" | "ai";
};

export function bikeRentalFor(station: StationSeed): BikeRentalInfo {
  return station.bikeRental ?? BIKE_RENTAL_UNKNOWN;
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
};

export const GUIDE_COLOR: Record<GuideKind, string> = {
  meal: "#b5493a",
  souvenir: "#9a7a8c",
  sight: "#5f7d6a",
  rest: "#c5a059",
  tip: "#6b8cca",
};

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

/** 営業・開館時間（未設定は空） */
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
  radiiKm: [1, 2.2, 3],
  tourTitle: "駅を検索してから開く",
  catchCopy: "知らない駅の名前を入れて、徒歩圏の案内をつくります。",
  emptyCopy: {
    headline: "駅を探してください",
    body: "収録の定番駅はありません。検索した駅だけが、ここに残ります。",
  },
  spots: [],
};


export function spotsForTime(
  station: StationSeed,
  timeIndex: 0 | 1 | 2,
): Spot[] {
  const maxMinutes = [55, 140, 240][timeIndex];
  return station.spots.filter((s) => s.walkMinutes <= maxMinutes);
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
