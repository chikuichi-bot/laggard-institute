export type SpotGenre = "history" | "gourmet" | "nature" | "odd";

/** 観光案内マップ用の見出し（必ず出す5種） */
export type GuideKind = "meal" | "souvenir" | "sight" | "rest" | "tip";

export type Spot = {
  id: string;
  name: string;
  genre: SpotGenre;
  /** 観光案内の分類。未指定なら genre から推定 */
  guide?: GuideKind;
  /** 営業・開館時間（わかるものだけ） */
  hours?: string;
  blurb: string;
  /** 0–1 relative map position */
  x: number;
  y: number;
  walkMinutes: number;
  secretWorthy?: boolean;
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
  /** エリアのいまの様子 */
  areaAbout?: string;
  /** 過去の歴史メモ */
  historyNotes?: AreaHistoryNote[];
  /** レンタサイクルの有無（未設定時は未確認として表示） */
  bikeRental?: BikeRentalInfo;
  tourTitle: string;
  catchCopy: string;
  emptyCopy?: {
    headline: string;
    body: string;
  };
  spots: Spot[];
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
  meal: "#ff6a3d",
  souvenir: "#d08aa8",
  sight: "#4f8f7a",
  rest: "#c4a35a",
  tip: "#7eb8c9",
};

export const GUIDE_ORDER: GuideKind[] = [
  "meal",
  "souvenir",
  "sight",
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
        blurb:
          "賀茂川と高野川が合う三角。治水と信仰が交わる地形の見所で、水音だけで土地の骨格がわかる。",
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
        blurb:
          "駅前の短いアーケード。市の名残をひきずる近所の商店街で、夕方に影が少し長くなる。",
        x: 0.55,
        y: 0.52,
        walkMinutes: 3,
      },
      {
        id: "demachi-3",
        name: "出町ふたば",
        genre: "gourmet",
        guide: "meal",
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
        blurb:
          "焼きたてパンと珈琲の老舗。学生街の昼はサンドイッチ定食が早い。",
        x: 0.78,
        y: 0.48,
        walkMinutes: 14,
      },
      {
        id: "demachi-5c",
        name: "枡形の揚げもの屋台まわり",
        genre: "gourmet",
        guide: "meal",
        blurb:
          "商店街でコロッケや唐揚げを袋買い。ベンチがなくても、川端で立ったまま昼になる。",
        x: 0.53,
        y: 0.54,
        walkMinutes: 4,
      },
      {
        id: "demachi-10",
        name: "鴨川デルタの川端",
        genre: "nature",
        guide: "rest",
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
        blurb:
          "御所の北東角に近い交差。出町の「都の外縁」だった距離感が、いまの街路にも残る。",
        x: 0.7,
        y: 0.65,
        walkMinutes: 14,
      },
      {
        id: "demachi-8",
        name: "枡形の紙もの・雑貨",
        genre: "history",
        guide: "souvenir",
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
        blurb:
          "枡形すぐの貸自転車。川と下鴨をひと続きで見るときの足になる寄り道。",
        x: 0.54,
        y: 0.53,
        walkMinutes: 3,
      },
    ],
  },
  {
    id: "biei",
    name: "美瑛",
    line: "富良野線",
    prefecture: "北海道",
    region: "北海道",
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
        id: "biei-1",
        name: "駅前の空地",
        genre: "nature",
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
        blurb: "踏切の向こう、草が靴を撫でる。",
        x: 0.35,
        y: 0.38,
        walkMinutes: 9,
      },
    ],
  },
  {
    id: "kanita",
    name: "蟹田",
    line: "津軽線",
    prefecture: "青森",
    region: "東北",
    mood: "story",
    radiiKm: [1.0, 2.0, 2.8],
    tourTitle: "海峡の手前で、風と定食を待つ",
    catchCopy: "フェリーの気配だけが、町の時計になっている。",
    spots: [
      {
        id: "kanita-1",
        name: "駅前の待合",
        genre: "history",
        blurb: "発車案内より、風の音が大きい。",
        x: 0.48,
        y: 0.52,
        walkMinutes: 1,
      },
      {
        id: "kanita-2",
        name: "港寄りの食堂",
        genre: "gourmet",
        blurb: "味噌汁の色が、今日の海を教えてくれる。",
        x: 0.66,
        y: 0.44,
        walkMinutes: 12,
        secretWorthy: true,
      },
      {
        id: "kanita-3",
        name: "防風林の切れ目",
        genre: "nature",
        blurb: "切れ目からだけ、水平線が見える。",
        x: 0.3,
        y: 0.36,
        walkMinutes: 15,
      },
    ],
  },
  {
    id: "ashio",
    name: "通洞",
    line: "わたらせ渓谷鐵道",
    prefecture: "栃木",
    region: "関東",
    mood: "story",
    radiiKm: [1.1, 2.2, 3.0],
    tourTitle: "銅山の影をたどる、谷あいの半日",
    catchCopy: "山の中腹に、産業の記憶が静かに残っている。",
    spots: [
      {
        id: "ashio-1",
        name: "木造駅舎",
        genre: "history",
        blurb: "天井の高さに、昔の人の背が残る。",
        x: 0.5,
        y: 0.5,
        walkMinutes: 1,
      },
      {
        id: "ashio-2",
        name: "渓流の見える橋",
        genre: "nature",
        blurb: "水音が、町の会話をひとつ減らす。",
        x: 0.28,
        y: 0.4,
        walkMinutes: 10,
      },
      {
        id: "ashio-3",
        name: "鉱山遺産の看板",
        genre: "odd",
        blurb: "説明文より、錆の色の方が雄弁。",
        x: 0.7,
        y: 0.58,
        walkMinutes: 14,
        secretWorthy: true,
      },
    ],
  },
  {
    id: "sawara",
    name: "佐原",
    line: "成田線",
    prefecture: "千葉",
    region: "関東",
    mood: "story",
    radiiKm: [1.2, 2.4, 3.2],
    tourTitle: "小野川沿いの蔵と、甘い香りを巡る",
    catchCopy: "水郷の町は、歩く速さに合わせて息をする。",
    spots: [
      {
        id: "sawara-1",
        name: "蔵造りの通り",
        genre: "history",
        blurb: "白壁の反射で、午後が長くなる。",
        x: 0.45,
        y: 0.48,
        walkMinutes: 8,
      },
      {
        id: "sawara-2",
        name: "川沿いの甘味処",
        genre: "gourmet",
        blurb: "舟の影が、あんみつの隣を通る。",
        x: 0.62,
        y: 0.38,
        walkMinutes: 12,
        secretWorthy: true,
      },
      {
        id: "sawara-3",
        name: "水門のたもと",
        genre: "nature",
        blurb: "水位を見るだけで、十分に用事になる。",
        x: 0.32,
        y: 0.62,
        walkMinutes: 15,
      },
      {
        id: "sawara-4",
        name: "古い消防の倉庫",
        genre: "odd",
        blurb: "扉は閉まっているのに、町の用心が残る。",
        x: 0.7,
        y: 0.55,
        walkMinutes: 9,
      },
    ],
  },
  {
    id: "manazuru",
    name: "真鶴",
    line: "東海道本線",
    prefecture: "神奈川",
    region: "関東",
    mood: "story",
    radiiKm: [1.0, 2.0, 3.0],
    tourTitle: "岬の坂道と石材の匂いをたどる半日",
    catchCopy: "海が見えなくても、町はすでに潮の匂いがする。",
    spots: [
      {
        id: "manazuru-1",
        name: "駅前の石屋跡",
        genre: "history",
        blurb: "真鶴の石が、建材になる前の姿を想像させる。",
        x: 0.5,
        y: 0.48,
        walkMinutes: 3,
      },
      {
        id: "manazuru-2",
        name: "港寄りの定食屋",
        genre: "gourmet",
        blurb: "日替わりが、今日の海の機嫌を教えてくれる。",
        x: 0.68,
        y: 0.58,
        walkMinutes: 14,
        secretWorthy: true,
      },
      {
        id: "manazuru-3",
        name: "雑木の公園",
        genre: "nature",
        blurb: "ベンチひとつで十分な眺め。電車の音が遠い。",
        x: 0.28,
        y: 0.42,
        walkMinutes: 10,
      },
      {
        id: "manazuru-4",
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
    id: "hamakanaya",
    name: "浜金谷",
    line: "内房線",
    prefecture: "千葉",
    region: "関東",
    mood: "story",
    radiiKm: [1.1, 2.3, 3.1],
    tourTitle: "鋸山のふもとで、海風と団子を分ける",
    catchCopy: "山を見上げるか、海を見るか。駅はどちらも手放さない。",
    spots: [
      {
        id: "hamakanaya-1",
        name: "駅前の案内板",
        genre: "history",
        blurb: "登山道と港の矢印が、同じ柱に同居している。",
        x: 0.5,
        y: 0.5,
        walkMinutes: 2,
      },
      {
        id: "hamakanaya-2",
        name: "港の売店",
        genre: "gourmet",
        blurb: "塩気が少し強い団子が、旅の正解になる。",
        x: 0.65,
        y: 0.6,
        walkMinutes: 8,
        secretWorthy: true,
      },
      {
        id: "hamakanaya-3",
        name: "防波堤の先端",
        genre: "nature",
        blurb: "東京湾の風が、帽子を試してくる。",
        x: 0.75,
        y: 0.45,
        walkMinutes: 14,
      },
    ],
  },
  {
    id: "nagatoro",
    name: "長瀞",
    line: "秩父鉄道",
    prefecture: "埼玉",
    region: "関東",
    mood: "story",
    radiiKm: [1.2, 2.5, 3.2],
    tourTitle: "岩畳の手前で、茶屋と川音を拾う",
    catchCopy: "観光の入口に立つだけで、すでに渓谷の一部。",
    spots: [
      {
        id: "nagatoro-1",
        name: "駅前の商店街",
        genre: "history",
        blurb: "のれんの間隔が、昔の歩幅を覚えている。",
        x: 0.48,
        y: 0.52,
        walkMinutes: 4,
      },
      {
        id: "nagatoro-2",
        name: "川辺の茶屋",
        genre: "gourmet",
        blurb: "湯気と川霧が、同じ高さで混ざる。",
        x: 0.6,
        y: 0.4,
        walkMinutes: 10,
        secretWorthy: true,
      },
      {
        id: "nagatoro-3",
        name: "岩の見える土手",
        genre: "nature",
        blurb: "岩畳まで行かなくても、川は十分に語る。",
        x: 0.35,
        y: 0.35,
        walkMinutes: 12,
      },
    ],
  },
  {
    id: "katsunuma",
    name: "勝沼ぶどう郷",
    line: "中央本線",
    prefecture: "山梨",
    region: "中部",
    mood: "story",
    radiiKm: [1.3, 2.6, 3.3],
    tourTitle: "葡萄棚のあいだを、駅からゆるく歩く",
    catchCopy: "線路の向こうに、季節の甘さが見える。",
    spots: [
      {
        id: "katsunuma-1",
        name: "葡萄の垣根",
        genre: "nature",
        blurb: "葉の隙間から、駅名の意味がわかる。",
        x: 0.4,
        y: 0.4,
        walkMinutes: 8,
      },
      {
        id: "katsunuma-2",
        name: "小さな醸造所の窓口",
        genre: "gourmet",
        blurb: "試飲の有無より、匂いだけで十分。",
        x: 0.62,
        y: 0.48,
        walkMinutes: 14,
        secretWorthy: true,
      },
      {
        id: "katsunuma-3",
        name: "古い農具の倉庫",
        genre: "odd",
        blurb: "観光用ではない道具が、いちばん正直。",
        x: 0.3,
        y: 0.62,
        walkMinutes: 11,
      },
    ],
  },
  {
    id: "kobuchizawa",
    name: "小淵沢",
    line: "中央本線",
    prefecture: "山梨",
    region: "中部",
    mood: "story",
    radiiKm: [1.2, 2.4, 3.2],
    tourTitle: "高原の風と自家焙煎を巡る、レトロ駅前散歩",
    catchCopy: "乗り換えの合間に、山の匂いだけ持ち帰れる駅。",
    spots: [
      {
        id: "kobuchizawa-1",
        name: "駅舎の待合室",
        genre: "history",
        blurb: "木の椅子と掲示板。発車までの余白が残っている。",
        x: 0.48,
        y: 0.52,
        walkMinutes: 1,
      },
      {
        id: "kobuchizawa-2",
        name: "純喫茶アサヒ",
        genre: "gourmet",
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
        blurb: "線路沿いに続く並木。風の向きで景色が変わる。",
        x: 0.3,
        y: 0.35,
        walkMinutes: 12,
      },
      {
        id: "kobuchizawa-4",
        name: "古い看板の店先",
        genre: "odd",
        blurb: "読めないほど褪せた看板だけが、昔の店を覚えている。",
        x: 0.72,
        y: 0.62,
        walkMinutes: 15,
      },
      {
        id: "kobuchizawa-5",
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
    id: "obasute",
    name: "姨捨",
    line: "篠ノ井線",
    prefecture: "長野",
    region: "中部",
    mood: "empty",
    radiiKm: [1.0, 2.0, 2.8],
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
        blurb: "案内板より先に、勾配が案内する。",
        x: 0.38,
        y: 0.58,
        walkMinutes: 8,
      },
    ],
  },
  {
    id: "shimosuwa",
    name: "下諏訪",
    line: "中央本線",
    prefecture: "長野",
    region: "中部",
    mood: "story",
    radiiKm: [1.1, 2.3, 3.0],
    tourTitle: "温泉街の路地と、湖風のあいだ",
    catchCopy: "中山道の名残が、足元の敷石に残っている。",
    spots: [
      {
        id: "shimosuwa-1",
        name: "温泉街の石畳",
        genre: "history",
        blurb: "湯気の向きで、道順がわかる。",
        x: 0.48,
        y: 0.5,
        walkMinutes: 7,
      },
      {
        id: "shimosuwa-2",
        name: "古い和菓子屋",
        genre: "gourmet",
        blurb: "包装紙の柄が、旅の記念になる。",
        x: 0.6,
        y: 0.38,
        walkMinutes: 9,
        secretWorthy: true,
      },
      {
        id: "shimosuwa-3",
        name: "湖畔への短い坂",
        genre: "nature",
        blurb: "坂の途中で、すでに諏訪湖の匂いがする。",
        x: 0.35,
        y: 0.65,
        walkMinutes: 16,
      },
    ],
  },
  {
    id: "yui",
    name: "由比",
    line: "東海道本線",
    prefecture: "静岡",
    region: "中部",
    mood: "story",
    radiiKm: [1.0, 2.1, 2.9],
    tourTitle: "桜えびの町で、海と山のあいだを歩く",
    catchCopy: "東海道の狭さが、かえって町を濃くする。",
    spots: [
      {
        id: "yui-1",
        name: "宿場の名残",
        genre: "history",
        blurb: "道幅が、馬と人の距離を今も測っている。",
        x: 0.45,
        y: 0.5,
        walkMinutes: 5,
      },
      {
        id: "yui-2",
        name: "桜えびの店先",
        genre: "gourmet",
        blurb: "香ばしさが、駅まで届く日がある。",
        x: 0.62,
        y: 0.42,
        walkMinutes: 8,
        secretWorthy: true,
      },
      {
        id: "yui-3",
        name: "海岸の消波ブロック",
        genre: "odd",
        blurb: "景色としては地味だが、風の感触は一級。",
        x: 0.7,
        y: 0.62,
        walkMinutes: 12,
      },
    ],
  },
  {
    id: "nebukawa",
    name: "根府川",
    line: "東海道本線",
    prefecture: "神奈川",
    region: "関東",
    mood: "empty",
    radiiKm: [0.9, 1.8, 2.5],
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
        blurb: "列車の風が、一瞬だけ通り過ぎる。",
        x: 0.35,
        y: 0.58,
        walkMinutes: 6,
      },
    ],
  },
  {
    id: "amarube",
    name: "餘部",
    line: "山陰本線",
    prefecture: "兵庫",
    region: "近畿",
    mood: "story",
    radiiKm: [1.0, 2.2, 3.0],
    tourTitle: "鉄橋の影と、日本海の風を分ける",
    catchCopy: "橋を見るために降りても、町の静けさまで連れていかれる。",
    spots: [
      {
        id: "amarube-1",
        name: "旧橋の見える丘",
        genre: "history",
        blurb: "新しい橋と古い脚が、同じ景色に並ぶ。",
        x: 0.42,
        y: 0.4,
        walkMinutes: 12,
      },
      {
        id: "amarube-2",
        name: "駅前の小さな店",
        genre: "gourmet",
        blurb: "橋の話が、メニューより先に来る。",
        x: 0.55,
        y: 0.55,
        walkMinutes: 3,
        secretWorthy: true,
      },
      {
        id: "amarube-3",
        name: "海風の通り道",
        genre: "nature",
        blurb: "帽子を押さえる動作が、観光になる。",
        x: 0.68,
        y: 0.35,
        walkMinutes: 10,
      },
    ],
  },
  {
    id: "onomichi",
    name: "尾道",
    line: "山陽本線",
    prefecture: "広島",
    region: "中国",
    mood: "story",
    radiiKm: [1.1, 2.2, 3.0],
    tourTitle: "坂と猫と、古い映画館の気配",
    catchCopy: "上るほどに町が薄くなり、海が近づく。",
    spots: [
      {
        id: "onomichi-1",
        name: "商店街のアーチ",
        genre: "history",
        blurb: "影の濃さが、午後の長さを測ってくれる。",
        x: 0.45,
        y: 0.55,
        walkMinutes: 5,
      },
      {
        id: "onomichi-2",
        name: "港寄りの珈琲店",
        genre: "gourmet",
        blurb: "窓の外で船が動き、カップの中は動かない。",
        x: 0.7,
        y: 0.45,
        walkMinutes: 12,
        secretWorthy: true,
      },
      {
        id: "onomichi-3",
        name: "寺の石畳",
        genre: "history",
        blurb: "坂の途中で、息を整える場所として寺がある。",
        x: 0.32,
        y: 0.3,
        walkMinutes: 16,
      },
      {
        id: "onomichi-4",
        name: "猫のたまり場",
        genre: "odd",
        blurb: "観光名所ではない。でも町の住民が確かここにいる。",
        x: 0.58,
        y: 0.68,
        walkMinutes: 8,
      },
      {
        id: "onomichi-5",
        name: "崖の空き地から見る瀬戸",
        genre: "nature",
        blurb: "名前のない場所から、いちばん海が近い。",
        x: 0.22,
        y: 0.6,
        walkMinutes: 20,
      },
    ],
  },
  {
    id: "misumi",
    name: "三角",
    line: "三角線",
    prefecture: "熊本",
    region: "九州",
    mood: "story",
    radiiKm: [1.2, 2.4, 3.1],
    tourTitle: "明治の港町を、終点の駅から歩く",
    catchCopy: "線路が終わる場所で、町の物語が始まる。",
    spots: [
      {
        id: "misumi-1",
        name: "煉瓦造りの港湾施設",
        genre: "history",
        blurb: "西の港の記憶が、壁の厚みに残る。",
        x: 0.55,
        y: 0.45,
        walkMinutes: 10,
      },
      {
        id: "misumi-2",
        name: "海辺の食堂",
        genre: "gourmet",
        blurb: "終点の定食は、少しだけ塩が効いている。",
        x: 0.4,
        y: 0.55,
        walkMinutes: 8,
        secretWorthy: true,
      },
      {
        id: "misumi-3",
        name: "突堤の先端",
        genre: "nature",
        blurb: "天草への海が、ここで一度止まる。",
        x: 0.72,
        y: 0.38,
        walkMinutes: 15,
      },
    ],
  },
  {
    id: "usuki",
    name: "臼杵",
    line: "日豊本線",
    prefecture: "大分",
    region: "九州",
    mood: "story",
    radiiKm: [1.1, 2.3, 3.0],
    tourTitle: "石仏の町の、城下の静けさを拾う",
    catchCopy: "フグで有名でも、路地の方が長く残る。",
    spots: [
      {
        id: "usuki-1",
        name: "二王座歴史の道",
        genre: "history",
        blurb: "白い壁が、歩く速度を落とさせる。",
        x: 0.45,
        y: 0.48,
        walkMinutes: 12,
      },
      {
        id: "usuki-2",
        name: "城下の喫茶",
        genre: "gourmet",
        blurb: "窓から見えるのは、観光バスではなく石垣。",
        x: 0.58,
        y: 0.4,
        walkMinutes: 9,
        secretWorthy: true,
      },
      {
        id: "usuki-3",
        name: "港寄りの空き地",
        genre: "odd",
        blurb: "用事のない場所が、いちばん写真になる。",
        x: 0.7,
        y: 0.62,
        walkMinutes: 14,
      },
    ],
  },
  {
    id: "hitoyoshi",
    name: "人吉",
    line: "肥薩線",
    prefecture: "熊本",
    region: "九州",
    mood: "story",
    radiiKm: [1.2, 2.4, 3.2],
    tourTitle: "球磨川の音と、温泉町の湯気をたどる",
    catchCopy: "復興の途中でも、川は変わらず町の中心。",
    spots: [
      {
        id: "hitoyoshi-1",
        name: "駅前の温泉街入口",
        genre: "history",
        blurb: "湯けむりの向きが、道標になる。",
        x: 0.5,
        y: 0.5,
        walkMinutes: 5,
      },
      {
        id: "hitoyoshi-2",
        name: "川辺のベンチ",
        genre: "nature",
        blurb: "急がなくていい景色が、ここに座っている。",
        x: 0.35,
        y: 0.4,
        walkMinutes: 10,
        secretWorthy: true,
      },
      {
        id: "hitoyoshi-3",
        name: "焼酎蔵の匂いのする角",
        genre: "gourmet",
        blurb: "入口に入らなくても、香りで十分な訪問。",
        x: 0.65,
        y: 0.58,
        walkMinutes: 12,
      },
    ],
  },
  {
    id: "tsukazaki",
    name: "月崎",
    line: "小湊鐵道",
    prefecture: "千葉",
    region: "関東",
    mood: "empty",
    radiiKm: [0.8, 1.6, 2.2],
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
        blurb: "道は続いているが、用事はここで足りる。",
        x: 0.38,
        y: 0.6,
        walkMinutes: 7,
      },
    ],
  },
  {
    id: "tamatsukuri",
    name: "玉造温泉",
    line: "山陰本線",
    prefecture: "島根",
    region: "中国",
    mood: "story",
    radiiKm: [1.0, 2.1, 2.9],
    tourTitle: "神話の湯の町を、駅からゆるく一周",
    catchCopy: "玉造の名は大きく、路地はちょうどいい大きさ。",
    spots: [
      {
        id: "tamatsukuri-1",
        name: "温泉街の石畳",
        genre: "history",
        blurb: "足裏の感触が、すでに湯治の入口。",
        x: 0.48,
        y: 0.5,
        walkMinutes: 8,
      },
      {
        id: "tamatsukuri-2",
        name: "川沿いの足湯",
        genre: "odd",
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
        blurb: "観光の本線から、半歩だけ外れている。",
        x: 0.35,
        y: 0.62,
        walkMinutes: 12,
      },
    ],
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
