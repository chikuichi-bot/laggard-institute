/**
 * 画面表示用の漢字文を、speechSynthesis が言い間違えにくい読み上げ文に直す。
 * 表示テキストは変えず、発話直前だけ通す。
 */

const LEXICON_RAW: Array<[string, string]> = [
  ["出町柳", "でまちやなぎ"],
  ["淀屋橋", "よどやばし"],
  ["中書島", "ちゅうしょじま"],
  ["石清水八幡宮", "いわしみずはちまんぐう"],
  ["大山崎", "おおやまざき"],
  ["藤森", "ふじのもり"],
  ["墨染", "すみぞめ"],
  ["二ノ瀬", "にのせ"],
  ["貴船口", "きぶねぐち"],
  ["八瀬比叡山口", "やせひえいざんぐち"],
  ["鴨川デルタ", "かもがわでるた"],
  ["賀茂御祖神社", "かもみおやじんじゃ"],
  ["下鴨神社", "しもがもじんじゃ"],
  ["枡形商店街", "ますがたしょうてんがい"],
  ["桝形商店街", "ますがたしょうてんがい"],
  ["鯖街道", "さばかいどう"],
  ["若狭街道", "わかさかいどう"],
  ["京都大学", "きょうとだいがく"],
  ["同志社大学", "どうししゃだいがく"],
  ["龍谷大学", "りゅうこくだいがく"],
  ["琵琶湖疏水", "びわこそすい"],
  ["疏水", "そすい"],
  ["糺の森", "ただすのもり"],
  ["賀茂川", "かもがわ"],
  ["高野川", "たかのがわ"],
  ["鴨川", "かもがわ"],
  ["濠川", "ほりかわ"],
  ["寺田屋", "てらだや"],
  ["月桂冠", "げっけいかん"],
  ["飛行神社", "ひこうじんじゃ"],
  ["藤森神社", "ふじのもりじんじゃ"],
  ["直違橋", "すじかいばし"],
  ["墨染寺", "すみぞめでら"],
  ["離宮八幡宮", "りきゅうはちまんぐう"],
  ["平等院", "びょうどういん"],
  ["宇治橋", "うじばし"],
  ["通圓", "つうえん"],
  ["貴船神社", "きぶねじんじゃ"],
  ["天王山", "てんのうざん"],
  ["山崎蒸溜所", "やまざきじょうりゅうじょ"],
  ["御香宮", "ごこうのみや"],
  ["小回り", "こまわり"],
  ["大回り", "おおまわり"],
  ["徒歩", "とほ"],
  ["改札", "かいさつ"],
  ["目の置きどころ", "めのおきどころ"],
  ["立ち寄り", "たちより"],
  ["寄り道", "よりみち"],
  ["土地案内", "とちあんない"],
  ["見知らぬ駅", "みしらぬえき"],
];

const LEXICON = [...LEXICON_RAW].sort((a, b) => b[0].length - a[0].length);

function japaneseNumber(n: number): string {
  const digits = [
    "ゼロ",
    "いち",
    "に",
    "さん",
    "よん",
    "ご",
    "ろく",
    "なな",
    "はち",
    "きゅう",
  ];
  if (n < 10) return digits[n] ?? String(n);
  if (n === 10) return "じゅう";
  if (n < 20) return `じゅう${digits[n - 10]}`;
  if (n < 60) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    const tenWord =
      tens === 2
        ? "にじゅう"
        : tens === 3
          ? "さんじゅう"
          : tens === 4
            ? "よんじゅう"
            : tens === 5
              ? "ごじゅう"
              : `${digits[tens]}じゅう`;
    return ones === 0 ? tenWord : tenWord + digits[ones];
  }
  return String(n);
}

function normalizePunctuation(text: string): string {
  let s = text;
  const pairs: Array<[string, string]> = [
    ["·", "、"],
    ["・", "、"],
    ["／", "、"],
    ["/", "、"],
    ["｜", "、"],
    ["|", "、"],
    ["〜", "から"],
    ["～", "から"],
    ["…", "。"],
    ["...", "。"],
    ["※", "なお、"],
    ["→", "、つぎに、"],
    ["&", "と"],
    ["　", "、"],
  ];
  for (const [from, to] of pairs) s = s.split(from).join(to);
  s = s.replace(/[【】[\]（）()「」『』<>《》#*_`]/gu, "、");
  return s;
}

export function prepareSpeakableText(
  text: string,
  options: {
    stationName?: string | null;
    stationReading?: string | null;
    extraNames?: string[];
  } = {},
): string {
  let s = normalizePunctuation(text);

  const bare = (options.stationName ?? "").replace(/駅$/u, "").trim();
  const kana = (options.stationReading ?? "").trim();
  if (bare) {
    if (kana) {
      s = s.split(`${bare}駅`).join(`${kana}えき`);
      s = s.split(bare).join(kana);
    } else {
      s = s.split(`${bare}駅`).join(`${bare}、駅`);
    }
  }

  for (const [kanji, reading] of LEXICON) {
    s = s.split(kanji).join(reading);
  }

  const extras = [...(options.extraNames ?? [])]
    .map((n) => n.trim())
    .filter((n) => n.length >= 2)
    .sort((a, b) => b.length - a.length);
  for (const name of extras) {
    if (s.includes(name)) s = s.split(name).join(`、${name}、`);
  }

  s = s.replace(/約?\s*(\d{1,2})\s*分/gu, (_, n) => {
    const num = Number(n);
    return Number.isFinite(num) ? `やく${japaneseNumber(num)}ふん` : _;
  });

  const ordinals: Array<[string, string]> = [
    ["1番", "いちばん"],
    ["2番", "にばん"],
    ["3番", "さんばん"],
    ["4番", "よんばん"],
  ];
  for (const [from, to] of ordinals) s = s.split(from).join(to);

  while (s.includes("、、")) s = s.split("、、").join("、");
  while (s.includes("。。")) s = s.split("。。").join("。");
  return s.trim();
}
