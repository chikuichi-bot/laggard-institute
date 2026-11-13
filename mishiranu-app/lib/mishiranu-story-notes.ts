import type {
  AreaHistoryNote,
  GuideKind,
  Spot,
  StationSeed,
} from "@/data/mishiranu-stations";
import { isForeignDemachiPlace } from "@/lib/mishiranu-demachi-template";
import { haversineKm } from "@/lib/mishiranu-geo";

/**
 * 無料 peek のフッター。百科で完結させず、改札を出る身体的な予感で止める。
 * （仕様: 見知らぬ駅·次の実装指示 A）
 */
export const STORY_PEEK_WALK_INVITE =
  "改札の外に、その名残を感じながら歩ける道が続いています。";

/** 物語が空のときの peek 本文（歩き出しの予感を残す）。 */
export const STORY_PEEK_EMPTY_BODY =
  "確かな物語のゆかりは見つかりませんでした。それでも改札の外には、名前のない空気の道が続いていることがあります。";

/** body 末尾がすでに歩き出し型か（重複付与を避ける）。 */
export function bodyHasWalkInvite(body: string): boolean {
  const t = body.trim();
  if (!t) return false;
  return (
    /改札/.test(t) ||
    /歩ける道/.test(t) ||
    /足でたど/.test(t) ||
    /降りて.*確かめ/.test(t) ||
    /空気の道が続/.test(t) ||
    /いま歩ける空気/.test(t)
  );
}

/**
 * 最後の note の結びが百科完結なら、歩き出しの一文を足す。
 * UI フッターと併用してよい（フッターは常時、こちらは本文側の保険）。
 */
export function ensureStoryPeekWalkInvite(
  notes: AreaHistoryNote[],
): AreaHistoryNote[] {
  if (!notes.length) return notes;
  const last = notes[notes.length - 1];
  if (bodyHasWalkInvite(last.body)) return notes;
  const base = last.body.trim().replace(/[。．.]+$/u, "");
  return [
    ...notes.slice(0, -1),
    {
      ...last,
      body: `${base}。${STORY_PEEK_WALK_INVITE}`,
    },
  ];
}

function spotKey(name: string): string {
  return name.replace(/\s+/gu, "");
}

/** 地図ピン色: 他カテゴリ優先。物語は最下位（単独なら観光）。 */
export function preferredGuide(a: GuideKind, b: GuideKind): GuideKind {
  const rank: Record<GuideKind, number> = {
    meal: 60,
    souvenir: 50,
    sight: 40,
    rest: 30,
    tip: 20,
    story: 0,
  };
  const pick = rank[a] >= rank[b] ? a : b;
  return pick === "story" ? "sight" : pick;
}

/** 地図用の補足一行（カテゴリ文のあとに足す）。 */
export function storySupplement(
  body: string,
  title?: string | null,
): string {
  const t = body.trim();
  if (!t) return title?.trim() ? `〔物語〕${title.trim()}` : "";
  if (title?.trim() && !t.includes(title.trim())) {
    return `〔物語〕${title.trim()} — ${t}`;
  }
  return `〔物語〕${t}`;
}

/** 満寿形屋と枡形商店街は別（食堂と通り）。 */
export function areDistinctMasugataPlaces(a: string, b: string): boolean {
  const isRestaurant = (n: string) => /満寿形/.test(n);
  const isArcade = (n: string) => /枡形|桝形/.test(n) && !/満寿/.test(n);
  return (
    (isRestaurant(a) && isArcade(b)) || (isRestaurant(b) && isArcade(a))
  );
}

export function sameStoryPlaceName(a: string, b: string): boolean {
  if (areDistinctMasugataPlaces(a, b)) return false;
  if (a === b) return true;
  const ka = spotKey(a);
  const kb = spotKey(b);
  if (!ka || !kb) return false;
  if (ka.includes(kb) || kb.includes(ka)) return true;
  return false;
}

