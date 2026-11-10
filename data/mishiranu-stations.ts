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

export type BikeRentalPlace = {
  name: string;
  note?: string;
  walkMinutes?: number;
};

/** 駅周辺のレンタサイクル（案内に必ず出す） */
export type BikeRentalInfo = {
  available: boolean;
  summary: string;
  places?: BikeRentalPlace[];
};

export const BIKE_RENTAL_UNKNOWN: BikeRentalInfo = {
  available: false,
  summary:
    "この駅周辺のレンタサイクルは、まだ編集確認中です。現地の観光案内所や駅掲示もあわせて見てください。",
};

export type StationSeed = {
  id: string;
  name: string;
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

export const STATIONS: StationSeed[] = [
  {
    id: "demachiyanagi",
    name: "出町柳",
    line: "京阪本線 / 叡山電鉄",
    prefecture: "京都",
    region: "近畿",
    mood: "story",
    radiiKm: [1.0, 2.2, 3.0],
    stationIntro:
      "京阪と叡電が乗り換わる、鴨川デルタのたもと。枡形商店街ですぐ甘いものが買え、川の音まで徒歩数分。観光の起点にも、日常の寄り道にもなる駅です。",
    areaAbout:
      "賀茂川と高野川が合流する三角の土地が、この界隈の骨格です。御所の北側にひらけた「出町」は、古くから人の往来と市の気配がつづく場所で、いまも学生・近所・旅人が同じ商店街を歩く距離感が残っています。",
    bikeRental: {
      available: true,
      summary:
        "駅周辺で借りられます。枡形〜河原町今出川に民間のレンタサイクルがあり、京都市内のシェアサイクルポートも徒歩圏です。下鴨や川端まわりを広く見るときに便利です。",
      places: [
        {
          name: "枡形・駅前のレンタサイクル店",
          walkMinutes: 3,
          note: "観光向けの半日〜1日貸出が多い",
        },
        {
          name: "河原町今出川あたりのシェアサイクル",
          walkMinutes: 12,
          note: "短時間・乗り捨て向き。アプリ登録が必要なことが多い",
        },
      ],
    },
    historyNotes: [
      {
        title: "「出町」の名",
        body:
          "京の都の外縁に「出た町」としてひらけた地名です。御所の北側、今出川あたりから先の町場を指し、市や人の出入りの場として長く使われてきました。",
      },
      {
        title: "鴨川デルタと二つの川",
        body:
          "西側を賀茂川、東側を高野川が流れ、三角州のような地形をつくります。川筋は治水と信仰の両方に関わり、下鴨神社の森へと続く景色の入口にもなっています。",
      },
      {
        title: "下鴨と糺の森",
        body:
          "北方の下鴨神社と糺の森は、古くからこの土地の聖域です。世界遺産「古都京都の文化財」の一部で、参道の木立は駅からでも気配を感じられます。",
      },
      {
        title: "鉄道の結節点へ",
        body:
          "叡山電鉄の終点として山へ、京阪本線で都心・大阪方面へ。地下の京阪と地上の叡電が隣り合ういまの姿は、近代以降に重ねられた交通の層です。",
      },
    ],
    tourTitle: "鴨川の三角と、枡形の甘い匂いをたどる",
    catchCopy: "日常の駅前が、寄り道の入口になっている。",
    spots: [
      {
        id: "demachi-1",
        name: "鴨川デルタ",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外）",
        blurb:
          "賀茂川と高野川が合う三角。治水と信仰が交わる地形の見所で、水音だけで土地の骨格がわかる。",
        detail:
          "三角の先端で二つの川の音を聞き分けると、この土地の地図が一気に立体になります。夕暮れは光が長く、朝は水音がはっきりします。",
        x: 0.42,
        y: 0.38,
        walkMinutes: 5,
        secretWorthy: true,
      },
      {
        id: "demachi-2",
        name: "出町枡形商店街",
        genre: "history",
        guide: "sight",
        hours: "店による（おおよそ 9:00〜18:00 前後）",
        blurb:
          "駅前の短いアーケード。市の名残をひきずる近所の商店街で、夕方に影が少し長くなる。",
        detail:
          "観光の目的地というより生活の導線。買う・食べる・通り過ぎるが同じ道幅で起きるので、ゆっくり往復すると町の呼吸がわかります。",
        x: 0.55,
        y: 0.52,
        walkMinutes: 3,
      },
      {
        id: "demachi-3",
        name: "出町ふたば",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥600",
        mealTimes: ["morning", "lunch"],
        hours: "8:30〜17:30（火 9:00〜17:00、水曜定休）",
        blurb:
          "豆餅（きな粉）とよもぎ餅が看板。袋のまま鴨川デルタへ歩くのが定番の食べ方。",
        x: 0.58,
        y: 0.48,
        walkMinutes: 4,
        secretWorthy: true,
      },
      {
        id: "demachi-3b",
        name: "出町ふたばの豆餅（土産）",
        genre: "gourmet",
        guide: "souvenir",
        hours: "8:30〜17:30（火 9:00〜17:00、水曜定休）",
        blurb: "冷めても味が残る豆餅は手土産向き。個包装で旅の荷物にも入れやすい。",
        x: 0.59,
        y: 0.5,
        walkMinutes: 4,
      },
      {
        id: "demachi-4",
        name: "叡山電鉄のホーム端",
        genre: "odd",
        guide: "tip",
        hours: "列車運行時間内（駅構内）",
        blurb: "京阪と叡電が隣り合う接続。発車の気配が二種類ある、駅の寄り道。",
        x: 0.5,
        y: 0.55,
        walkMinutes: 1,
      },
      {
        id: "demachi-5",
        name: "出町座",
        genre: "history",
        guide: "rest",
        hours: "9:30〜22:00（週により前後・不定休）",
        blurb:
          "枡形の映画×書店×カフェ。席に座って珈琲を置けば、商店街の足音がちょうどいい距離になる。",
        x: 0.52,
        y: 0.54,
        walkMinutes: 4,
      },
      {
        id: "demachi-5b",
        name: "進々堂 百万遍店",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥1,200",
        mealTimes: ["morning", "lunch"],
        hours: "10:00〜18:00（火曜定休、L.O. 17:45）",
        blurb:
          "焼きたてパンと珈琲の老舗。学生街の昼はサンドイッチ定食が早い。",
        x: 0.78,
        y: 0.48,
        walkMinutes: 14,
      },
      {
        id: "demachi-5c",
        name: "満寿形屋",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥1,500",
        mealTimes: ["lunch", "dinner"],
        hours: "11:00〜15:00（売り切れ次第終了・不定休）",
        blurb:
          "枡形商店街のうどんと鯖寿司。出汁のきいたうどんと、厚みのある鯖で昼の腹ごしらえ。",
        x: 0.53,
        y: 0.54,
        walkMinutes: 4,
      },
      {
        id: "demachi-5d",
        name: "手打大山そば 響",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥1,200",
        mealTimes: ["lunch", "dinner"],
        hours: "11:40〜19:00（売り切れ次第終了）",
        blurb:
          "出町柳駅すぐの手打ちそば。もりそばやとろろそばで、川へ戻る前の短い食事になる。",
        x: 0.68,
        y: 0.58,
        walkMinutes: 10,
      },
      {
        id: "demachi-5e",
        name: "下鴨茶寮",
        genre: "gourmet",
        guide: "meal",
        mealTier: "upscale",
        soloOk: false,
        budgetYen: "¥8,000〜",
        mealTimes: ["lunch", "dinner"],
        hours: "11:30〜14:30 / 17:00〜21:00（要予約・店休日あり）",
        blurb:
          "下鴨寄りの会席。旬の椀とご飯で、昼も夜も一段フォーマルな寄り道。",
        x: 0.32,
        y: 0.22,
        walkMinutes: 18,
        secretWorthy: true,
      },
      {
        id: "demachi-5f",
        name: "COYOTE Roastery",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥800",
        mealTimes: ["morning", "lunch"],
        hours: "平日 8:30〜18:00 / 土 10:00〜18:00（日曜定休）",
        blurb:
          "出町柳駅すぐのエルサルバドル専門ロースタリー。ドリップの一杯と、焙煎したての豆の持ち帰りができる。",
        x: 0.62,
        y: 0.5,
        walkMinutes: 6,
      },
      {
        id: "demachi-10",
        name: "鴨川デルタの川端",
        genre: "nature",
        guide: "rest",
        hours: "終日（屋外）",
        blurb:
          "三角の川べりで靴をぬがなくても一休みできる。水音が休憩のタイマーになる。",
        x: 0.44,
        y: 0.4,
        walkMinutes: 5,
      },
      {
        id: "demachi-6",
        name: "下鴨神社へ向かう並木の入口",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外・参道入口）",
        blurb:
          "糺の森へ続く木陰の始まり。参道の手前でも、聖域へ向かう気配が足元から変わる。",
        x: 0.35,
        y: 0.28,
        walkMinutes: 12,
      },
      {
        id: "demachi-9",
        name: "下鴨神社・糺の森",
        genre: "history",
        guide: "sight",
        hours: "6:30〜17:00（楼門内・神事で変更あり）",
        blurb:
          "賀茂御祖神社。原生林に近い森と社殿が残る古社で、このエリアの歴史の芯です。",
        x: 0.32,
        y: 0.18,
        walkMinutes: 18,
        secretWorthy: true,
      },
      {
        id: "demachi-7",
        name: "河原町今出川あたりの角",
        genre: "odd",
        guide: "tip",
        hours: "終日（屋外）",
        blurb:
          "御所の北東角に近い交差。出町の「都の外縁」だった距離感が、いまの街路にも残る。",
        x: 0.7,
        y: 0.65,
        walkMinutes: 14,
      },
      {
        id: "demachi-beans",
        name: "WEEKENDERS COFFEE",
        genre: "gourmet",
        guide: "souvenir",
        hours: "10:00〜19:00（豆の販売のみ・焙煎状況で変更あり）",
        blurb:
          "元田中寄りのロースター窓口。淹れずに豆だけ持ち帰れるので、コーヒー好きの手土産向き。",
        detail:
          "出町柳〜元田中の徒歩圏。焙煎状況で開店が前後するので、行く前に営業を確かめると安心です。",
        x: 0.72,
        y: 0.42,
        walkMinutes: 12,
        secretWorthy: true,
      },
      {
        id: "demachi-8",
        name: "枡形の紙もの・雑貨",
        genre: "history",
        guide: "souvenir",
        hours: "店による（おおよそ 10:00〜18:00）",
        blurb: "小さな店で見つける便箋や京都らしい紙もの。軽くて持ち帰れるお土産。",
        x: 0.56,
        y: 0.56,
        walkMinutes: 5,
      },
      {
        id: "demachi-11",
        name: "駅前のレンタサイクル",
        genre: "odd",
        guide: "tip",
        hours: "店による（おおよそ 9:00〜18:00）",
        blurb:
          "枡形すぐの貸自転車。川と下鴨をひと続きで見るときの足になる寄り道。",
        x: 0.54,
        y: 0.53,
        walkMinutes: 3,
      },
    ],
  },
  {
    id: "chushojima",
    name: "中書島",
    line: "京阪本線 / 宇治線",
    prefecture: "京都",
    region: "近畿",
    mood: "story",
    radiiKm: [1.0, 2.0, 3.0],
    lat: 34.9267,
    lng: 135.7594,
    stationIntro:
      "京阪本線と宇治線が分かれる伏見の結節点。御香宮と濠川が徒歩圏で、酒蔵の町への入口にもなる駅です。",
    areaAbout:
      "中書島の名は豊臣秀吉の家臣・松村対馬守の官名「中書」に由来すると伝えられます。宇治川派流の水運と伏見の酒造が重なる界隈で、いまも水路と石畳の気配が残っています。",
    bikeRental: {
      available: true,
      summary:
        "伏見エリアのレンタサイクル・シェアサイクルが徒歩圏です。濠川や酒蔵めぐりを広く見るときに便利です。台数は季節で変わるので、駅前や案内所で確認を。",
      places: [
        {
          name: "伏見エリアのレンタサイクル店",
          walkMinutes: 8,
          note: "半日〜1日貸出が多い",
        },
      ],
    },
    historyNotes: [
      {
        title: "中書島の名",
        body:
          "秀吉家臣・松村対馬守（中書）が居を構えたことに由来する地名とされます。島の字は、水路に囲まれた土地の記憶です。",
      },
      {
        title: "水運と伏見",
        body:
          "宇治川派流・濠川は伏見の物流を支えた水路。十石舟や酒蔵の風景は、その延長線上にあります。",
      },
    ],
    tourTitle: "御香宮と水路の匂いを、ゆるくたどる",
    catchCopy: "分岐の駅から、伏見の水辺へ半歩。",
    spots: [
      {
        id: "chusho-1",
        name: "御香宮神社",
        genre: "history",
        guide: "sight",
        hours: "境内自由（社務所はおおよそ 9:00〜17:00）",
        blurb:
          "駅からすぐの古社。芳しい水の伝説と、石灯籠の並ぶ参道が伏見らしい静けさをつくる。",
        detail:
          "伏見の「水」の話の入口。参道をゆっくり往復するだけでも、駅前の乗り換え感が薄れます。社務所時間外でも境内は歩けることが多いです。",
        x: 0.48,
        y: 0.42,
        walkMinutes: 5,
        secretWorthy: true,
        lat: 34.9285,
        lng: 135.7622,
      },
      {
        id: "chusho-2",
        name: "濠川・十石舟の乗り場あたり",
        genre: "nature",
        guide: "sight",
        hours: "水路は終日（屋外）。十石舟は季節運航・要確認",
        blurb:
          "伏見の水路へ続く水面。舟が止まっていても、石岸と柳の影だけで界隈の骨格がわかる。",
        detail:
          "舟に乗らなくても、岸の石積みと水面の幅を見ると水運の町だった距離感が残ります。柳の影の向きで時間帯もわかりやすいです。",
        x: 0.38,
        y: 0.58,
        walkMinutes: 12,
        lat: 34.9308,
        lng: 135.7628,
      },
      {
        id: "chusho-3",
        name: "つけ麺 きらり",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥1,200",
        mealTimes: ["lunch", "dinner"],
        hours: "11:00〜15:00（売り切れ次第終了・月曜など定休あり）",
        blurb:
          "中書島徒歩圏のつけ麺。極太麺と濃いつけ汁で、蔵めぐりの前に腹を満たす。",
        x: 0.55,
        y: 0.52,
        walkMinutes: 3,
      },
      {
        id: "chusho-3b",
        name: "鳥せい本店",
        genre: "gourmet",
        guide: "meal",
        mealTier: "upscale",
        soloOk: false,
        budgetYen: "¥4,000〜",
        mealTimes: ["dinner"],
        hours: "11:00〜22:00（月曜定休・祝日の月曜は営業）",
        blurb:
          "神聖の蔵元が営む鳥料理。焼き鳥と伏見の原酒で、夕方からの酒席寄りの一軒。",
        x: 0.4,
        y: 0.62,
        walkMinutes: 14,
      },
      {
        id: "chusho-4",
        name: "伏見夢百衆",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥1,000",
        mealTimes: ["morning", "lunch"],
        hours: "9:30〜17:00（年始・盆休みあり）",
        blurb:
          "旧月桂冠本店を改装した喫茶と売店。酒まんじゅうや酒粕スイーツで朝から寄れる。",
        x: 0.5,
        y: 0.45,
        walkMinutes: 6,
      },
      {
        id: "chusho-5",
        name: "月桂冠大倉記念館の売店",
        genre: "gourmet",
        guide: "souvenir",
        hours: "9:30〜16:30（入館受付は16:00まで）",
        blurb:
          "利き酒のあとに瓶や酒器を選べる売店。手土産は酒どころ伏見らしい品が揃う。",
        x: 0.42,
        y: 0.6,
        walkMinutes: 11,
      },
      {
        id: "chusho-6",
        name: "御香宮の境内ベンチ",
        genre: "odd",
        guide: "rest",
        hours: "境内自由（終日・屋外）",
        blurb:
          "参道を外れた木陰に腰を下ろす。電車の音が遠くなり、香の水の話がちょうどよく響く。",
        x: 0.47,
        y: 0.4,
        walkMinutes: 6,
      },
      {
        id: "chusho-7",
        name: "三栖閘門公園方面の水路散歩",
        genre: "nature",
        guide: "tip",
        hours: "終日（屋外）",
        blurb:
          "閘門と派流の土木遺産へ続く道。観光の本線から半歩外れて、水の高低差を見る寄り道。",
        x: 0.3,
        y: 0.7,
        walkMinutes: 18,
        secretWorthy: true,
      },
      {
        id: "chusho-8",
        name: "京阪中書島のホーム端",
        genre: "odd",
        guide: "tip",
        hours: "列車運行時間内（駅構内）",
        blurb:
          "本線と宇治線が分かれる気配。発車メロディの手前で、行き先の地図が二枚に割れる。",
        x: 0.52,
        y: 0.55,
        walkMinutes: 1,
      },
    
      {
        id: "chusho-s1",
        name: "月桂冠大倉記念館",
        genre: "history",
        guide: "sight",
        hours: "9:30〜16:30（月曜定休・祝日の月曜は翌日）",
        blurb: "伏見の酒蔵を公開した記念館。濠川沿いの白壁と展示で、醸造の町の骨格が見える。",
        detail: "試飲や売店は任意。蔵の匂いと水路の距離感を一度に拾える立ち寄りです。",
        x: 0.42,
        y: 0.48,
        walkMinutes: 8,
      },
      {
        id: "chusho-s2",
        name: "寺田屋跡",
        genre: "history",
        guide: "sight",
        hours: "9:00〜17:00（展示は季節により前後）",
        blurb: "幕末の宿の跡。狭い路地に史跡の看板が並び、濠川へ戻る道の途中で立ち寄れる。",
        x: 0.58,
        y: 0.6,
        walkMinutes: 12,
      },],
  },
  {
    id: "iwashimizu-hachimangu",
    name: "石清水八幡宮",
    line: "京阪本線",
    prefecture: "京都",
    region: "近畿",
    mood: "story",
    radiiKm: [1.0, 2.2, 3.0],
    lat: 34.8796,
    lng: 135.6998,
    stationIntro:
      "男山の麓に開く、石清水八幡宮への玄関口。京阪本線のホームを出ると、すぐに神域へ続く気配とケーブルの入口が近づきます。古くから朝廷や武家の信仰を集めた八幡の門前として町が育ち、駅はいまもその静けさと日常の乗り換えを同じ場所で引き受けています。半日あれば男山へ、1時間でも門前と川辺の層を拾えます。",
    areaAbout: [
      "石清水八幡宮は、男山に鎮座する八幡信仰の名社です。清和源氏をはじめ武家の尊崇を集め、都と西国を結ぶ信仰の結節になってきました。山裾の町は門前として栄え、参詣の道・茶屋・いまの駅前が、時代ごとに重なっています。",
      "駅周辺は、神社の荘厳さだけが前面に出るのではなく、住宅と小路が神域の手前で息を整える場所でもあります。飛行神社など、近代の物語が割り込んだスポットもあり、古い信仰と新しい伝説が徒歩圏で隣り合います。木漏れ日と川のせせらぎが、観光の音量を自然と下げてくれます。",
    ].join("\n\n"),
    walkGuide:
      "駅を出たらまず男山の方角とケーブルの入口を確認し、門前の道幅で呼吸を合わせてから参拝か町歩きへ。時間があるときは山へ、短い滞在なら門前と飛行神社まわりで十分に土地の層がわかります。下りは膝に来るので、靴と水分を先に見てください。",
    historyNotes: [
      {
        title: "石清水八幡宮と男山",
        body:
          "石清水八幡宮は男山に鎮座し、平安期以来、国家や武家の守護神として厚い信仰を集めてきました。山そのものが神域で、麓の町は参詣者を迎える門前として形づくられてきました。",
      },
      {
        title: "源氏と八幡",
        body:
          "八幡信仰は清和源氏など武士の家系と深く結びつき、戦の前の祈願や守護の象徴としても語られます。石清水はその中心のひとつで、京都近郊でありながら「武の神」の気配が強い場所です。",
      },
      {
        title: "門前町の距離感",
        body:
          "山へ登る前の平坦部には、茶屋や参詣者向けの店が並んだ門前の記憶が残ります。いまは住宅地の表情が強いですが、道の折れ方や社号の残り方に、往時の導線がにじんでいます。",
      },
      {
        title: "ケーブルと近代の参詣",
        body:
          "男山へのケーブルは、近代の参詣・観光を支えた装置です。歩いて登る信仰の道と、機械で上がる参詣が同居する風景は、この駅ならではの時間層です。",
      },
      {
        title: "飛行神社の近代伝説",
        body:
          "徒歩圏には、航空の祖・二宮忠八をまつる飛行神社があります。古い八幡信仰の隣に、近代日本の夢と発明の物語が置かれているのが、この界隈の不思議な厚みです。",
      },
    ],
    sightseeingNotes: [
      {
        title: "まず見るなら",
        body:
          "駅前から男山を見上げる角度と、門前の道。山の緑の塊が神域だとわかるだけで、あとの歩き方が変わります。",
      },
      {
        title: "時間があるとき",
        body:
          "石清水八幡宮本社まで上がると、山と社殿の関係がはっきりします。帰りに飛行神社へ寄ると、信仰の古層と近代が一本の徒歩でつながります。",
      },
      {
        title: "食べる・休むの目安",
        body:
          "門前の甘味や軽い食事で区切り、山道の前後に休みを入れると半日が安定します。水は多めに。",
      },
    ],
    bikeRental: {
      available: true,
      summary:
        "駅周辺や八幡市内のレンタサイクル・シェアサイクルを使えることがあります。男山参拝自体は徒歩・ケーブル向きですが、平地の門前や川辺を広く見るときに便利です。台数と営業は現地確認を。",
    },
    tourTitle: "男山の麓、神域へ続く静かな散歩道",
    catchCopy: "木漏れ日と歴史の静寂に身をゆだね、八幡の町を歩く。",
    spots: [
      {
        id: "hachiman-1",
        name: "石清水八幡宮（男山）",
        genre: "history",
        guide: "sight",
        hours: "境内自由（社務所・ケーブルは時間変動・要確認）",
        blurb:
          "男山の神域。朝廷と武家の信仰が重なる八幡の本社で、山ごとが案内になる。",
        detail:
          "麓から見上げるだけでも十分な導入になります。登るなら往復の体力を見て、ケーブル併用も選択肢です。",
        x: 0.45,
        y: 0.28,
        walkMinutes: 20,
        secretWorthy: true,
      },
      {
        id: "hachiman-2",
        name: "飛行神社",
        genre: "odd",
        guide: "tip",
        hours: "境内自由（詳細は現地掲示）",
        blurb:
          "航空の夢をまつる小さな社。古い八幡の隣に、近代の物語が静かに座る。",
        detail:
          "大きな観光施設というより、発見の寄り道。八幡参拝の前後に拾うと時代のコントラストが出ます。",
        x: 0.58,
        y: 0.48,
        walkMinutes: 12,
        secretWorthy: true,
      },
      {
        id: "hachiman-3",
        name: "やわた走井餅老舗",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥800",
        mealTimes: ["morning", "lunch"],
        hours: "9:00〜17:00（店休日あり）",
        blurb: "石清水八幡宮駅からすぐの門前名物。走井餅とお茶、走井うどんも店内で。",
        x: 0.5,
        y: 0.52,
        walkMinutes: 6,
      },
      {
        id: "hachiman-4",
        name: "石翠亭",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥1,000",
        mealTimes: ["lunch", "dinner"],
        hours: "11:00〜16:00（不定休）",
        blurb: "八幡宮山上の参拝者休憩所。厄除うどんや男山からあげで、ケーブル上がりの一休み。",
        x: 0.55,
        y: 0.6,
        walkMinutes: 4,
      },
      {
        id: "hachiman-5",
        name: "お守り・社務所の授与品",
        genre: "history",
        guide: "souvenir",
        hours: "社務所時間内（変動あり）",
        blurb: "八幡らしい授与品は手土産にもなる。重い土産より、軽い紙と布が旅向き。",
        x: 0.46,
        y: 0.32,
        walkMinutes: 22,
      },
      {
        id: "hachiman-6",
        name: "男山の木陰ベンチ",
        genre: "nature",
        guide: "rest",
        hours: "終日（屋外）",
        blurb: "参道の途中で足を止める木陰。息が整うと、山の静けさが一段深く聞こえる。",
        x: 0.42,
        y: 0.36,
        walkMinutes: 15,
      },
      {
        id: "hachiman-7",
        name: "京阪石清水八幡宮のホーム端",
        genre: "odd",
        guide: "tip",
        hours: "列車運行時間内（駅構内）",
        blurb: "山側の緑と線路の直線が同時に見える端。発車前の一分が、すでに散歩の入口。",
        x: 0.52,
        y: 0.62,
        walkMinutes: 1,
      },
    
      {
        id: "hachiman-s1",
        name: "石清水八幡宮参道・男山ケーブル",
        genre: "history",
        guide: "sight",
        hours: "ケーブル運行時間内（山上は社務所案内に準拠）",
        blurb: "駅からケーブルで山上へ。参道の坂と社殿までの一本道が、この駅の観光の芯になる。",
        detail: "徒歩で上がることもできるが、時間があるときは往復の眺めも味わいどころです。",
        x: 0.52,
        y: 0.42,
        walkMinutes: 5,
      },
      {
        id: "hachiman-s2",
        name: "流れ橋（上津屋橋）のたもと",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外・増水時は通行止）",
        blurb: "木津川に架かる沈下橋。増水で流される仕組みごと眺める、八幡側の静かな景観スポット。",
        x: 0.28,
        y: 0.7,
        walkMinutes: 35,
        secretWorthy: true,
      },],
  },
  {
    id: "oyamazaki",
    name: "大山崎",
    line: "東海道本線",
    prefecture: "京都",
    region: "近畿",
    mood: "story",
    radiiKm: [1.0, 2.0, 3.0],
    lat: 34.8917,
    lng: 135.6794,
    stationIntro:
      "桂川・宇治川・木津川が近づく山崎の入口。天王山の麓にひらけた門前と旧街道の気配が、駅前の静けさに残っています。名神や国道の大きさと、細い路地の小ささが同居する町で、短時間でも「歴史の余韻」と「いまの生活」が同じ半径に感じられます。戦国の天王山、門前の道、近代の産業層まで、徒歩圏で時代を拾える駅です。",
    areaAbout: [
      "大山崎周辺は、古くから山崎の地として知られ、離宮や寺社、交通の要衝として歴史書に名が出てきます。天王山は羽柴秀吉と明智光秀の戦いでも語られ、山と川の地形が戦略と信仰の両方の舞台になってきました。門前町として栄えた時代の道幅は、いまの細い路地にひっそり残っています。",
      "駅から見える景色は、必ずしも「観光地の顔」だけではありません。住宅、旧街道、山裾、河川の気配が混ざり、通り過ぎる人の速度がゆっくりめです。サントリーの工場・美術館など近代産業の層もあり、古代〜中世〜戦国〜近代が徒歩圏で折り重なるのがこの土地の面白さです。",
    ].join("\n\n"),
    walkGuide:
      "駅前の観光案内で地図とレンタサイクルを確認し、まず旧街道・門前の路地で町のスケールを掴むのがよいです。山へ行くなら体力配分を先に、平地だけなら川の方角と寺社の屋根を目印に往復してください。",
    historyNotes: [
      {
        title: "山崎の地",
        body:
          "山崎は古代から交通と祭祀の要点として意識されてきた土地です。川が集まり、山が迫る地形が、人の移動と祈りの両方を呼び込みました。",
      },
      {
        title: "天王山と戦国",
        body:
          "天王山は、羽柴秀吉と明智光秀のいわゆる山崎の戦いの舞台として広く知られます。山を押さえることが勝敗に関わる、という物語がいまも地名に張り付いています。",
      },
      {
        title: "門前と旧街道",
        body:
          "寺社の門前として栄えた町場の名残が、細い路地や角のカーブに残ります。大きな道路の向こうに、往時の人の歩幅が隠れていて、そこを歩くと時代が一段古く感じられます。",
      },
      {
        title: "三川の気配",
        body:
          "桂・宇治・木津の流れが近づく地点の近くで、水運と治水の話題が土地の説明に必ず出てきます。水面が見えなくても、湿度と風の向きに川の存在がにじむことがあります。",
      },
      {
        title: "近代の産業層",
        body:
          "近代以降は酒類産業など大きな工場立地も加わり、山崎の名は全国的なブランドとしても知られるようになりました。古い門前と新しい産業が、同じ町名の下に同居しています。",
      },
    ],
    sightseeingNotes: [
      {
        title: "まず見るなら",
        body:
          "駅前から天王山の向きを確認し、門前の路地へ少し入る。道幅が急に細くなる場所が、歴史の入口です。",
      },
      {
        title: "時間があるとき",
        body:
          "山崎の寺社や山裾まで足を延ばすと、戦国と信仰の物語が地形に結びつきます。美術館・工場エリアは別ペースで。",
      },
      {
        title: "食べる・休むの目安",
        body:
          "駅前の案内所まわりで休みとレンタサイクルを確保し、食事は門前〜駅前で区切ると半日が組みやすいです。",
      },
    ],
    bikeRental: {
      available: true,
      summary:
        "駅前の観光案内所などでレンタサイクルを借りられることがあります。門前の平地や川辺を広く見るのに向きます。営業時間と台数は当日確認を。山道自体は徒歩向きです。",
      places: [
        {
          name: "駅前の観光案内所まわり",
          walkMinutes: 2,
          note: "レンタサイクルの案内があることが多い",
        },
      ],
    },
    tourTitle: "門前の路地から、天王山の麓を読む",
    catchCopy: "三つの川が近づく町で、細い道が歴史を運ぶ。",
    spots: [
      {
        id: "oyam-1",
        name: "門前の細い路地",
        genre: "history",
        guide: "sight",
        hours: "終日（屋外）",
        blurb:
          "往時の門前の道幅が残る小路。大通りを外れた瞬間に、町の年代が一段下がる。",
        detail:
          "角を二つ曲がると車の音が遠のく場所があります。写真より、道幅そのものを覚えるのが近道です。",
        x: 0.48,
        y: 0.5,
        walkMinutes: 8,
        secretWorthy: true,
      },
      {
        id: "oyam-2",
        name: "天王山の麓の眺め",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外）",
        blurb:
          "山崎の戦いでも語られる山の手前。頂上へ行かなくても、麓の傾斜で物語が立ち上がる。",
        x: 0.4,
        y: 0.35,
        walkMinutes: 15,
      },
      {
        id: "oyam-3",
        name: "駅前の観光案内所",
        genre: "odd",
        guide: "tip",
        hours: "案内所による（おおよそ 9:00〜17:00）",
        blurb:
          "地図とレンタサイクルの入口。知らない駅での最初の会話相手になることが多い。",
        x: 0.52,
        y: 0.58,
        walkMinutes: 2,
      },
      {
        id: "oyam-4",
        name: "hermit green cafe",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥1,500",
        mealTimes: ["morning", "lunch"],
        hours: "11:00〜22:00（月曜は〜17:00・火曜定休）",
        blurb: "阪急大山崎駅すぐのリノベカフェ。パスタと自家製スイーツで門前散策の合間を埋める。",
        x: 0.5,
        y: 0.48,
        walkMinutes: 9,
      },
      {
        id: "oyam-5",
        name: "cafe tabitabi",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥1,200",
        mealTimes: ["lunch", "dinner"],
        hours: "平日 7:00〜19:00 / 日祝 8:00〜18:00（月曜定休）",
        blurb: "JR山崎駅前のカフェ。モーニングのトーストや日替わりランチで駅前の腹ごしらえ。",
        x: 0.56,
        y: 0.62,
        walkMinutes: 4,
      },
      {
        id: "oyam-6",
        name: "大山崎 COFFEE ROASTERS",
        genre: "gourmet",
        guide: "souvenir",
        hours: "木・土 10:00〜15:00（それ以外は休み・要確認）",
        blurb: "天王山ふもとの焙煎所。焙煎後まもない豆を、挽かずに袋で持ち帰れる。",
        x: 0.47,
        y: 0.52,
        walkMinutes: 10,
      },
      {
        id: "oyam-7",
        name: "川風の来る角",
        genre: "nature",
        guide: "rest",
        hours: "終日（屋外）",
        blurb: "湿度と風向きに三川の気配がにじむ休み場所。ベンチがなくても、立ち止まりたくなる角。",
        x: 0.35,
        y: 0.55,
        walkMinutes: 14,
      },
    
      {
        id: "oyam-s1",
        name: "アサヒビール大山崎山荘美術館",
        genre: "history",
        guide: "sight",
        hours: "10:00〜17:00（月曜定休・展示替休あり）",
        blurb: "天王山ふもとの山荘を改修した美術館。庭と建築を見てから門前へ戻る半日向きの立ち寄り。",
        x: 0.38,
        y: 0.4,
        walkMinutes: 18,
      },
      {
        id: "oyam-s2",
        name: "離宮八幡宮",
        genre: "history",
        guide: "sight",
        hours: "境内は日中（社務所時間は要確認）",
        blurb: "酒造の神を祀る門前の社。阪急大山崎から歩いて、細い路地の先に鳥居が立つ。",
        x: 0.55,
        y: 0.45,
        walkMinutes: 8,
      },],
  },
  {
    id: "biei",
    name: "美瑛",
    line: "富良野線",
    prefecture: "北海道",
    region: "北海道",
    mood: "empty",
    radiiKm: [1.5, 2.8, 3.5],
    stationIntro:
      "富良野線の小さな駅。観光地リストより、風と空の広さが先に来る場所です。",
    bikeRental: {
      available: false,
      summary:
        "駅周辺のレンタサイクルは季節・天候で変わります。観光案内や宿に確認を。",
    },
    tourTitle: "見渡す限りの余白を、歩く",
    catchCopy: "観光地リストは空欄のまま、風景だけが厚い。",
    emptyCopy: {
      headline: "見渡す限りの田園と、風の音",
      body: "ここには「行く場所」より「いる場所」がある。ベンチも看板もいらない。空の広さを、時間の単位にしてください。",
    },
    spots: [
      {
        id: "biei-1",
        name: "駅前の空地",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "ただの空き地が、地平線の入口になる。",
        x: 0.5,
        y: 0.5,
        walkMinutes: 2,
        secretWorthy: true,
      },
      {
        id: "biei-2",
        name: "線路沿いの草道",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "踏切の向こう、草が靴を撫でる。",
        x: 0.35,
        y: 0.38,
        walkMinutes: 9,
      },
    
      {
        id: "biei-r",
        name: "ホーム脇のベンチ",
        genre: "nature",
        guide: "rest",
        hours: "列車運行時間内",
        blurb:
          "荷物を下ろして、風だけ数える。予定のない駅の、いちばん素直な休み方。",
        x: 0.48,
        y: 0.55,
        walkMinutes: 1,
      },
      {
        id: "biei-t",
        name: "駅名標の影",
        genre: "odd",
        guide: "tip",
        hours: "終日（屋外）",
        blurb:
          "写真より、影の長さを見る。時刻表より正確に、いまの光を教えてくれる。",
        x: 0.55,
        y: 0.48,
        walkMinutes: 1,
      },

      {
        id: "biei-s1",
        name: "美瑛駅前の丘の眺め",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "駅を出てすぐの高低差から畑と空がひらける。観光バスの名所より手前で、風景だけを置ける場所。",
        x: 0.55,
        y: 0.42,
        walkMinutes: 6,
        secretWorthy: true,
      },
      {
        id: "biei-s2",
        name: "ビエイテラス周辺の並木",
        genre: "nature",
        guide: "sight",
        hours: "施設は営業時間内／屋外は終日",
        blurb: "駅から歩ける範囲の木立とベンチ。写真スポットを急がなくても、風の向きで景色が変わる。",
        x: 0.62,
        y: 0.5,
        walkMinutes: 10,
      },],
  },
  {
    id: "kanita",
    name: "蟹田",
    line: "津軽線",
    prefecture: "青森",
    region: "東北",
    mood: "story",
    radiiKm: [1.0, 2.0, 2.8],
    stationIntro:
      "津軽線の港町側。フェリーと風が、町の時計代わりになっています。",
    bikeRental: {
      available: false,
      summary:
        "港まわりは徒歩が基本。自転車貸出は案内所・宿で要確認です。",
    },
    tourTitle: "海峡の手前で、風と定食を待つ",
    catchCopy: "フェリーの気配だけが、町の時計になっている。",
    spots: [
      {
        id: "kanita-1",
        name: "駅前の待合",
        genre: "history",
        hours: "列車運行時間内（駅構内）",
        blurb: "発車案内より、風の音が大きい。",
        x: 0.48,
        y: 0.52,
        walkMinutes: 1,
      },
      {
        id: "kanita-2",
        name: "ウェル蟹食堂",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥1,000",
        mealTimes: ["lunch", "dinner"],
        hours: "10:00〜14:00（火曜・隔週水曜定休）",
        blurb: "蟹田駅すぐの駅前市場併設食堂。焼干しラーメンやシャモロックラーメンで港への腹ごしらえ。",
        x: 0.66,
        y: 0.44,
        walkMinutes: 12,
        secretWorthy: true,
      },
      {
        id: "kanita-3",
        name: "防風林の切れ目",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "切れ目からだけ、水平線が見える。",
        x: 0.3,
        y: 0.36,
        walkMinutes: 15,
      },
    
      {
        id: "kanita-s",
        name: "港の干物屋の袋",
        genre: "gourmet",
        guide: "souvenir",
        hours: "店による（おおよそ 9:00〜17:00）",
        blurb:
          "匂いの強い土産ほど、旅の記憶が長い。袋のまま荷物に忍ばせる。",
        x: 0.7,
        y: 0.5,
        walkMinutes: 14,
      },
      {
        id: "kanita-r",
        name: "待合の長いす",
        genre: "history",
        guide: "rest",
        hours: "列車運行時間内（駅構内）",
        blurb:
          "発車まで、風音を聞く席。港町の休憩は、ここで足りることが多い。",
        x: 0.5,
        y: 0.52,
        walkMinutes: 1,
      },
      {
        id: "kanita-t",
        name: "踏切の待ち時間",
        genre: "odd",
        guide: "tip",
        hours: "終日（屋外）",
        blurb:
          "遮断機が上がるまでが、短い寄り道。海峡の手前の、小さな余白。",
        x: 0.4,
        y: 0.48,
        walkMinutes: 4,
      },

      {
        id: "kanita-s1",
        name: "蟹田港・津軽海峡フェリー乗り場",
        genre: "history",
        guide: "sight",
        hours: "港は終日／フェリーは運航ダイヤに準拠",
        blurb: "駅から港へ下りる道。海峡へ出る船の気配が、蟹田のいちばんわかりやすい観光の核になる。",
        x: 0.7,
        y: 0.55,
        walkMinutes: 15,
      },
      {
        id: "kanita-s2",
        name: "蟹田漁港の防波堤",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外・強風時注意）",
        blurb: "漁港の突堤から海峡を見る。船待ちの時間を、風と潮の音だけで埋める寄り道。",
        x: 0.75,
        y: 0.6,
        walkMinutes: 18,
      },],
  },
  {
    id: "ashio",
    name: "通洞",
    line: "わたらせ渓谷鐵道",
    prefecture: "栃木",
    region: "関東",
    mood: "story",
    radiiKm: [1.1, 2.2, 3.0],
    stationIntro:
      "わたらせ渓谷の谷あい。銅山の記憶が、駅の空気にまだ残っています。",
    bikeRental: {
      available: false,
      summary:
        "谷沿いは徒歩・鉄道が主。レンタサイクルは近隣観光地で要確認です。",
    },
    tourTitle: "銅山の影をたどる、谷あいの半日",
    catchCopy: "山の中腹に、産業の記憶が静かに残っている。",
    spots: [
      {
        id: "ashio-1",
        name: "木造駅舎",
        genre: "history",
        guide: "sight",
        hours: "列車運行時間内（駅構内）",
        blurb: "天井の高さに、昔の人の背が残る。",
        x: 0.5,
        y: 0.5,
        walkMinutes: 1,
      },
      {
        id: "ashio-2",
        name: "渓流の見える橋",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "水音が、町の会話をひとつ減らす。",
        x: 0.28,
        y: 0.4,
        walkMinutes: 10,
      },
      {
        id: "ashio-3",
        name: "鉱山遺産の看板",
        genre: "odd",
        guide: "sight",
        hours: "終日（屋外・看板はいつでも）",
        blurb: "説明文より、錆の色の方が雄弁。",
        x: 0.7,
        y: 0.58,
        walkMinutes: 14,
        secretWorthy: true,
      },
    
      {
        id: "ashio-m",
        name: "川本",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥1,200",
        mealTimes: ["lunch"],
        hours: "11:30〜14:00（月曜定休）",
        blurb:
          "通洞駅すぐの老舗食堂。うなぎのたれが効いたとり丼が、銅山観光のあとの定番。",
        x: 0.55,
        y: 0.48,
        walkMinutes: 5,
      },
      {
        id: "ashio-s",
        name: "鉱山切手・記念の紙",
        genre: "history",
        guide: "souvenir",
        hours: "施設による（おおよそ 9:00〜16:00）",
        blurb:
          "軽い紙ものが、いちばん持ち帰れる産業遺産。",
        x: 0.62,
        y: 0.55,
        walkMinutes: 12,
      },
      {
        id: "ashio-r",
        name: "渓流の見える橋のたもと",
        genre: "nature",
        guide: "rest",
        hours: "終日（屋外）",
        blurb:
          "水音が会話をひとつ減らす場所。靴のまま、足を止めるだけでいい。",
        x: 0.3,
        y: 0.42,
        walkMinutes: 10,
      },

      {
        id: "ashio-s1",
        name: "足尾銅山・通洞坑",
        genre: "history",
        guide: "sight",
        hours: "坑内見学は案内時間に準拠（季節運休あり）",
        blurb: "通洞駅名の由来でもある坑口。鉱山電車で坑内へ入り、足尾の産業遺産を徒歩圏で見る。",
        detail: "ヘルメット貸出あり。見学後は駅前食堂へ戻る動線が自然です。",
        x: 0.45,
        y: 0.4,
        walkMinutes: 8,
        secretWorthy: true,
      },
      {
        id: "ashio-s2",
        name: "足尾歴史館まわり",
        genre: "history",
        guide: "sight",
        hours: "9:00〜16:30（火曜定休・季節により前後）",
        blurb: "銅山の町の変遷を展示する施設周辺。坑道見学の前後に、地図と写真で土地の厚みを補う。",
        x: 0.5,
        y: 0.52,
        walkMinutes: 12,
      },],
  },
  {
    id: "sawara",
    name: "佐原",
    line: "成田線",
    prefecture: "千葉",
    region: "関東",
    mood: "story",
    radiiKm: [1.2, 2.4, 3.2],
    stationIntro:
      "成田線の水郷の町。小野川と蔵造りの通りが、歩く速さに合わせて息をします。",
    bikeRental: {
      available: false,
      summary:
        "町歩き向けのレンタサイクルが案内所まわりにあることがあります。要確認。",
    },
    tourTitle: "小野川沿いの蔵と、甘い香りを巡る",
    catchCopy: "水郷の町は、歩く速さに合わせて息をする。",
    spots: [
      {
        id: "sawara-1",
        name: "蔵造りの通り",
        genre: "history",
        guide: "sight",
        hours: "終日（町並み・店は個別）",
        blurb: "白壁の反射で、午後が長くなる。",
        x: 0.45,
        y: 0.48,
        walkMinutes: 8,
      },
      {
        id: "sawara-2",
        name: "甘味いなえ",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥1,000",
        mealTimes: ["lunch"],
        hours: "10:30〜17:00（水曜定休）",
        blurb: "町屋と蔵を再生した甘味処。ほうじ茶クリームあんみつやかき氷で小野川散策の途中に。",
        x: 0.62,
        y: 0.38,
        walkMinutes: 12,
        secretWorthy: true,
      },
      {
        id: "sawara-3",
        name: "水門のたもと",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "水位を見るだけで、十分に用事になる。",
        x: 0.32,
        y: 0.62,
        walkMinutes: 15,
      },
      {
        id: "sawara-4",
        name: "古い消防の倉庫",
        genre: "odd",
        hours: "外観のみ（屋外から随時）",
        blurb: "扉は閉まっているのに、町の用心が残る。",
        x: 0.7,
        y: 0.55,
        walkMinutes: 9,
      },
    
      {
        id: "sawara-s",
        name: "川沿いの醤油スイーツ缶",
        genre: "gourmet",
        guide: "souvenir",
        hours: "店による（おおよそ 10:00〜17:00）",
        blurb:
          "甘い香りの缶は、手土産にも自分用にもなる水郷の軽い荷物。",
        x: 0.58,
        y: 0.42,
        walkMinutes: 11,
      },
      {
        id: "sawara-r",
        name: "小野川の縁台",
        genre: "nature",
        guide: "rest",
        hours: "終日（屋外）",
        blurb:
          "舟の影が横切るのを待つ席。商店街のあいだの、静かな一休み。",
        x: 0.5,
        y: 0.4,
        walkMinutes: 10,
      },

      {
        id: "sawara-s1",
        name: "小野川沿いの町並み",
        genre: "history",
        guide: "sight",
        hours: "屋外終日／店は個別営業",
        blurb: "水郷佐原の顔。川舟と蔵造りの家並みが続き、駅から歩いてすぐに観光地の芯へ入る。",
        x: 0.55,
        y: 0.42,
        walkMinutes: 10,
        secretWorthy: true,
      },
      {
        id: "sawara-s2",
        name: "伊能忠敬記念館",
        genre: "history",
        guide: "sight",
        hours: "9:00〜16:30（月曜定休）",
        blurb: "日本地図をつくった伊能忠敬の記念館。小野川から一本入った場所で、測量の道具と足跡を見る。",
        x: 0.48,
        y: 0.38,
        walkMinutes: 14,
      },
      {
        id: "sawara-s3",
        name: "佐原三菱館まわりの蔵通り",
        genre: "history",
        guide: "sight",
        hours: "外観は終日／内部は開館日に準拠",
        blurb: "煉瓦と蔵の角がつづく通り。写真より、壁の影の長さを数える歩き方が似合う。",
        x: 0.6,
        y: 0.45,
        walkMinutes: 12,
      },],
  },
  {
    id: "manazuru",
    name: "真鶴",
    line: "東海道本線",
    prefecture: "神奈川",
    region: "関東",
    mood: "story",
    radiiKm: [1.0, 2.0, 3.0],
    stationIntro:
      "東海道線の岬の入口。石材と潮の匂いが、駅前からすでに始まっています。",
    bikeRental: {
      available: false,
      summary:
        "坂と港まわりは徒歩向き。シェアサイクルは近隣駅で要確認です。",
    },
    tourTitle: "岬の坂道と石材の匂いをたどる半日",
    catchCopy: "海が見えなくても、町はすでに潮の匂いがする。",
    spots: [
      {
        id: "manazuru-1",
        name: "駅前の石屋跡",
        genre: "history",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "真鶴の石が、建材になる前の姿を想像させる。",
        x: 0.5,
        y: 0.48,
        walkMinutes: 3,
      },
      {
        id: "manazuru-2",
        name: "食事処 宵",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥1,500",
        mealTimes: ["lunch", "dinner"],
        hours: "11:00〜14:00 / 17:00〜23:00（火曜・第3水曜休）",
        blurb: "真鶴港寄りの魚定食。あら煮と刺身の定食で、港の魚を昼のうちに味わう。",
        x: 0.68,
        y: 0.58,
        walkMinutes: 14,
        secretWorthy: true,
      },
      {
        id: "manazuru-3",
        name: "雑木の公園",
        genre: "nature",
        guide: "sight",
        hours: "終日（公園）",
        blurb: "ベンチひとつで十分な眺め。電車の音が遠い。",
        x: 0.28,
        y: 0.42,
        walkMinutes: 10,
      },
      {
        id: "manazuru-4",
        name: "坂の途中のポスト",
        genre: "odd",
        hours: "終日（屋外）",
        blurb: "誰かに宛てたわけでもない手紙を、置きたくなる場所。",
        x: 0.55,
        y: 0.28,
        walkMinutes: 11,
      },
    
      {
        id: "manazuru-s",
        name: "石の小さな文鎮",
        genre: "odd",
        guide: "souvenir",
        hours: "店による（おおよそ 10:00〜17:00）",
        blurb:
          "真鶴の石の感触だけ持ち帰れる。重いのに、旅の荷物としてちょうどいい。",
        x: 0.52,
        y: 0.5,
        walkMinutes: 5,
      },
      {
        id: "manazuru-r",
        name: "雑木公園のベンチ",
        genre: "nature",
        guide: "rest",
        hours: "終日（公園）",
        blurb:
          "電車の音が遠い席。海が見えなくても、潮の匂いが休憩になる。",
        x: 0.3,
        y: 0.44,
        walkMinutes: 10,
      },

      {
        id: "manazuru-s1",
        name: "真鶴港",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "駅から坂を下った港。漁船と岸壁の距離が近く、半島の先端へ向かう前の一枚目の景色になる。",
        x: 0.65,
        y: 0.62,
        walkMinutes: 12,
      },
      {
        id: "manazuru-s2",
        name: "番町の石切場跡・石の町並み",
        genre: "history",
        guide: "sight",
        hours: "屋外終日",
        blurb: "小松石の産地らしい石塀と路地。港へ下りる道の途中で、真鶴の産業の肌触りが見える。",
        x: 0.52,
        y: 0.5,
        walkMinutes: 8,
      },
      {
        id: "manazuru-s3",
        name: "御林岬方面の入口",
        genre: "nature",
        guide: "sight",
        hours: "終日（遊歩道・天候注意）",
        blurb: "半島先端の自然遊歩道への入口。半日あるときに、港から先へ一歩伸ばす観光の分岐点。",
        x: 0.72,
        y: 0.55,
        walkMinutes: 25,
      },],
  },
  {
    id: "hamakanaya",
    name: "浜金谷",
    line: "内房線",
    prefecture: "千葉",
    region: "関東",
    mood: "story",
    radiiKm: [1.1, 2.3, 3.1],
    stationIntro:
      "内房線、鋸山のふもと。山と港の矢印が、同じ案内板に同居しています。",
    bikeRental: {
      available: false,
      summary:
        "港・登山口まわりは徒歩が主。自転車は観光案内で要確認です。",
    },
    tourTitle: "鋸山のふもとで、海風と団子を分ける",
    catchCopy: "山を見上げるか、海を見るか。駅はどちらも手放さない。",
    spots: [
      {
        id: "hamakanaya-1",
        name: "駅前の案内板",
        genre: "history",
        hours: "終日（屋外）",
        blurb: "登山道と港の矢印が、同じ柱に同居している。",
        x: 0.5,
        y: 0.5,
        walkMinutes: 2,
      },
      {
        id: "hamakanaya-2",
        name: "めん処 波留菜亭",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥1,200",
        mealTimes: ["lunch"],
        hours: "11:00〜17:00（フェリー欠航時は休み）",
        blurb: "金谷フェリーターミナルのめん処。黄金アジや海鮮丼で、乗船待ちの時間を埋める。",
        x: 0.65,
        y: 0.6,
        walkMinutes: 8,
        secretWorthy: true,
      },
      {
        id: "hamakanaya-3",
        name: "防波堤の先端",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "東京湾の風が、帽子を試してくる。",
        x: 0.75,
        y: 0.45,
        walkMinutes: 14,
      },
    
      {
        id: "hamakanaya-s",
        name: "港の塩気のお菓子",
        genre: "gourmet",
        guide: "souvenir",
        hours: "店による（おおよそ 9:00〜17:00）",
        blurb:
          "袋のまま持てる、海風の味。帰りの車窓用の土産。",
        x: 0.62,
        y: 0.58,
        walkMinutes: 8,
      },
      {
        id: "hamakanaya-r",
        name: "案内板の影",
        genre: "history",
        guide: "rest",
        hours: "終日（屋外）",
        blurb:
          "登山と港、どちらを選ぶか迷う時間が、すでに休み。",
        x: 0.5,
        y: 0.5,
        walkMinutes: 2,
      },
      {
        id: "hamakanaya-t",
        name: "フェリー乗り場の風",
        genre: "odd",
        guide: "tip",
        hours: "運航時間内（屋外）",
        blurb:
          "乗らなくても、発着の気配だけで町のリズムがわかる。",
        x: 0.72,
        y: 0.55,
        walkMinutes: 10,
      },

      {
        id: "hamakanaya-s1",
        name: "金谷港・東京湾フェリー乗り場",
        genre: "history",
        guide: "sight",
        hours: "港は終日／フェリーは運航ダイヤに準拠",
        blurb: "駅名の「金谷」へまっすぐ下りる港。対岸の木更津へ渡る船と、鋸山への入口が同じ場所にある。",
        x: 0.6,
        y: 0.65,
        walkMinutes: 7,
      },
      {
        id: "hamakanaya-s2",
        name: "鋸山ロープウェー山麓駅",
        genre: "nature",
        guide: "sight",
        hours: "ロープウェー運行時間内",
        blurb: "浜金谷駅から歩いて乗れる山岳ロープウェー。山上の展望は半日コースの主目的になりやすい。",
        x: 0.45,
        y: 0.4,
        walkMinutes: 10,
        secretWorthy: true,
      },],
  },
  {
    id: "nagatoro",
    name: "長瀞",
    line: "秩父鉄道",
    prefecture: "埼玉",
    region: "関東",
    mood: "story",
    radiiKm: [1.2, 2.5, 3.2],
    stationIntro:
      "秩父鉄道の渓谷入口。岩畳の手前で、茶屋と川音が先に出迎えます。",
    bikeRental: {
      available: false,
      summary:
        "駅前に観光向けレンタサイクルがある季節があります。川沿い散策向き。",
    },
    tourTitle: "岩畳の手前で、茶屋と川音を拾う",
    catchCopy: "観光の入口に立つだけで、すでに渓谷の一部。",
    spots: [
      {
        id: "nagatoro-1",
        name: "駅前の商店街",
        genre: "history",
        guide: "sight",
        hours: "店による（おおよそ 9:00〜18:00）",
        blurb: "のれんの間隔が、昔の歩幅を覚えている。",
        x: 0.48,
        y: 0.52,
        walkMinutes: 4,
      },
      {
        id: "nagatoro-2",
        name: "きそば むらた",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥1,200",
        mealTimes: ["lunch"],
        hours: "10:30〜そば売り切れ次第終了（不定休）",
        blurb: "長瀞駅徒歩すぐの手打ちそば。ざるそばと野菜のかき揚げが、岩畳へ向かう前の定番。",
        x: 0.6,
        y: 0.4,
        walkMinutes: 10,
        secretWorthy: true,
      },
      {
        id: "nagatoro-3",
        name: "岩の見える土手",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "岩畳まで行かなくても、川は十分に語る。",
        x: 0.35,
        y: 0.35,
        walkMinutes: 12,
      },
    
      {
        id: "nagatoro-s",
        name: "川霧の羊羹",
        genre: "gourmet",
        guide: "souvenir",
        hours: "店による（おおよそ 9:00〜17:00）",
        blurb:
          "冷たい川の記憶を、紙箱に入れて持ち帰れる。",
        x: 0.55,
        y: 0.48,
        walkMinutes: 6,
      },
      {
        id: "nagatoro-r",
        name: "土手の腰かけ石",
        genre: "nature",
        guide: "rest",
        hours: "終日（屋外）",
        blurb:
          "岩畳まで行かなくても、川は十分に語る。ここで一度、足を下ろす。",
        x: 0.38,
        y: 0.38,
        walkMinutes: 12,
      },
      {
        id: "nagatoro-t",
        name: "のれんのあいだ",
        genre: "odd",
        guide: "tip",
        hours: "店による（おおよそ 9:00〜18:00）",
        blurb:
          "商店街の影の間隔が、昔の歩幅を覚えている。",
        x: 0.48,
        y: 0.5,
        walkMinutes: 4,
      },

      {
        id: "nagatoro-s1",
        name: "岩畳",
        genre: "nature",
        guide: "sight",
        hours: "終日（増水・凍結時注意）",
        blurb: "荒川の岩床が広く露出する長瀞の象徴。駅から商店街を抜けて、すぐに観光の本丸へ出る。",
        detail: "靴底が滑りやすい。ライン下りの前後に、岩の肌理だけを見る時間を置くとよい。",
        x: 0.55,
        y: 0.55,
        walkMinutes: 12,
        secretWorthy: true,
      },
      {
        id: "nagatoro-s2",
        name: "長瀞ライン下り乗り場",
        genre: "nature",
        guide: "sight",
        hours: "乗船は運航シーズン・時間に準拠",
        blurb: "岩畳のそばから船に乗る。船に乗らなくても、乗り場まわりの川音だけで十分に観光地の気配がある。",
        x: 0.58,
        y: 0.58,
        walkMinutes: 14,
      },
      {
        id: "nagatoro-s3",
        name: "宝登山神社の参道入口",
        genre: "history",
        guide: "sight",
        hours: "境内は日中",
        blurb: "ロープウェイ山麓へ続く参道の入口。岩畳から一本入ると、杉と石段の空気に切り替わる。",
        x: 0.48,
        y: 0.35,
        walkMinutes: 18,
      },],
  },
  {
    id: "katsunuma",
    name: "勝沼ぶどう郷",
    line: "中央本線",
    prefecture: "山梨",
    region: "中部",
    mood: "story",
    radiiKm: [1.3, 2.6, 3.3],
    stationIntro:
      "中央本線の葡萄郷。線路の向こうに、季節の甘さが見える駅です。",
    bikeRental: {
      available: false,
      summary:
        "畑道の散策向けにレンタサイクルがあることがあります。季節要確認。",
    },
    tourTitle: "葡萄棚のあいだを、駅からゆるく歩く",
    catchCopy: "線路の向こうに、季節の甘さが見える。",
    spots: [
      {
        id: "katsunuma-1",
        name: "葡萄の垣根",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外・季節による）",
        blurb: "葉の隙間から、駅名の意味がわかる。",
        x: 0.4,
        y: 0.4,
        walkMinutes: 8,
      },
      {
        id: "katsunuma-2",
        name: "ワインショップ シャトー勝沼",
        genre: "gourmet",
        guide: "meal",
        mealTier: "upscale",
        soloOk: true,
        budgetYen: "¥3,000〜",
        mealTimes: ["lunch", "dinner"],
        hours: "9:00〜17:00（年始休みあり・要確認）",
        blurb: "勝沼ぶどう郷駅から歩ける直売店。試飲とボトル選びで、葡萄郷の寄りの窓口になる。",
        x: 0.62,
        y: 0.48,
        walkMinutes: 14,
        secretWorthy: true,
      },
      {
        id: "katsunuma-3",
        name: "古い農具の倉庫",
        genre: "odd",
        hours: "外観のみ（屋外から随時）",
        blurb: "観光用ではない道具が、いちばん正直。",
        x: 0.3,
        y: 0.62,
        walkMinutes: 11,
      },
    
      {
        id: "katsunuma-s",
        name: "小さな瓶の葡萄ジュース",
        genre: "gourmet",
        guide: "souvenir",
        hours: "店による（おおよそ 10:00〜17:00）",
        blurb:
          "試飲のあと、軽い瓶をひとつ。棚のあいだの土産。",
        x: 0.58,
        y: 0.5,
        walkMinutes: 12,
      },
      {
        id: "katsunuma-r",
        name: "葡萄棚の木陰",
        genre: "nature",
        guide: "rest",
        hours: "終日（屋外・季節による）",
        blurb:
          "葉の隙間の風が、休憩のタイマー。暑い日ほど効く。",
        x: 0.42,
        y: 0.42,
        walkMinutes: 8,
      },

      {
        id: "katsunuma-s1",
        name: "ぶどうの丘",
        genre: "nature",
        guide: "sight",
        hours: "施設は概ね 9:00〜17:00（季節により前後）",
        blurb: "葡萄畑を見下ろす展望の丘。駅から少し歩いて、勝沼の観光の見取り図を一度に拾える。",
        x: 0.55,
        y: 0.4,
        walkMinutes: 20,
      },
      {
        id: "katsunuma-s2",
        name: "大善寺",
        genre: "history",
        guide: "sight",
        hours: "9:00〜16:30（要確認）",
        blurb: "葡萄寺とも呼ばれる山寺。勝沼の信仰と果樹の歴史が重なる、徒歩圏の静かな観光地。",
        x: 0.4,
        y: 0.35,
        walkMinutes: 25,
        secretWorthy: true,
      },],
  },
  {
    id: "kobuchizawa",
    name: "小淵沢",
    line: "中央本線",
    prefecture: "山梨",
    region: "中部",
    mood: "story",
    radiiKm: [1.2, 2.4, 3.2],
    stationIntro:
      "中央本線の高原の結節。乗り換えの合間に、山の匂いだけ持ち帰れます。",
    bikeRental: {
      available: false,
      summary:
        "高原散策向けのレンタサイクルが駅周辺にあることがあります。要確認。",
    },
    tourTitle: "高原の風と自家焙煎を巡る、レトロ駅前散歩",
    catchCopy: "乗り換えの合間に、山の匂いだけ持ち帰れる駅。",
    spots: [
      {
        id: "kobuchizawa-1",
        name: "駅舎の待合室",
        genre: "history",
        hours: "列車運行時間内（駅構内）",
        blurb: "木の椅子と掲示板。発車までの余白が残っている。",
        x: 0.48,
        y: 0.52,
        walkMinutes: 1,
      },
      {
        id: "kobuchizawa-2",
        name: "純喫茶アサヒ",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥800",
        mealTimes: ["morning", "lunch"],
        hours: "要確認（朝〜昼の純喫茶・目安 8:00〜15:00）",
        blurb: "深煎りの香ばしさと、トーストの角。地元の朝の文法。",
        x: 0.62,
        y: 0.4,
        walkMinutes: 8,
        secretWorthy: true,
      },
      {
        id: "kobuchizawa-3",
        name: "並木の一筋",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "線路沿いに続く並木。風の向きで景色が変わる。",
        x: 0.3,
        y: 0.35,
        walkMinutes: 12,
      },
      {
        id: "kobuchizawa-4",
        name: "古い看板の店先",
        genre: "odd",
        hours: "終日（屋外）",
        blurb: "読めないほど褪せた看板だけが、昔の店を覚えている。",
        x: 0.72,
        y: 0.62,
        walkMinutes: 15,
      },
      {
        id: "kobuchizawa-5",
        name: "神社の石段",
        genre: "history",
        guide: "sight",
        hours: "終日（境内は日中が安心）",
        blurb: "短い石段の先に、町の静けさがたまっている。",
        x: 0.38,
        y: 0.7,
        walkMinutes: 18,
      },
    
      {
        id: "kobuchizawa-s",
        name: "駅前の高原みやげ袋",
        genre: "history",
        guide: "souvenir",
        hours: "店による（おおよそ 9:00〜18:00）",
        blurb:
          "軽い袋菓子やシール。乗り換え時間でも買い足せる土産。",
        x: 0.55,
        y: 0.5,
        walkMinutes: 3,
      },
      {
        id: "kobuchizawa-r",
        name: "待合の窓際",
        genre: "history",
        guide: "rest",
        hours: "列車運行時間内（駅構内）",
        blurb:
          "木の椅子と掲示板。発車までの余白が、いちばん高原らしい。",
        x: 0.48,
        y: 0.52,
        walkMinutes: 1,
      },

      {
        id: "kobuchizawa-s1",
        name: "小淵沢駅前の高原の眺め",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "中央本線と小海線が分かれる結節点。駅前から南アルプス方面の空がひらけ、高原駅の顔が見える。",
        x: 0.5,
        y: 0.45,
        walkMinutes: 3,
      },
      {
        id: "kobuchizawa-s2",
        name: "小淵沢神社",
        genre: "history",
        guide: "sight",
        hours: "境内は日中",
        blurb: "駅から短い坂を上がった社。石段と木立が、高原の町の静かな観光の起点になる。",
        x: 0.58,
        y: 0.38,
        walkMinutes: 10,
      },],
  },
  {
    id: "obasute",
    name: "姨捨",
    line: "篠ノ井線",
    prefecture: "長野",
    region: "中部",
    mood: "empty",
    radiiKm: [1.0, 2.0, 2.8],
    stationIntro:
      "篠ノ井線の棚田の駅。夜景で有名でも、昼間の余白はまだ静かです。",
    bikeRental: {
      available: false,
      summary:
        "急勾配のため徒歩が基本。自転車は近隣観光拠点で要確認です。",
    },
    tourTitle: "棚田の光だけを、駅で受け取る",
    catchCopy: "夜景で有名でも、昼間の余白はまだ知られていない。",
    emptyCopy: {
      headline: "棚田の静寂を、そのまま座る",
      body: "名所の写真を追わなくていい。電車を降りた場所から見える勾配だけで、十分に姨捨です。",
    },
    spots: [
      {
        id: "obasute-1",
        name: "ホームからの眺め",
        genre: "nature",
        guide: "sight",
        hours: "列車運行時間内（ホーム）",
        blurb: "線路が、棚田の輪郭を一本だけ引いている。",
        x: 0.5,
        y: 0.45,
        walkMinutes: 1,
        secretWorthy: true,
      },
      {
        id: "obasute-2",
        name: "駅裏の小道",
        genre: "nature",
        hours: "終日（屋外）",
        blurb: "案内板より先に、勾配が案内する。",
        x: 0.38,
        y: 0.58,
        walkMinutes: 8,
      },
    
      {
        id: "obasute-r",
        name: "ホーム端の腰かけ",
        genre: "nature",
        guide: "rest",
        hours: "列車運行時間内（ホーム）",
        blurb:
          "棚田の光を、座ったまま受け取る。観光写真より先に、余白がある。",
        x: 0.52,
        y: 0.46,
        walkMinutes: 1,
      },
      {
        id: "obasute-t",
        name: "駅名標と勾配",
        genre: "odd",
        guide: "tip",
        hours: "終日（屋外）",
        blurb:
          "名前を読むより、足元の傾きを感じる。姨捨はそこで始まる。",
        x: 0.48,
        y: 0.5,
        walkMinutes: 1,
      },

      {
        id: "obasute-s1",
        name: "姨捨駅ホームからの善光寺平展望",
        genre: "nature",
        guide: "sight",
        hours: "列車運行時間内（ホーム）",
        blurb: "この駅自体が観光地。ホームから善光寺平の夜景・昼景を見るために人が降りる、余白の名所。",
        x: 0.5,
        y: 0.48,
        walkMinutes: 1,
        secretWorthy: true,
      },
      {
        id: "obasute-s2",
        name: "姨捨の棚田（展望地点付近）",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外・農道注意）",
        blurb: "駅周辺から辿れる棚田の眺め。空駅の気分を、田の段々まで少し伸ばす歩き。",
        x: 0.4,
        y: 0.4,
        walkMinutes: 20,
      },],
  },
  {
    id: "shimosuwa",
    name: "下諏訪",
    line: "中央本線",
    prefecture: "長野",
    region: "中部",
    mood: "story",
    radiiKm: [1.1, 2.3, 3.0],
    stationIntro:
      "中央本線の温泉と中山道の町。敷石の感触が、すでに湯治の入口です。",
    bikeRental: {
      available: false,
      summary:
        "温泉街は徒歩向き。レンタサイクルは観光案内所で要確認です。",
    },
    tourTitle: "温泉街の路地と、湖風のあいだ",
    catchCopy: "中山道の名残が、足元の敷石に残っている。",
    spots: [
      {
        id: "shimosuwa-1",
        name: "温泉街の石畳",
        genre: "history",
        guide: "sight",
        hours: "終日（町並み）",
        blurb: "湯気の向きで、道順がわかる。",
        x: 0.48,
        y: 0.5,
        walkMinutes: 7,
      },
      {
        id: "shimosuwa-2",
        name: "新鶴本店",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥800",
        mealTimes: ["morning", "lunch"],
        hours: "9:00〜17:30（水曜定休）",
        blurb: "諏訪大社下社秋宮そばの老舗和菓子。塩羊羹ともちまんが、湯上がりの手土産にもなる。",
        x: 0.6,
        y: 0.38,
        walkMinutes: 9,
        secretWorthy: true,
      },
      {
        id: "shimosuwa-3",
        name: "湖畔への短い坂",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "坂の途中で、すでに諏訪湖の匂いがする。",
        x: 0.35,
        y: 0.65,
        walkMinutes: 16,
      },
    
      {
        id: "shimosuwa-s",
        name: "温泉まんじゅうの箱",
        genre: "gourmet",
        guide: "souvenir",
        hours: "店による（おおよそ 9:00〜18:00）",
        blurb:
          "湯気の町の定番手土産。冷めても旅の匂いが残る。",
        x: 0.55,
        y: 0.45,
        walkMinutes: 8,
      },
      {
        id: "shimosuwa-r",
        name: "足湯のふち",
        genre: "odd",
        guide: "rest",
        hours: "施設による（おおよそ 9:00〜21:00）",
        blurb:
          "靴を脱いだ瞬間、予定がひとつ減る。湖風の手前の休み。",
        x: 0.5,
        y: 0.48,
        walkMinutes: 9,
      },
      {
        id: "shimosuwa-t",
        name: "湯けむりの角",
        genre: "history",
        guide: "tip",
        hours: "終日（町並み）",
        blurb:
          "湯気の向きで道順がわかる。中山道の名残が足元に残る。",
        x: 0.46,
        y: 0.52,
        walkMinutes: 7,
      },

      {
        id: "shimosuwa-s1",
        name: "諏訪大社下社秋宮",
        genre: "history",
        guide: "sight",
        hours: "境内は日中（社務所時間は要確認）",
        blurb: "下諏訪の信仰の核。温泉街から歩いて社殿へ入り、銅造りの鳥居と境内の静けさを見る。",
        x: 0.55,
        y: 0.35,
        walkMinutes: 12,
        secretWorthy: true,
      },
      {
        id: "shimosuwa-s2",
        name: "万治の石仏",
        genre: "history",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "川沿いの巨石に彫られた仏。温泉街の端で、湯けむりとは別の時間に触れる観光地。",
        x: 0.42,
        y: 0.48,
        walkMinutes: 15,
      },
      {
        id: "shimosuwa-s3",
        name: "下諏訪宿・高木屋敷周辺",
        genre: "history",
        guide: "sight",
        hours: "外観は終日／内部公開は案内に準拠",
        blurb: "中山道の宿場の名残。石畳と蔵の町並みを、足湯のあいだに一本歩く。",
        x: 0.5,
        y: 0.5,
        walkMinutes: 8,
      },],
  },
  {
    id: "yui",
    name: "由比",
    line: "東海道本線",
    prefecture: "静岡",
    region: "中部",
    mood: "story",
    radiiKm: [1.0, 2.1, 2.9],
    stationIntro:
      "東海道本線の桜えびの町。海と山に挟まれた狭さが、かえって濃いです。",
    bikeRental: {
      available: false,
      summary:
        "宿場町は徒歩向き。海岸寄りは風が強い日あり。",
    },
    tourTitle: "桜えびの町で、海と山のあいだを歩く",
    catchCopy: "東海道の狭さが、かえって町を濃くする。",
    spots: [
      {
        id: "yui-1",
        name: "宿場の名残",
        genre: "history",
        guide: "sight",
        hours: "終日（町並み）",
        blurb: "道幅が、馬と人の距離を今も測っている。",
        x: 0.45,
        y: 0.5,
        walkMinutes: 5,
      },
      {
        id: "yui-2",
        name: "ごはん屋さくら",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥2,000",
        mealTimes: ["lunch"],
        hours: "11:00〜14:30 / 17:00〜20:00（火曜定休・漁期で混雑）",
        blurb: "由比駅近くの桜えび店。静岡てんこ盛り丼や桜えび定食で、港の味をそのまま置く。",
        x: 0.62,
        y: 0.42,
        walkMinutes: 8,
        secretWorthy: true,
      },
      {
        id: "yui-3",
        name: "海岸の消波ブロック",
        genre: "odd",
        hours: "終日（屋外）",
        blurb: "景色としては地味だが、風の感触は一級。",
        x: 0.7,
        y: 0.62,
        walkMinutes: 12,
      },
    
      {
        id: "yui-s",
        name: "桜えびの小袋",
        genre: "gourmet",
        guide: "souvenir",
        hours: "店による（おおよそ 9:00〜17:00）",
        blurb:
          "香ばしさを、袋のまま持ち帰る。東海道の狭い町の土産。",
        x: 0.6,
        y: 0.44,
        walkMinutes: 8,
      },
      {
        id: "yui-r",
        name: "宿場の縁側っぽい影",
        genre: "history",
        guide: "rest",
        hours: "終日（屋外）",
        blurb:
          "道幅が狭くて、影が休憩になる。馬と人の距離を今も測る場所。",
        x: 0.45,
        y: 0.5,
        walkMinutes: 5,
      },

      {
        id: "yui-s1",
        name: "由比漁港",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "桜えびで知られる港。駅から海岸へ出て、漁船と防波堤が由比の観光の一枚目になる。",
        x: 0.6,
        y: 0.55,
        walkMinutes: 10,
      },
      {
        id: "yui-s2",
        name: "東海道広重美術館",
        genre: "history",
        guide: "sight",
        hours: "9:00〜17:00（水曜定休）",
        blurb: "東海道の浮世絵を集めた美術館。宿場の名残と海のあいだで、由比の文化の厚みを補う。",
        x: 0.48,
        y: 0.4,
        walkMinutes: 8,
      },
      {
        id: "yui-s3",
        name: "薩埵峠入口（由比側）",
        genre: "nature",
        guide: "sight",
        hours: "終日（登山道・天候注意）",
        blurb: "広重も描いた峠への入口。半日あれば峠まで、短時間なら入口の海望だけでも観光地になる。",
        x: 0.7,
        y: 0.35,
        walkMinutes: 30,
      },],
  },
  {
    id: "nebukawa",
    name: "根府川",
    line: "東海道本線",
    prefecture: "神奈川",
    region: "関東",
    mood: "empty",
    radiiKm: [0.9, 1.8, 2.5],
    stationIntro:
      "東海道線の崖と海のあいだ。用事のない駅が、いちばん海に近いことがあります。",
    bikeRental: {
      available: false,
      summary:
        "急傾斜のため徒歩のみ想定。自転車向きではありません。",
    },
    tourTitle: "崖と海のあいだの、短い余白",
    catchCopy: "乗り換えも用事もない駅が、いちばん海に近い。",
    emptyCopy: {
      headline: "ホームから見える相模灘",
      body: "ここに「観光」は少ない。電車が去ったあとの静けさと、波音だけで十分に贅沢です。",
    },
    spots: [
      {
        id: "nebukawa-1",
        name: "海側のホーム端",
        genre: "nature",
        guide: "sight",
        hours: "列車運行時間内（ホーム）",
        blurb: "柵の向こうに、青だけがある。",
        x: 0.55,
        y: 0.45,
        walkMinutes: 1,
        secretWorthy: true,
      },
      {
        id: "nebukawa-2",
        name: "トンネル脇の小道",
        genre: "odd",
        hours: "終日（屋外）",
        blurb: "列車の風が、一瞬だけ通り過ぎる。",
        x: 0.35,
        y: 0.58,
        walkMinutes: 6,
      },
    
      {
        id: "nebukawa-r",
        name: "海側ホームの腰",
        genre: "nature",
        guide: "rest",
        hours: "列車運行時間内（ホーム）",
        blurb:
          "柵の向こうの青を、座って見る。観光リストは短くていい。",
        x: 0.55,
        y: 0.45,
        walkMinutes: 1,
      },
      {
        id: "nebukawa-s",
        name: "駅の入場券の記憶",
        genre: "odd",
        guide: "souvenir",
        hours: "窓口・券売による",
        blurb:
          "買うものがない日の土産は、駅名そのもの。紙片でも十分。",
        x: 0.5,
        y: 0.5,
        walkMinutes: 1,
      },

      {
        id: "nebukawa-s1",
        name: "根府川海岸",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "駅から海へ下りる短い道。ホームの眺めを、砂利と波音の海岸まで下ろして味わう。",
        x: 0.55,
        y: 0.65,
        walkMinutes: 8,
        secretWorthy: true,
      },
      {
        id: "nebukawa-s2",
        name: "根府川駅・海側ホームの眺望",
        genre: "nature",
        guide: "sight",
        hours: "列車運行時間内",
        blurb: "この駅の観光はホームそのもの。相模湾が眼前にひらけ、降りた理由が景色だけで足りる。",
        x: 0.5,
        y: 0.5,
        walkMinutes: 1,
      },],
  },
  {
    id: "amarube",
    name: "餘部",
    line: "山陰本線",
    prefecture: "兵庫",
    region: "近畿",
    mood: "story",
    radiiKm: [1.0, 2.2, 3.0],
    stationIntro:
      "山陰本線、鉄橋の見える駅。橋を見るために降りても、町の静けさまで連れていかれます。",
    bikeRental: {
      available: false,
      summary:
        "丘と海風の徒歩圏。レンタサイクルは近隣で要確認です。",
    },
    tourTitle: "鉄橋の影と、日本海の風を分ける",
    catchCopy: "橋を見るために降りても、町の静けさまで連れていかれる。",
    spots: [
      {
        id: "amarube-1",
        name: "旧橋の見える丘",
        genre: "history",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "新しい橋と古い脚が、同じ景色に並ぶ。",
        x: 0.42,
        y: 0.4,
        walkMinutes: 12,
      },
      {
        id: "amarube-2",
        name: "空の駅 餘部",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥800",
        mealTimes: ["lunch", "dinner"],
        hours: "9:00〜17:00（季節により前後）",
        blurb: "餘部鉄橋の展望施設にある売店・軽食。橋を見たあとに珈琲と地元のお菓子を置ける。",
        x: 0.55,
        y: 0.55,
        walkMinutes: 3,
        secretWorthy: true,
      },
      {
        id: "amarube-3",
        name: "海風の通り道",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "帽子を押さえる動作が、観光になる。",
        x: 0.68,
        y: 0.35,
        walkMinutes: 10,
      },
    
      {
        id: "amarube-s",
        name: "橋のポストカード",
        genre: "history",
        guide: "souvenir",
        hours: "店による（おおよそ 10:00〜17:00）",
        blurb:
          "新しい橋と古い脚が、同じ絵葉書に並ぶ。軽い土産。",
        x: 0.5,
        y: 0.5,
        walkMinutes: 5,
      },
      {
        id: "amarube-r",
        name: "丘の風よけ",
        genre: "nature",
        guide: "rest",
        hours: "終日（屋外）",
        blurb:
          "帽子を押さえる動作が、観光になる場所。座れる石があれば十分。",
        x: 0.45,
        y: 0.38,
        walkMinutes: 12,
      },
      {
        id: "amarube-t",
        name: "駅前の短い坂",
        genre: "odd",
        guide: "tip",
        hours: "終日（屋外）",
        blurb:
          "橋の話が聞こえるまで、三歩で足りる寄り道。",
        x: 0.55,
        y: 0.52,
        walkMinutes: 2,
      },

      {
        id: "amarube-s1",
        name: "餘部鉄橋（橋梁・展望施設）",
        genre: "history",
        guide: "sight",
        hours: "展望施設は概ね日中（季節により前後）",
        blurb: "空の駅の名の由来。旧橋と新橋を同時に見下ろす、餘部の観光の本丸。",
        x: 0.5,
        y: 0.45,
        walkMinutes: 5,
        secretWorthy: true,
      },
      {
        id: "amarube-s2",
        name: "餘部崎の海岸展望",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外・強風注意）",
        blurb: "鉄橋を見たあとに海へ降りる道。日本海の風が、橋の高さの記憶を身体に残す。",
        x: 0.6,
        y: 0.6,
        walkMinutes: 15,
      },],
  },
  {
    id: "onomichi",
    name: "尾道",
    line: "山陽本線",
    prefecture: "広島",
    region: "中国",
    mood: "story",
    radiiKm: [1.1, 2.2, 3.0],
    stationIntro:
      "山陽本線の坂の町。上るほどに町が薄くなり、海が近づきます。",
    bikeRental: {
      available: false,
      summary:
        "坂が多いため徒歩向き。平地の商店街〜港はレンタサイクル向きな日もあります。",
    },
    tourTitle: "坂と猫と、古い映画館の気配",
    catchCopy: "上るほどに町が薄くなり、海が近づく。",
    spots: [
      {
        id: "onomichi-1",
        name: "商店街のアーチ",
        genre: "history",
        guide: "sight",
        hours: "店による（おおよそ 9:00〜19:00）",
        blurb: "影の濃さが、午後の長さを測ってくれる。",
        x: 0.45,
        y: 0.55,
        walkMinutes: 5,
      },
      {
        id: "onomichi-2",
        name: "尾道浪漫珈琲 駅前店",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥800",
        mealTimes: ["morning", "lunch"],
        hours: "8:30〜18:00（元日休み）",
        blurb: "尾道駅から徒歩数分の自家焙煎。窓から尾道水道を見ながら一杯置き、豆も袋で持ち帰れる。",
        x: 0.7,
        y: 0.45,
        walkMinutes: 12,
        secretWorthy: true,
      },
      {
        id: "onomichi-3",
        name: "寺の石畳",
        genre: "history",
        guide: "sight",
        hours: "終日（境内は日中が安心）",
        blurb: "坂の途中で、息を整える場所として寺がある。",
        x: 0.32,
        y: 0.3,
        walkMinutes: 16,
      },
      {
        id: "onomichi-4",
        name: "猫のたまり場",
        genre: "odd",
        hours: "終日（屋外）",
        blurb: "観光名所ではない。でも町の住民が確かここにいる。",
        x: 0.58,
        y: 0.68,
        walkMinutes: 8,
      },
      {
        id: "onomichi-5",
        name: "崖の空き地から見る瀬戸",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "名前のない場所から、いちばん海が近い。",
        x: 0.22,
        y: 0.6,
        walkMinutes: 20,
      },
    
      {
        id: "onomichi-beans",
        name: "尾道浪漫珈琲の豆",
        genre: "gourmet",
        guide: "souvenir",
        hours: "8:30〜18:00（元日休み・店舗により前後）",
        blurb:
          "駅前店や本店で買える自家焙煎の豆。水道を見たあとに、香りだけ持ち帰る土産。",
        detail:
          "ブレンドや挽き具合は店で相談できることが多い。重い瓶より袋の豆が旅向きです。",
        x: 0.68,
        y: 0.46,
        walkMinutes: 12,
      },
      {
        id: "onomichi-s",
        name: "猫の小さな雑貨",
        genre: "odd",
        guide: "souvenir",
        hours: "店による（おおよそ 10:00〜18:00）",
        blurb:
          "町の住民（猫）を模した軽い土産。坂の途中で見つかる。",
        x: 0.55,
        y: 0.6,
        walkMinutes: 9,
      },
      {
        id: "onomichi-r",
        name: "寺の石段の踊り場",
        genre: "history",
        guide: "rest",
        hours: "終日（境内は日中が安心）",
        blurb:
          "息を整える場所として寺がある。海を見下ろす前の一休み。",
        x: 0.34,
        y: 0.32,
        walkMinutes: 16,
      },

      {
        id: "onomichi-s1",
        name: "千光寺公園ロープウェイ山麓駅",
        genre: "nature",
        guide: "sight",
        hours: "ロープウェイ運行時間内",
        blurb: "尾道水道を見下ろす山へ上がる入口。駅から商店街を抜け、坂の町の観光の軸になる。",
        x: 0.55,
        y: 0.35,
        walkMinutes: 15,
        secretWorthy: true,
      },
      {
        id: "onomichi-s2",
        name: "艮神社〜文学のこみち",
        genre: "history",
        guide: "sight",
        hours: "屋外終日",
        blurb: "猫と寺と坂が重なる尾道らしい一本道。商店街から山側へ入ると、すぐに観光地の密度が上がる。",
        x: 0.52,
        y: 0.42,
        walkMinutes: 12,
      },
      {
        id: "onomichi-s3",
        name: "尾道水道の岸壁",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "向島を隔てる狭い海峡。フェリーと漁船が行き交う水面が、この町の観光の水平線になる。",
        x: 0.65,
        y: 0.55,
        walkMinutes: 8,
      },],
  },
  {
    id: "misumi",
    name: "三角",
    line: "三角線",
    prefecture: "熊本",
    region: "九州",
    mood: "story",
    radiiKm: [1.2, 2.4, 3.1],
    stationIntro:
      "三角線の終点。明治の港町が、線路の終わる場所から始まります。",
    bikeRental: {
      available: false,
      summary:
        "港町は平坦で自転車向きな区間あり。貸出は観光案内で要確認。",
    },
    tourTitle: "明治の港町を、終点の駅から歩く",
    catchCopy: "線路が終わる場所で、町の物語が始まる。",
    spots: [
      {
        id: "misumi-1",
        name: "煉瓦造りの港湾施設",
        genre: "history",
        guide: "sight",
        hours: "外観は終日（館内は施設による）",
        blurb: "西の港の記憶が、壁の厚みに残る。",
        x: 0.55,
        y: 0.45,
        walkMinutes: 10,
      },
      {
        id: "misumi-2",
        name: "Rest＆Cafe 海の隠れ家",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥1,500",
        mealTimes: ["lunch", "dinner"],
        hours: "11:00〜16:00（店休日あり・要確認）",
        blurb: "三角西港寄りの海辺カフェ。天草五橋を眺めながら定食やパフェで一休み。",
        x: 0.4,
        y: 0.55,
        walkMinutes: 8,
        secretWorthy: true,
      },
      {
        id: "misumi-3",
        name: "突堤の先端",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "天草への海が、ここで一度止まる。",
        x: 0.72,
        y: 0.38,
        walkMinutes: 15,
      },
    
      {
        id: "misumi-s",
        name: "煉瓦色の小さな土産",
        genre: "history",
        guide: "souvenir",
        hours: "店による（おおよそ 9:00〜17:00）",
        blurb:
          "港の記憶を、軽い紙や菓子で持ち帰る。",
        x: 0.52,
        y: 0.48,
        walkMinutes: 9,
      },
      {
        id: "misumi-r",
        name: "突堤の腰かけ",
        genre: "nature",
        guide: "rest",
        hours: "終日（屋外）",
        blurb:
          "天草への海が、ここで一度止まる。風除けになって座る。",
        x: 0.7,
        y: 0.4,
        walkMinutes: 15,
      },
      {
        id: "misumi-t",
        name: "終点の車止め",
        genre: "odd",
        guide: "tip",
        hours: "終日（屋外）",
        blurb:
          "線路が終わる感触だけ見に来る寄り道。",
        x: 0.48,
        y: 0.52,
        walkMinutes: 2,
      },

      {
        id: "misumi-s1",
        name: "三角西港",
        genre: "history",
        guide: "sight",
        hours: "屋外終日／施設は個別開館",
        blurb: "明治の重要文化的景観。煉瓦と石積みの港湾が、終点の駅から歩いてすぐの観光地の芯。",
        x: 0.45,
        y: 0.5,
        walkMinutes: 10,
        secretWorthy: true,
      },
      {
        id: "misumi-s2",
        name: "旧高木家住宅",
        genre: "history",
        guide: "sight",
        hours: "開館日・時間は案内に準拠",
        blurb: "西港を見守ってきた商家。港の石畳とセットで見る、三角の近代の暮らしの断面。",
        x: 0.48,
        y: 0.48,
        walkMinutes: 12,
      },],
  },
  {
    id: "usuki",
    name: "臼杵",
    line: "日豊本線",
    prefecture: "大分",
    region: "九州",
    mood: "story",
    radiiKm: [1.1, 2.3, 3.0],
    stationIntro:
      "日豊本線の石仏と城下の町。フグで有名でも、路地の方が長く残ります。",
    bikeRental: {
      available: false,
      summary:
        "城下町歩き向けのレンタサイクルがあることがあります。要確認。",
    },
    tourTitle: "石仏の町の、城下の静けさを拾う",
    catchCopy: "フグで有名でも、路地の方が長く残る。",
    spots: [
      {
        id: "usuki-1",
        name: "二王座歴史の道",
        genre: "history",
        guide: "sight",
        hours: "終日（町並み）",
        blurb: "白い壁が、歩く速度を落とさせる。",
        x: 0.45,
        y: 0.48,
        walkMinutes: 12,
      },
      {
        id: "usuki-2",
        name: "茶房 長屋門",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥1,200",
        mealTimes: ["morning", "lunch"],
        hours: "11:00〜18:00（水曜定休）",
        blurb: "二王座の武家屋敷寄りの喫茶。庭を見ながら抹茶セットで、城下町歩きの一休み。",
        x: 0.58,
        y: 0.4,
        walkMinutes: 9,
        secretWorthy: true,
      },
      {
        id: "usuki-3",
        name: "港寄りの空き地",
        genre: "odd",
        hours: "終日（屋外）",
        blurb: "用事のない場所が、いちばん写真になる。",
        x: 0.7,
        y: 0.62,
        walkMinutes: 14,
      },
    
      {
        id: "usuki-s",
        name: "石仏の小さな守り",
        genre: "history",
        guide: "souvenir",
        hours: "店による（おおよそ 9:00〜17:00）",
        blurb:
          "重い歴史を、軽い守り札で持ち帰る。",
        x: 0.5,
        y: 0.45,
        walkMinutes: 11,
      },
      {
        id: "usuki-r",
        name: "白い壁の影",
        genre: "history",
        guide: "rest",
        hours: "終日（町並み）",
        blurb:
          "二王座の壁が、歩く速度を落とさせる。その影が休憩席。",
        x: 0.45,
        y: 0.48,
        walkMinutes: 12,
      },

      {
        id: "usuki-s1",
        name: "臼杵石仏",
        genre: "history",
        guide: "sight",
        hours: "9:00〜17:00（季節により前後）",
        blurb: "崖に彫られた石仏群。駅から少し歩くが、臼杵観光の第一目的になりやすい国宝級の見どころ。",
        x: 0.7,
        y: 0.35,
        walkMinutes: 30,
        secretWorthy: true,
      },
      {
        id: "usuki-s2",
        name: "臼杵城跡",
        genre: "history",
        guide: "sight",
        hours: "公園は終日",
        blurb: "城下町の丘に残る石垣と堀。二王座へ向かう前後に、町の防御の形を上から見渡す。",
        x: 0.5,
        y: 0.45,
        walkMinutes: 12,
      },],
  },
  {
    id: "hitoyoshi",
    name: "人吉",
    line: "肥薩線",
    prefecture: "熊本",
    region: "九州",
    mood: "story",
    radiiKm: [1.2, 2.4, 3.2],
    stationIntro:
      "肥薩線の球磨川の町。復興の途中でも、川は変わらず中心にいます。",
    bikeRental: {
      available: false,
      summary:
        "川沿い散策向けのレンタサイクルがあることがあります。観光案内で確認を。",
    },
    tourTitle: "球磨川の音と、温泉町の湯気をたどる",
    catchCopy: "復興の途中でも、川は変わらず町の中心。",
    spots: [
      {
        id: "hitoyoshi-1",
        name: "駅前の温泉街入口",
        genre: "history",
        guide: "sight",
        hours: "終日（町並み・施設は個別）",
        blurb: "湯けむりの向きが、道標になる。",
        x: 0.5,
        y: 0.5,
        walkMinutes: 5,
      },
      {
        id: "hitoyoshi-2",
        name: "川辺のベンチ",
        genre: "nature",
        guide: "rest",
        hours: "終日（屋外）",
        blurb: "急がなくていい景色が、ここに座っている。",
        x: 0.35,
        y: 0.4,
        walkMinutes: 10,
        secretWorthy: true,
      },
      {
        id: "hitoyoshi-3",
        name: "繊月酒造",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥1,000",
        mealTimes: ["lunch", "dinner"],
        hours: "9:00〜16:30（見学無料・無休）",
        blurb: "人吉駅から徒歩圏の球磨焼酎蔵。試飲室で銘柄を比べてから、瓶を手土産にできる。",
        x: 0.65,
        y: 0.58,
        walkMinutes: 12,
      },
    
      {
        id: "hitoyoshi-s",
        name: "焼酎の小さな瓶",
        genre: "gourmet",
        guide: "souvenir",
        hours: "店による（おおよそ 9:00〜17:00）",
        blurb:
          "香りだけでも訪問になる蔵の町。軽い瓶は手土産向き。",
        x: 0.62,
        y: 0.55,
        walkMinutes: 12,
      },
      {
        id: "hitoyoshi-t",
        name: "湯けむりの入口",
        genre: "history",
        guide: "tip",
        hours: "終日（町並み）",
        blurb:
          "湯気の向きが道標。温泉街への最初の一歩。",
        x: 0.5,
        y: 0.5,
        walkMinutes: 5,
      },

      {
        id: "hitoyoshi-s1",
        name: "人吉城跡",
        genre: "history",
        guide: "sight",
        hours: "公園は終日",
        blurb: "球磨川を望む城跡。温泉街から歩いて石垣へ上がると、人吉盆地の観光の見取り図が見える。",
        x: 0.55,
        y: 0.4,
        walkMinutes: 15,
        secretWorthy: true,
      },
      {
        id: "hitoyoshi-s2",
        name: "青井阿蘇神社",
        genre: "history",
        guide: "sight",
        hours: "境内は日中",
        blurb: "国宝の社殿を持つ人吉の守り神。温泉と川の町のなかで、木鼻と朱のコントラストが印象に残る。",
        x: 0.48,
        y: 0.5,
        walkMinutes: 12,
      },
      {
        id: "hitoyoshi-s3",
        name: "球磨川くだり乗り場周辺",
        genre: "nature",
        guide: "sight",
        hours: "乗船は運航シーズンに準拠／岸は終日",
        blurb: "川下り船の発着場まわり。乗らなくても、急流の音と河原の広さが観光地の空気をつくる。",
        x: 0.6,
        y: 0.55,
        walkMinutes: 10,
      },],
  },
  {
    id: "tsukazaki",
    name: "月崎",
    line: "小湊鐵道",
    prefecture: "千葉",
    region: "関東",
    mood: "empty",
    radiiKm: [0.8, 1.6, 2.2],
    stationIntro:
      "小湊鐵道の山あい。ワンマンの扉が閉まると、世界が一段階静かになります。",
    bikeRental: {
      available: false,
      summary:
        "山道のため徒歩想定。自転車向きではありません。",
    },
    tourTitle: "誰もいないホームで、山の気配だけ受け取る",
    catchCopy: "ワンマンの扉が閉まると、世界が一段階静かになる。",
    emptyCopy: {
      headline: "山あいの静けさを、そのまま味わう",
      body: "スポット一覧は短くていい。ここは「何をしに来たか」より「降りてよかった」が先に来る駅です。",
    },
    spots: [
      {
        id: "tsukazaki-1",
        name: "無人のホーム",
        genre: "nature",
        guide: "sight",
        hours: "列車運行時間内（ホーム）",
        blurb: "虫の声が、発車メロディの代わり。",
        x: 0.5,
        y: 0.48,
        walkMinutes: 1,
        secretWorthy: true,
      },
      {
        id: "tsukazaki-2",
        name: "踏切の向こうの林",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "道は続いているが、用事はここで足りる。",
        x: 0.38,
        y: 0.6,
        walkMinutes: 7,
      },
    
      {
        id: "tsukazaki-r",
        name: "無人ホームの縁",
        genre: "nature",
        guide: "rest",
        hours: "列車運行時間内（ホーム）",
        blurb:
          "虫の声が発車メロディの代わり。座って、山の気配だけ受け取る。",
        x: 0.5,
        y: 0.48,
        walkMinutes: 1,
      },
      {
        id: "tsukazaki-t",
        name: "踏切の向こう一分",
        genre: "odd",
        guide: "tip",
        hours: "終日（屋外）",
        blurb:
          "道は続いているが、用事はここで足りる。",
        x: 0.4,
        y: 0.58,
        walkMinutes: 7,
      },

      {
        id: "tsukazaki-s1",
        name: "小湊鐵道・月崎の車窓風景",
        genre: "nature",
        guide: "sight",
        hours: "列車運行時間内",
        blurb: "この駅の観光は、降りたあとの余白と、やってきた車窓の続き。林と踏切のあいだに名所看板は少ない。",
        x: 0.5,
        y: 0.5,
        walkMinutes: 2,
      },
      {
        id: "tsukazaki-s2",
        name: "養老渓谷方面への県道の入口",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "隣の観光地へ続く道の手前。半日あれば渓谷へ、短時間なら入口の木立だけを見る寄り道。",
        x: 0.4,
        y: 0.4,
        walkMinutes: 15,
      },],
  },
  {
    id: "tamatsukuri",
    name: "玉造温泉",
    line: "山陰本線",
    prefecture: "島根",
    region: "中国",
    mood: "story",
    radiiKm: [1.0, 2.1, 2.9],
    stationIntro:
      "山陰本線の神話の湯の町。玉造の名は大きく、路地はちょうどいい大きさです。",
    bikeRental: {
      available: false,
      summary:
        "温泉街は徒歩向き。平坦部のレンタサイクルは案内所で要確認。",
    },
    tourTitle: "神話の湯の町を、駅からゆるく一周",
    catchCopy: "玉造の名は大きく、路地はちょうどいい大きさ。",
    spots: [
      {
        id: "tamatsukuri-1",
        name: "温泉街の石畳",
        genre: "history",
        guide: "sight",
        hours: "終日（町並み）",
        blurb: "足裏の感触が、すでに湯治の入口。",
        x: 0.48,
        y: 0.5,
        walkMinutes: 8,
      },
      {
        id: "tamatsukuri-2",
        name: "川沿いの足湯",
        genre: "odd",
        hours: "施設による（おおよそ 9:00〜21:00・要確認）",
        blurb: "靴を脱いだ瞬間、旅の予定がひとつ減る。",
        x: 0.6,
        y: 0.4,
        walkMinutes: 10,
        secretWorthy: true,
      },
      {
        id: "tamatsukuri-3",
        name: "小さな神社の鳥居",
        genre: "history",
        guide: "sight",
        hours: "終日（境内は日中が安心）",
        blurb: "観光の本線から、半歩だけ外れている。",
        x: 0.35,
        y: 0.62,
        walkMinutes: 12,
      },
    
      {
        id: "tamatsukuri-m",
        name: "ケーキハウス アガート",
        genre: "gourmet",
        guide: "meal",
        mealTier: "casual",
        soloOk: true,
        budgetYen: "〜¥800",
        mealTimes: ["lunch"],
        hours: "10:00〜18:00（月曜定休・祝日は翌日）",
        blurb:
          "玉造温泉街のケーキ屋。ご当地スイーツと珈琲で、湯上がりの甘い寄り道。",
        x: 0.55,
        y: 0.45,
        walkMinutes: 9,
      },
      {
        id: "tamatsukuri-s",
        name: "勾玉の小さな守り",
        genre: "history",
        guide: "souvenir",
        hours: "店による（おおよそ 9:00〜18:00）",
        blurb:
          "神話の町の軽い土産。紙袋に入る大きさ。",
        x: 0.5,
        y: 0.52,
        walkMinutes: 8,
      },
      {
        id: "tamatsukuri-r",
        name: "川沿いの足湯",
        genre: "odd",
        guide: "rest",
        hours: "施設による（おおよそ 9:00〜21:00・要確認）",
        blurb:
          "靴を脱いだ瞬間、旅の予定がひとつ減る。",
        x: 0.6,
        y: 0.4,
        walkMinutes: 10,
      },

      {
        id: "tamatsukuri-s1",
        name: "玉造温泉街の石畳通り",
        genre: "history",
        guide: "sight",
        hours: "屋外終日／店は個別営業",
        blurb: "神話の湯として知られる温泉街。駅から石畳に入ると、すぐに観光地の密度と湯けむりが重なる。",
        x: 0.5,
        y: 0.48,
        walkMinutes: 6,
      },
      {
        id: "tamatsukuri-s2",
        name: "玉造稲荷神社",
        genre: "history",
        guide: "sight",
        hours: "境内は日中",
        blurb: "温泉街の守り神。湯上りの足で寄れる距離に、朱色と石段の観光地がある。",
        x: 0.45,
        y: 0.4,
        walkMinutes: 10,
      },
      {
        id: "tamatsukuri-s3",
        name: "勾玉橋まわりの川筋",
        genre: "nature",
        guide: "sight",
        hours: "終日（屋外）",
        blurb: "温泉街を流れる川と橋。足湯とあわせて、玉造の「見る」観光の水平線になる。",
        x: 0.55,
        y: 0.52,
        walkMinutes: 8,
      },],
  },
];

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
