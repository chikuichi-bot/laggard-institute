export type SpotGenre =
  | "history"
  | "gourmet"
  | "nature"
  | "odd";

export type Spot = {
  id: string;
  name: string;
  genre: SpotGenre;
  blurb: string;
  /** 0–1 relative map position */
  x: number;
  y: number;
  walkMinutes: number;
  secretWorthy?: boolean;
};

export type StationMood = "story" | "empty";

export type StationSeed = {
  id: string;
  name: string;
  line: string;
  prefecture: string;
  mood: StationMood;
  /** radius km for 1h / 3h / half-day */
  radiiKm: [number, number, number];
  tourTitle: string;
  catchCopy: string;
  emptyCopy?: {
    headline: string;
    body: string;
  };
  spots: Spot[];
};

export const GENRE_LABEL: Record<SpotGenre, string> = {
  history: "歴史・文化",
  gourmet: "ローカルグルメ",
  nature: "自然・公園",
  odd: "ちょっと変わった",
};

export const TIME_OPTIONS = [
  { id: "1h", label: "1時間", index: 0 as const },
  { id: "3h", label: "3時間", index: 1 as const },
  { id: "half", label: "半日", index: 2 as const },
] as const;

export type TimeOptionId = (typeof TIME_OPTIONS)[number]["id"];

export const STATIONS: StationSeed[] = [
  {
    id: "kobuchizawa",
    name: "小淵沢",
    line: "中央本線",
    prefecture: "山梨",
    mood: "story",
    radiiKm: [1.2, 2.4, 3.2],
    tourTitle: "高原の風と自家焙煎を巡る、レトロ駅前散歩",
    catchCopy: "乗り換えの合間に、山の匂いだけ持ち帰れる駅。",
    spots: [
      {
        id: "k1",
        name: "駅舎の待合室",
        genre: "history",
        blurb: "木の椅子と掲示板。発車までの余白が残っている。",
        x: 0.48,
        y: 0.52,
        walkMinutes: 1,
      },
      {
        id: "k2",
        name: "純喫茶アサヒ",
        genre: "gourmet",
        blurb: "深煎りの香ばしさと、トーストの角。地元の朝の文法。",
        x: 0.62,
        y: 0.4,
        walkMinutes: 8,
        secretWorthy: true,
      },
      {
        id: "k3",
        name: "並木の一筋",
        genre: "nature",
        blurb: "線路沿いに続く並木。風の向きで景色が変わる。",
        x: 0.3,
        y: 0.35,
        walkMinutes: 12,
      },
      {
        id: "k4",
        name: "古い看板の boeuf",
        genre: "odd",
        blurb: "読めないほど褪せた看板だけが、昔の店を覚えている。",
        x: 0.72,
        y: 0.62,
        walkMinutes: 15,
      },
      {
        id: "k5",
        name: "神社の石段",
        genre: "history",
        blurb: "短い石段の先に、町の静けさがたまっている。",
        x: 0.38,
        y: 0.7,
        walkMinutes: 18,
      },
    ],
  },
  {
    id: "manazuru",
    name: "真鶴",
    line: "東海道本線",
    prefecture: "神奈川",
    mood: "story",
    radiiKm: [1.0, 2.0, 3.0],
    tourTitle: "岬の坂道と石材の匂いをたどる半日",
    catchCopy: "海が見えなくても、町はすでに潮の匂いがする。",
    spots: [
      {
        id: "m1",
        name: "駅前の石屋跡",
        genre: "history",
        blurb: "真鶴の石が、建材になる前の姿を想像させる。",
        x: 0.5,
        y: 0.48,
        walkMinutes: 3,
      },
      {
        id: "m2",
        name: "港寄りの定食屋",
        genre: "gourmet",
        blurb: "日替わりが、今日の海の機嫌を教えてくれる。",
        x: 0.68,
        y: 0.58,
        walkMinutes: 14,
        secretWorthy: true,
      },
      {
        id: "m3",
        name: "雑木の公園",
        genre: "nature",
        blurb: "ベンチひとつで十分な眺め。電車の音が遠い。",
        x: 0.28,
        y: 0.42,
        walkMinutes: 10,
      },
      {
        id: "m4",
        name: "坂の途中のポスト",
        genre: "odd",
        blurb: "誰かに宛てたわけでもない手紙を、置きたくなる場所。",
        x: 0.55,
        y: 0.28,
        walkMinutes: 11,
      },
    ],
  },
  {
    id: "biei",
    name: "美瑛",
    line: "富良野線",
    prefecture: "北海道",
    mood: "empty",
    radiiKm: [1.5, 2.8, 3.5],
    tourTitle: "見渡す限りの余白を、歩く",
    catchCopy: "観光地リストは空欄のまま、風景だけが厚い。",
    emptyCopy: {
      headline: "見渡す限りの田園と、風の音",
      body: "ここには「行く場所」より「いる場所」がある。ベンチも看板もいらない。空の広さを、時間の単位にしてください。",
    },
    spots: [
      {
        id: "b1",
        name: "駅前の空地",
        genre: "nature",
        blurb: "ただの空き地が、地平線の入口になる。",
        x: 0.5,
        y: 0.5,
        walkMinutes: 2,
        secretWorthy: true,
      },
      {
        id: "b2",
        name: "線路沿いの草道",
        genre: "nature",
        blurb: "踏切の向こう、草が靴を撫でる。",
        x: 0.35,
        y: 0.38,
        walkMinutes: 9,
      },
    ],
  },
  {
    id: "onomichi",
    name: "尾道",
    line: "山陽本線",
    prefecture: "広島",
    mood: "story",
    radiiKm: [1.1, 2.2, 3.0],
    tourTitle: "坂と猫と、古い映画館の気配",
    catchCopy: "上るほどに町が薄くなり、海が近づく。",
    spots: [
      {
        id: "o1",
        name: "商店街のアーチ",
        genre: "history",
        blurb: "影の濃さが、午後の長さを測ってくれる。",
        x: 0.45,
        y: 0.55,
        walkMinutes: 5,
      },
      {
        id: "o2",
        name: "港寄りの珈琲店",
        genre: "gourmet",
        blurb: "窓の外で船が動き、カップの中は動かない。",
        x: 0.7,
        y: 0.45,
        walkMinutes: 12,
        secretWorthy: true,
      },
      {
        id: "o3",
        name: "寺の石畳",
        genre: "history",
        blurb: "坂の途中で、息を整える場所として寺がある。",
        x: 0.32,
        y: 0.3,
        walkMinutes: 16,
      },
      {
        id: "o4",
        name: "猫のたまり場",
        genre: "odd",
        blurb: "観光名所ではない。でも町の住民が確かここにいる。",
        x: 0.58,
        y: 0.68,
        walkMinutes: 8,
      },
      {
        id: "o5",
        name: "崖の空き地から見る瀬戸",
        genre: "nature",
        blurb: "名前のない場所から、いちばん海が近い。",
        x: 0.22,
        y: 0.6,
        walkMinutes: 20,
      },
    ],
  },
];

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