export function sameStoryPlace(a: Spot, b: Spot): boolean {
  if (a.id === b.id) return true;
  if (areDistinctMasugataPlaces(a.name, b.name)) return false;
  if (sameStoryPlaceName(a.name, b.name)) return true;
  const storyInvolved = a.guide === "story" || b.guide === "story";
  if (
    !storyInvolved ||
    a.lat == null ||
    a.lng == null ||
    b.lat == null ||
    b.lng == null
  ) {
    return false;
  }
  const km = haversineKm(
    { lat: a.lat, lng: a.lng },
    { lat: b.lat, lng: b.lng },
  );
  if (km > 0.05) return false;
  const ka = spotKey(a.name);
  const kb = spotKey(b.name);
  return ka.includes(kb.slice(0, 2)) || kb.includes(ka.slice(0, 2));
}

function trustRank(t: Spot["coordTrust"]): number {
  if (t === "lock") return 3;
  if (t === "apple") return 2;
  return 1;
}

function demoteStoryOnMap(spot: Spot): Spot {
  if (spot.guide !== "story") return spot;
  const blurb = spot.blurb.trim().startsWith("〔物語〕")
    ? spot.blurb
    : storySupplement(spot.blurb);
  return {
    ...spot,
    guide: "sight",
    genre: spot.genre === "gourmet" ? spot.genre : "history",
    blurb,
  };
}

function categoryPrimaryBlurb(name: string, guide: GuideKind): string {
  if (
    name.includes("鴨川デルタ") ||
    (name.includes("鴨川") && name.includes("デルタ"))
  ) {
    return "鴨川と高野川の合流。飛び石が並び、多くの人が川辺で憩う町の顔。";
  }
  if (name.includes("下鴨神社") || name.includes("賀茂御祖")) {
    return "世界遺産の社。糺の森を抜けて本殿へ。出町柳からの散歩の行き先。";
  }
  if (guide === "meal") return `${name}。徒歩圏で立ち寄れる食事どころ。`;
  if (guide === "souvenir") return `${name}。手土産や買い物の候補。`;
  if (guide === "rest") return `${name}。歩いたあとに腰を下ろせる場所。`;
  if (guide === "tip") return `${name}。予定にない寄り道向き。`;
  return `${name}。駅からの徒歩圏で立ち寄れる名所。`;
}

/** 物語と他種（観光・ご飯等）を1スポットに合体。地図カテゴリは他種優先。 */
export function mergeStoryPlace(
  base: Spot,
  other: Spot,
  opts?: { storyBody?: string; storyTitle?: string },
): Spot {
  const guide = preferredGuide(
    (base.guide ?? "tip") as GuideKind,
    (other.guide ?? "tip") as GuideKind,
  );
  const trustA = base.coordTrust;
  const trustB = other.coordTrust;
  const trust =
    trustRank(trustA) >= trustRank(trustB) ? trustA : trustB;
  let lat = base.lat;
  let lng = base.lng;
  if (trust === trustB && (other.lat != null || other.lng != null)) {
    lat = other.lat;
    lng = other.lng;
  } else if (lat == null && other.lat != null) {
    lat = other.lat;
    lng = other.lng;
  }
  const name =
    base.name.length <= other.name.length ? base.name : other.name;
  const primary = categoryPrimaryBlurb(name, guide);
  const supp = opts?.storyBody
    ? storySupplement(opts.storyBody, opts.storyTitle)
    : "";
  return {
    ...base,
    name,
    guide,
    genre:
      guide === "meal" || guide === "souvenir"
        ? "gourmet"
        : "history",
    blurb: supp ? `${primary} ${supp}` : primary,
    detail: supp || undefined,
    walkMinutes: Math.min(base.walkMinutes, other.walkMinutes),
    majorWorthy: true,
    lat,
    lng,
    coordTrust: trust,
    mealTier: base.guide === "meal" ? base.mealTier : other.mealTier,
    mealTimes:
      base.guide === "meal" && base.mealTimes?.length
        ? base.mealTimes
        : other.mealTimes,
  };
}

/** 物語×他種の重なりを畳む。残った story も観光＋補足へ。 */
export function collapseStoryOverlaps(spots: Spot[]): Spot[] {
  const result: Spot[] = [];
  for (const spot of spots) {
    const idx = result.findIndex((s) => sameStoryPlace(s, spot));
    if (idx >= 0) {
      const kept = result[idx]!;
      if (
        kept.guide === "story" ||
        spot.guide === "story" ||
        sameStoryPlaceName(kept.name, spot.name)
      ) {
        result[idx] = mergeStoryPlace(kept, spot);
      } else {
        result.push(spot);
      }
    } else {
      result.push(spot);
    }
  }
  return result.map(demoteStoryOnMap);
}

/**
 * 駅名（「駅」なし）→ 物語のゆかり。確かな撮影地／文学の舞台だけ。
 * AreaDepth の土地文とは独立。AI が空でもここが載る。
 */
export const STORY_NOTES_CANON: Record<string, AreaHistoryNote[]> = {
  出町柳: [
    {
      title: "『パッチギ！』と鴨川デルタ",
      body:
        "映画『パッチギ！』（2004）の乱闘シーンなどで知られるのが、駅から数分の鴨川デルタです。賀茂川と高野川の合流の三角に立ってみると、画面の川幅と飛び石の向きが、いまの足場と同じ高さで戻ってきます。",
    },
    {
      title: "『鴨川ホルモー』と飛び石",
      body:
        "万城目学の小説を映画化した『鴨川ホルモー』（2009）も、同じデルタと飛び石を舞台に使いました。ホルモーの勝負の気配は残っていませんが、亀形の飛石を渡る足取りは、いまも学生と旅人の道になっています。",
    },
    {
      title: "森見登美彦と出町の川",
      body:
        "森見登美彦『四畳半神話大系』『夜は短し歩けよ乙女』では、京大生の夜と昼がこの川端に何度も戻ります。アニメ版でもデルタの三角が象徴の景色として描かれ、駅を出て水音に耳を澄ませると、本の中の距離感が先に来ます。",
    },
    {
      title: "『たまこまーけっと』と枡形",
      body:
        "京都アニメーション『たまこまーけっと』『たまこラブストーリー』の舞台のひとつが、駅西の出町枡形商店街です。アーケードの短い道幅を歩くと、画面の店先の密度が、いまの買い物の足と同じになります。",
    },
  ],
  石清水八幡宮: [
    {
      title: "『燃えよ剣』と参道",
      body:
        "映画『燃えよ剣』（2021・原田眞人監督）は、石清水八幡宮の参道をロケに使いました。駅からケーブルか徒歩で男山へ上がると、画面の石段と社域の空気が、いまの足と同じ勾配で戻ってきます。",
    },
    {
      title: "『京阪沿線物語』と参道ケーブル",
      body:
        "テレビ大阪のドラマ『京阪沿線物語〜古民家民泊きずな屋へようこそ〜』（2021）は、石清水八幡宮参道ケーブルをロケ地にしました。ホームを出てすぐの赤い車両に乗ると、ドラマの開閉の距離感が体にわかります。",
    },
    {
      title: "『舞いあがれ！』と飛行神社",
      body:
        "NHK連続テレビ小説『舞いあがれ！』では、飛行神社の合格祈願のお守りが物語に登場します。駅から門前を歩いて近い距離にあり、朝ドラで知った社号を、いまの境内の静けさで確かめられます。",
    },
    {
      title: "『ぼくは明日、昨日のきみとデートする』と走井餅",
      body:
        "映画『ぼくは明日、昨日のきみとデートする』は、門前のやわた走井餅老舗でも撮影されました。駅前・門前の甘いものの店先は、画面の一瞬と、いま並ぶ人の気配が同じ半径にあります。",
    },
  ],
  中書島: [
    {
      title: "『たまこまーけっと』と伏見港",
      body:
        "アニメ『たまこまーけっと』の聖地として、京阪中書島駅南口まわりや伏見港の景色が巡礼マップに載っています。ホームを出て水路の気配へ歩くと、画面の港町の距離感が、いまの足と同じになります。",
    },
  ],
  尾道: [
    {
      title: "『東京物語』と尾道駅",
      body:
        "小津安二郎『東京物語』（1953）で、老夫婦が発ち、そして帰る駅がここです。ホームに立つと、作品の始まりと終わりが同じ海の町の空気として残っています。",
    },
    {
      title: "大林宣彦『転校生』の石段",
      body:
        "大林宣彦監督『転校生』（1982）の入れ替わりは、駅から坂を上がった御袖天満宮の石段で起きます。55段を歩くと、画面の転げ落ちの勾配が、いまの息づかいになります。",
    },
    {
      title: "『時をかける少女』と艮神社",
      body:
        "1983年版『時をかける少女』では、艮神社や千光寺まわりが尾道の舞台になります。駅から坂の寺社へ歩けば、ラベンダーの香りの物語の手前に、いまのクスと石段が来ます。",
    },
    {
      title: "『かみちゅ！』と御袖天満宮",
      body:
        "アニメ『かみちゅ！』では、御袖天満宮が「来福神社」のモデルとして描かれます。長い石段はOPのまま残り、駅から坂を上がると画面の段数が足にわかります。",
    },
  ],
  餘部: [
    {
      title: "『夢千代日記』と余部鉄橋",
      body:
        "早坂暁『夢千代日記』（NHK／映画）は、山陰線の列車が余部鉄橋にさしかかる車内から物語が始まります。駅そばの空の駅へ上がると、日記の冒頭の高さが、いまの日本海の風と重なります。",
    },
    {
      title: "隣の鎧駅と朝ドラの海",
      body:
        "隣の鎧駅は、NHK連続テレビ小説『ふたりっ子』やドラマ『砂の器』のロケ地としても知られます。餘部から短い車窓で海を見下ろす駅へ移ると、山陰の画面の定番が続きます。",
    },
  ],
  佐原: [
    {
      title: "今村昌平『うなぎ』と水郷",
      body:
        "カンヌでグランプリを受けた今村昌平『うなぎ』（1997）は、佐原の川と生活の風景を舞台に選びました。駅から小野川沿いへ歩くと、観光地の看板より先に、画面の生活の川が来ます。",
    },
    {
      title: "『大河への道』と駅前・町並み",
      body:
        "映画『大河への道』（2022）は、佐原駅前ロータリーや小野川沿いの町並みで現代パートを撮りました。伊能忠敬の町を歩く足が、そのままロケ地図の線になります。",
    },
    {
      title: "小野川沿いのドラマの層",
      body:
        "小野川の土蔵と橋は、『ミステリと言う勿れ』映画版や『東京バンドワゴン』など、情緒ある町並みロケの定番です。駅から十分ほどで、画面の格子戸の密度に入れます。",
    },
  ],
  美瑛: [
    {
      title: "『北の国から』と美瑛駅",
      body:
        "『北の国から』スペシャル『'89帰郷』で、螢が旭川から富良野へ帰る途中に下車したのが美瑛駅です。軟石の駅舎に立つと、隣町への途中下車のシーンが、いまのホームの静かさで戻ります。",
    },
  ],
  藤森: [
    {
      title: "『たまこまーけっと』と藤森駅",
      body:
        "京都アニメーション『たまこまーけっと』では、京阪藤森駅の北改札や駅そばの琵琶湖疏水の橋が何度も画面に出ます。ホームを出て疏水沿いの堀田橋へ歩くと、物語の始まりの距離感が、いまの足と同じになります。",
    },
    {
      title: "『たまこまーけっと』と疏水の橋",
      body:
        "堀田橋・キトロ橋・師団橋は、たまこたちが通る疏水沿いの定番です。藤森駅から数分で橋の欄干に立て、画面の水路の幅と電車の音が、いまの深草の空気に重なります。",
    },
  ],
  墨染: [
    {
      title: "『たまこまーけっと』と深草の疏水",
      body:
        "『たまこまーけっと』の巡礼は藤森駅側が中心ですが、疏水と京阪の線路が絡む深草〜墨染の道も画面の延長にあります。墨染から北へ疏水沿いを歩けば、藤森の橋へ続く同じ水路の層に入れます。",
    },
    {
      title: "墨染寺と墨染桜の物語",
      body:
        "駅名の由来にもつながる墨染寺には、墨染桜の伝承が残ります。駅から近い境内に立つと、地名の色の話が、いまの桜と寺の静けさとして戻ってきます。",
    },
  ],
  八瀬比叡山口: [
    {
      title: "叡電と森見登美彦の車窓",
      body:
        "森見登美彦『有頂天家族』やエッセイでは、叡山電車の車窓が別世界の箱のように描かれます。八瀬比叡山口のホームに立つと、比叡への入口の空気と、本の中の叡電の気配が同じ山裾にあります。",
    },
    {
      title: "ケーブル八瀬と比叡の入口",
      body:
        "駅を出てすぐの橋を渡りケーブル八瀬へ向かう道は、比叡山への西の入口として映画・ドラマのロケでも使われてきました。木橋を渡る足取りが、画面の乗り換えの距離感になります。",
    },
  ],
  二ノ瀬: [
    {
      title: "もみじのトンネルと叡電の谷",
      body:
        "市原〜二ノ瀬の「もみじのトンネル」は、叡山電鉄の象徴の車窓です。二ノ瀬のホームで列車交換を待つあいだ、谷の斜面と紅葉の気配が、アニメや映画で見た叡電の山の線と同じ高さで来ます。",
    },
    {
      title: "『ナニモノガタリ』と二ノ瀬駅",
      body:
        "二ノ瀬仁奈の楽曲『ナニモノガタリ』のミュージック・ビデオは、この駅で撮影されました。無人駅のホームと構内踏切に立つと、映像の小さな停車駅のスケールが、いまの谷の静けさで戻ります。",
    },
  ],
  淀屋橋: [
    {
      title: "『ゴジラの逆襲』と淀屋橋駅",
      body:
        "映画『ゴジラの逆襲』（1955）では、脱走した三人組が淀屋橋駅へ逃げ込み、改札をすり抜ける場面が撮られました。いまのメトロ／京阪の地下へ降りると、昭和の駅の緊迫が、同じ地名のホームに残っています。",
    },
    {
      title: "『BAD LANDS』と水晶橋",
      body:
        "映画『BAD LANDS』（2024）のロケ地のひとつが、淀屋橋から歩いて近い中之島の水晶橋です。駅を出て土佐堀・堂島の川筋へ向かうと、画面の橋の欄干と水の幅が、いまの中之島の散歩道に重なります。",
    },
  ],
  淀: [
    {
      title: "京都競馬場と淀の駅",
      body:
        "京阪淀駅は京都競馬場の最寄りとして知られ、副駅名にもその名が付きます。ホームを出て競馬場方面へ歩くと、開催日のにぎわいと、平常の静けさが同じ半径で入れ替わる土地だとわかります。",
    },
    {
      title: "淀城跡の物語の層",
      body:
        "駅南西の淀城跡は、豊臣・徳川の時代の淀の名が残る城の場所です。公園の石垣と堀の気配を歩くと、地名の「淀」が競馬場だけの言葉ではなく、長い町の層だと感じられます。",
    },
  ],
};

function bareStationName(name: string): string {
  return name.replace(/駅$/u, "").trim();
}

/** 完全一致 → 長いキーから含む一致（短い誤爆を避ける）。 */
export function storyNotesForName(name: string): AreaHistoryNote[] | undefined {
  const bare = bareStationName(name);
  if (!bare) return undefined;
  const exact = STORY_NOTES_CANON[bare];
  if (exact?.length) return exact;
  const keys = Object.keys(STORY_NOTES_CANON).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    // 短いキーの誤爆を避ける（「石清水」⊂「石清水八幡宮」は可）
    if (key.length < 3) continue;
    if (bare.includes(key)) {
      const notes = STORY_NOTES_CANON[key];
      if (notes?.length) return notes;
    }
  }
  return undefined;
}

/** 正本があれば storyNotes を載せる（AI の空・薄い配列を上書き）。 */
export function withStoryNotes(station: StationSeed): StationSeed {
  const canon = storyNotesForName(station.name);
  const withNotes = canon?.length
    ? { ...station, storyNotes: canon }
    : station;
  return ensureStoryMapSpots(withNotes);
}

/** タイトル「『作品』と場所」から地図用の場所名を取る。 */
export function placeNameFromStoryTitle(title: string): string | null {
  const trimmed = title.trim();
  if (!trimmed) return null;
  const idx = trimmed.indexOf("と");
  if (idx >= 0) {
    const after = trimmed.slice(idx + 1).trim();
    const polished = polishStoryPlace(after);
    if (polished) return polished;
  }
  if (trimmed.startsWith("『")) return null;
  return polishStoryPlace(trimmed);
}

function polishStoryPlace(raw: string): string | null {
  let s = raw.replace(/など$/u, "").trim();
  if (s.length < 2) return null;
  if (s === "枡形" || s === "桝形") s = "枡形商店街";
  const weak = ["川", "海", "町", "入口", "顔", "層", "空気", "朝ドラの海", "出町の川"];
  if (weak.includes(s)) return null;
  if (/の川$|の海$/u.test(s)) return null;
  const placeish =
    /商店街|神社|神宮|大社|天満宮|寺|院|デルタ|三角州|公園|鉄橋|橋|ケーブル|ふたば|走井餅|飛行神社|港|駅$/u.test(
      s,
    );
  return placeish ? s : null;
}

/**
 * storyNotes から地図ピンを起こす。
 * 既存の観光・ご飯などと同場所なら合体（別ピンにしない）。
 */
export function ensureStoryMapSpots(station: StationSeed): StationSeed {
  const notes = station.storyNotes ?? [];
  let spots = [...(station.spots ?? [])];
  if (!notes.length) {
    const collapsed = collapseStoryOverlaps(spots);
    if (collapsed.length === spots.length) {
      const same = collapsed.every(
        (s, i) => s.id === spots[i]?.id && s.guide === spots[i]?.guide,
      );
      if (same) return station;
    }
    return { ...station, spots: collapsed };
  }
  let added = 0;
  let changed = false;
  for (const note of notes) {
    if (isForeignDemachiPlace(note.title, station.name)) continue;
    const place = placeNameFromStoryTitle(note.title);
    if (!place || isForeignDemachiPlace(place, station.name)) continue;
    const idx = spots.findIndex((s) => sameStoryPlaceName(s.name, place));
    if (idx >= 0) {
      const cur = spots[idx]!;
      const storySeed: Spot = {
        ...cur,
        guide: "story",
        blurb: note.body,
        detail: `物語のゆかり。${note.title}`,
        majorWorthy: true,
      };
      spots[idx] = mergeStoryPlace(cur, storySeed, {
        storyBody: note.body,
        storyTitle: note.title,
      });
      changed = true;
      continue;
    }
    const lat = station.lat ?? 0;
    const lng = station.lng ?? 0;
    const primary = categoryPrimaryBlurb(place, "sight");
    const supp = storySupplement(note.body, note.title);
    const created: Spot = {
      id: `story-${spotKey(place).slice(0, 24)}`,
      name: place,
      genre: "history",
      guide: "sight",
      blurb: `${primary} ${supp}`,
      detail: supp,
      x: 0.5,
      y: 0.45,
      walkMinutes: 8 + added * 2,
      majorWorthy: true,
      lat: lat ? lat + (added + 1) * 0.00035 : undefined,
      lng: lng ? lng - (added + 1) * 0.00028 : undefined,
      coordTrust: "unverified",
    };
    const overlap = spots.findIndex((s) => sameStoryPlace(s, created));
    if (overlap >= 0) {
      spots[overlap] = mergeStoryPlace(spots[overlap]!, created, {
        storyBody: note.body,
        storyTitle: note.title,
      });
    } else {
      spots.push(created);
      added += 1;
    }
    changed = true;
    if (added >= 4) break;
  }
  spots = collapseStoryOverlaps(spots);
  return changed || spots.length !== (station.spots ?? []).length
    ? { ...station, spots }
    : station;
}
