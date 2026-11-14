import { AsyncLocalStorage } from "node:async_hooks";
import type {
  AreaHistoryNote,
  BikeRentalInfo,
  GuideKind,
  MealTier,
  MealTime,
  Spot,
  SpotGenre,
  StationMood,
  StationSeed,
} from "@/data/mishiranu-stations";
import { GUIDE_ORDER, REGIONS } from "@/data/mishiranu-stations";
import { fuzzLatLngForExternal } from "@/lib/mishiranu-geo";
import { beginPaidAiCall } from "@/lib/mishiranu-rate-limit";
import landmarkLocks from "@/data/landmark-locks.json";
import { applyBikeRentalLocks } from "@/lib/mishiranu-bike-locks";
import {
  isRichLandDepth,
  lookupAreaDepthByName,
  stationShellFromLandDepth,
  withAreaDepth,
} from "@/lib/mishiranu-area-depth";
import {
  isEditorialPlaceName,
  placeTitle,
  sealMapCoordinates,
} from "@/lib/mishiranu-map-trust";
import {
  filterFirstVisitSpots,
  isGuidebookWorship,
  isNeighborhoodWorship,
  isOrdinaryPublicFace,
} from "@/lib/mishiranu-first-visit-faces";
import {
  DEMACHI_TEMPLATE_PROMPT,
  DETOUR_CHARM_PROMPT,
  PRECISION_BAR_PROMPT,
  isForeignDemachiPlace,
  type FirstVisitFace,
  type FirstVisitRole,
} from "@/lib/mishiranu-demachi-template";
import {
  ensureLandPresentAnchors,
  landAnchorPromptBlock,
} from "@/lib/mishiranu-land-anchors";
import {
  LAND_PROSE_ROLE_RULES,
  refineLandProse,
} from "@/lib/mishiranu-land-prose";
import { ensureLandMentions } from "@/lib/mishiranu-lore";
import type { UserAiConfig } from "@/lib/mishiranu-billing";
import {
  clarifyLandscapeName,
  landscapeWalkBlurb,
  shouldRewriteLandscapeBlurb,
} from "@/lib/mishiranu-landscape-name";
import { isNonWalkInMeal } from "@/lib/mishiranu-walk-in-meal";
import { sealGuideIntegrity } from "@/lib/mishiranu-guide-integrity";
import { ensureStoryPeekWalkInvite } from "@/lib/mishiranu-story-notes";
import {
  corridorsForStation,
  sanitizeCorridor,
  type AtmosphereCorridor,
} from "@/lib/mishiranu-atmosphere";
import { sealPreferredDetours } from "@/lib/mishiranu-preferred-detour";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent";

/** 買い切り BYOK の実行時設定（同時リクエストでも混線しない） */
const byokRuntime = new AsyncLocalStorage<UserAiConfig>();

/** 土地の顔（majorWorthy）。名所優先。名物店は確実なときだけ足す。 */
const MAJOR_FACE_TOTAL = 5;
const MAJOR_SIGHT_TARGET = 3;
/** 名物店の major は最大この数。0件でもよい（信頼優先）。 */
const MAJOR_FOOD_TARGET = 2;

const REGION_SET = new Set<string>(REGIONS);
const GUIDE_SET = new Set<GuideKind>(GUIDE_ORDER);
const GENRE_SET = new Set<SpotGenre>(["history", "gourmet", "nature", "odd"]);
const MEAL_TIER_SET = new Set<MealTier>(["casual", "upscale"]);
const MEAL_TIME_SET = new Set<MealTime>(["morning", "lunch", "dinner"]);

export type AiStationResult = {
  station: StationSeed;
  source: "ai";
};

function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function slugifyStationName(name: string): string {
  const base = name
    .trim()
    .replace(/駅$/u, "")
    .replace(/\s+/g, "")
    .slice(0, 24);
  const ascii = base.replace(/[^\w\u3040-\u30ff\u3400-\u9fff-]/gu, "");
  const stamp = Date.now().toString(36).slice(-4);
  return `ai-${ascii || "station"}-${stamp}`;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

const WANDER_TONE_RULES = [
  "【文体】観光案内ではなく、用事のない人がブラブラ歩いて駅へ帰るときの『目の置きどころ』を書く。",
  DETOUR_CHARM_PROMPT,
  "- 地形・川の流れ・坂の傾き・橋・町の音・いまの人の流れを描写する。店も『目に入るもの』として書けばよい。",
  "- 禁止語: 「〜しましょう」「〜してみて」「おすすめ」「必見」「ぜひ」「人気」「穴場」「見逃せない」。命令・勧誘・ランキング口調にしない。",
  "- 目的地へ急がせない。どこにいても駅まで徒歩何分で戻れるかを、ところどころ静かに書く。",
  "- 何もない駅は、何もないこと自体を散歩のいちばん良い形として書く（埋め草で長くしない）。",
  "- Lagadoらしい静かで具体的な日本語。",
].join("\n");

const STATION_SCHEMA_BLOCK = [
  "スキーマ:",
  "{",
  '  "name": "駅名（駅を付けない）",',
  '  "nameReading": "駅名のひらがな読み（例: でまちやなぎ）",',
  '  "line": "路線名",',
  '  "prefecture": "都道府県（都府県を含む短い表記可）",',
  '  "region": "北海道|東北|関東|中部|近畿|中国|四国|九州",',
  '  "mood": "story|empty",',
  '  "lat": 駅の緯度(number),',
  '  "lng": 駅の経度(number),',
  '  "stationIntro": "〇〇駅のこと。改札・乗り換え・駅前の空気＋いつ・なぜこの駅ができたか（開業年と設置理由）。story は4〜6文、empty は3〜5文。大学・神社・川の詳説は historyNotes へ",',
  '  "areaAbout": "historyNotes が2件以上あるときは省略（空文字かキーなし）。メモが薄いときだけ1〜2文の橋渡し。同じ川・街・大学をメモと二重に書かない",',
  '  "walkGuide": "3〜6文。出町並み精度: 出口（分かれば番号）→実際に通る順→方角→駅まで戻る目安。定番の食べ方（買ってどこで食べるか）が分かれば1文。由来・『なぜ有名か』・『リズムが崩れにくい』抽象は禁止。命令形にしない",',
  '  "tourTitle": "28字以内",',
  '  "catchCopy": "40字以内",',
  '  "emptyHeadline": "emptyのときだけ20字以内。店の欠落を失敗にせず、歩く理由にする（例: 余白を、歩く）",',
  '  "emptyBody": "emptyのときだけ80字以内。『用事がないから、川沿い／坂／橋／田畑の道をただ歩いて駅へ帰る』と、何もないこと自体を散歩のいちばん良い形として書く",',
  '  "railHint": "確信があるときだけ1文（土地タブ冒頭用）。例:『都市近郊の駅・帰りは本数多め』『本数が少ない路線・改札を出る前に帰りの時刻確認がおすすめ』。不確か・調べ不足なら省略（キー自体なし）",',
  '  "bikeRental": { "available": boolean, "summary": "1〜2文", "places": [ { "kind": "local|app", "name": "その駅にある実在サービス・店の正式名", "walkMinutes": 5, "note": "使い方1文" } ] },',
  "- bikeRental は入力駅の徒歩圏（目安8分以内）で実在確認できたものだけ。無ければ available:false・places:[]。推測で埋めない。",
  "- places の name は総称禁止（「駅前のレンタサイクル店」不可）。他駅の店名・ポート名を混ぜない。",
  "- 例（出町柳だけ）: CLEW（クルー）京阪出町柳駅前（app）。えむじかは 2026-01 閉業なので書かない。出町柳以外に CLEW 出町柳も書かない。",
  '  "historyNotes": [{ "title": "短い見出し", "body": "土地メモ。各2〜4文。各件で由来といまを同じ本文で結ぶ。同じ主題を areaAbout / sightseeing で繰り返さない" }]（story は4〜6件。mood:empty は2〜4件。店の列挙で埋めない。駅の開業そのものは stationIntro へ）,',
  '  "firstVisitFaces": [',
  '    { "role": "landform|landmark|town", "name": "正式名", "where": "位置", "why": "なぜその役割か1文", "present": "いまどう見えるか1文", "walkMinutes": 5, "lat": 0, "lng": 0 }',
  "  ]（1〜3件。実在する役割だけ。町場・店が無ければ town を出さない。3件そろえなくてよい）,",
  '  "sightseeingNotes": [{ "title": "正式な場所名のみ（例: 鴨川デルタ）", "body": "『〇〇です。改札から△へ徒歩□分。着くと◇が見える』型。各2〜3文。初めての人が迷わない具体。抽象語（気配・空気・色が先）禁止。由来再掲禁止" }]（UI表示名は『寄るところ』。先頭は firstVisitFaces に寄せる。historyNotes と同題は出さない）,',
  '  "storyNotes": [{ "title": "作品名や場所名", "body": "ドラマ・映画・小説などの撮影地／舞台。各2〜4文。駅から徒歩圏で実在確認できたものだけ。何の作品のどの場面か、いま歩いて何が見えるかを静かに書く" }]（0〜4件。無い駅は [] かキー省略。推測・都市伝説・遠いスタジオは禁止）,',
  '  "corridors": [',
  '    { "id": "任意", "name": "区間の呼び名", "kind": "road|streetscape|riverside|arcade", "blurb": "1〜3文。通って感じる空気", "path": [{ "lat": 0, "lng": 0 }, { "lat": 0, "lng": 0 }, { "lat": 0, "lng": 0 }], "relatedSpotNames": [], "walkMinutes": 5, "weaveBeforeKeys": ["目的地キーワード（寄り道区間のときだけ）"] }',
  "  ]（空気の道＝点ではなく通る区間。2〜3件。商店街・名所が無い駅ほど必須。名もなき微地形でよい。粋な経由なら weaveBeforeKeys を付ける）,",
  '  "preferredDetours": [',
  '    { "name": "経由の正式名", "beforeKeys": ["目的地キーワード"], "blurb": "なぜ最短よりこちらか1〜2文", "lat": 0, "lng": 0, "path": [{ "lat": 0, "lng": 0 }, { "lat": 0, "lng": 0 }, { "lat": 0, "lng": 0 }], "walkMinutes": 8 }',
  "  ]（粋な寄り道・0〜3件。大きな目的地の手前に通れる境内・川辺・商店街・坂があれば必須。無い・不確かなら []。出町以外に相国寺をコピーしない）,",
  '  "spots": [',
  "    {",
  '      "name": "土地文に出た正式名称、または徒歩圏の実在店名",',
  '      "genre": "history|gourmet|nature|odd",',
  '      "guide": "meal|souvenir|sight|rest|tip",',
  '      "mealTier": "casual|upscale（mealのみ）",',
  '      "mealTimes": ["morning|lunch|dinner"]（mealのみ）,',
  '      "soloOk": true|false（mealのみ）,',
  '      "budgetYen": "例 〜¥1,200",',
  '      "hours": "営業時間。屋外は終日（屋外）",',
  '      "blurb": "3〜4文",',
  '      "detail": "3〜4文",',
  '      "walkMinutes": 1〜40,',
  '      "lat": 緯度,',
  '      "lng": 経度,',
  '      "secretWorthy": boolean,',
  '      "majorWorthy": boolean',
  "    }",
  "  ]",
  "}",
  "",
  "制約（土地の文章と案内スポットを一度に返す）:",
  "- 日本の実在の鉄道駅でなければ { \"error\": \"not_a_station\", \"message\": \"理由\" } を返す。",
  "- 【出町柳雛形】役割の構成だけ借りる。固有名は出町柳のときだけ出町の名前。",
  "- firstVisitFaces: 実在する役割だけ 1〜3 件。town が無ければ出さない。欠けた役割を推測で埋めない。本文にも出した正式名称を書く。",
  "- 【真の空白駅】店・町場が本当に薄い駅は mood:empty 可。meal/souvenir は 0 件のままでよい。1.5km 超のチェーン・隣駅の店で枠を埋めない。",
  "- 【空白の歩き】店が無い駅は landform（川・用水・坂・田畑の道・橋）を firstVisitFaces の主役にする。神社・公園があれば足す。『何もない＝失敗』にせず、『店がないので風景を30分歩く駅』と catchCopy / emptyBody で肯定する。",
  "- 【空気の道 corridors】点の名所ではなく、通って感じる区間を 2〜3 本。商店街・名所川辺が無い駅では、固有観光名を捏造しない。切るもの: 線路沿いの細道／用水の低い道／住宅が畑・空き地に変わる境目／駅裏の静かな坂・擁壁沿い。name 例:『線路沿いの細道』『用水の低い道』『畑に変わる境目』。kind は主に road / streetscape。arcade・riverside は根拠があるときだけ。blurb は『何もないからこそ、足元の傾斜と風の通り道だけを感じて駅へ戻る』型。path は駅から徒歩圏の実座標3点前後。城下町・架空商店街禁止。",
  "- 【粋な寄り道 preferredDetours】全駅。spots の大きな目的地（大学・寺社・名所）へ向かうとき、手前に通れる土地らしい経由があれば preferredDetours に書く（例の型: 同志社←相国寺）。name=経由、beforeKeys=目的地キーワード、path=経由を東西／南北に通る実座標。walkGuide にも『〇〇へは△△を通る』と1文。無い駅は []。最短口調禁止。",
  "- 【散歩の口実】spots が 1〜2 件でもよい。無理に 3 役割を埋めない。1 つの landform があれば降りられる設計。",
  "- 【物語のゆかり】駅名＋『撮影地』『ロケ地』『舞台』『聖地』で思い浮かぶ作品があれば storyNotes に書く（作品名を正確に・最大4件）。映画・ドラマ・小説・アニメ可。徒歩圏の場所と作品を結び、いま歩いて何が見えるかを2〜4文で。無い・不確かなら []。観光ランキング口調にしない。",
  "- 【固有名の取り違え禁止】入力駅が出町柳以外なら、鴨川デルタ・下鴨神社・枡形商店街・出町ふたば・同志社大学・京都大学を本文に入れない。",
  "- empty の areaAbout は省略してよい。historyNotes は 2〜4 件で足りる。",
  "- 歴史だけで終わらせない。いまの姿も、同じメモの中で結んで書く。同じ話題を intro / area / history / sight で四重に書かない。",
  "- 駅の徒歩圏に大学があれば historyNotes で正式名称に触れる（遠い大学は寄せない）。",
  "- 出町柳の川名（必須）: 上流は賀茂川と高野川。合流点から南は鴨川。",
  "- 【出町柳・枡形】枡形商店街は京阪改札のすぐ外ではない。正: 5番出口から鴨川デルタの合流を通り、出町橋を西へ渡って枡形へ（徒歩約5分・叡電側からも同方向）。walkGuide / sightseeing は『デルタを通って枡形』の順。『枡形へ。その足でデルタ』は禁止。見出しに『京阪改札のすぐ外＝枡形』と書かない。",
  "- 【出町柳・食べ方】食べ物は駅前（ふたば等）で買って鴨川デルタで食べるのが定番。walkGuide に書く。『駅前で済ませて川端へ』は禁止。袋のままデルタへ、が土地の食べ方。",
  "- いちばん重要: 役割を分けて短く保つ。重複より、足りない一点を足す。",
  "- 禁止: 同じ川・同じ街を areaAbout と historyNotes の両方で長々と書く。story で historyNotes が2件未満は禁止。empty は2件以上でよい。",
  "- 【駅ができたわけ】stationIntro（〇〇駅のこと）に必須。Google検索で開業年・設置理由を確かめ、駅前の空気と同じ段落に書く。例:『〇〇線が△年に開業し、□のためにここに駅が置かれた。いま◇』。年が不確かなら捏造しない。historyNotes に開業だけを独立見出しで重複させない。",
  "- 【名所と店を分ける】名所・地形・町場（sight/tip と firstVisitFaces）は土地文の正式名称＋検索。meal/souvenir は別枠で、検索で実在を確認できた店だけ。",
  "- spots の名所側: 土地文に出た正式名称を先に全部起こす（sight 中心）。件数は名所が足りていればよい。",
  "- spots の店側: meal は 0〜4件、souvenir は 0〜3件。件数を埋めるための推測・総称・「駅前の食堂」・遠方チェーンは禁止。不確かなら 0件でよい。",
  "- rest は景色の休みを優先。喫茶は検索で実在確認できたときだけ（無理に埋めない）。",
  "- firstVisitFaces に出した点は majorWorthy true。major は名所を優先。名物店の major は検索で確実なときだけ。合計が少なくても確かならよい。",
  "- meal/souvenir は駅から徒歩18分以内・正式店名のみ。lat/lng は本物。駅へ寄せない。閉店・別駅の店は出さない。",
  "- 【mealは店内飲食できる店だけ】ライフデリ・配食・宅食・宅配弁当・高齢者向け配食サービスは出さない（事業所で入れない）。",
  "- 【駅前の名物めしは落とさない】石清水八幡宮駅前の朝日屋（鯖の棒寿司）のように、駅名と結びつく地元の定番食堂・寿司は meal に入れる（無い駅では無理に作らない）。",
  "- 【川・山の総称禁止】spots / firstVisitFaces の name に「淀川」「桂川」「鴨川」など川名だけを書かない。必ず「〇〇堤防」「三川合流点」「〇〇公園」など、歩いて立つ地点の固有名にする。",
  "- blurb に「駅から見渡せる」「一望」「眼下」と書かない。川辺・眺望は『駅から歩いて寄る場所』と書く。",
].join("\n");

const PLACES_FROM_LAND_SCHEMA = [
  "スキーマ:",
  "{",
  '  "name": "駅名（駅を付けない）",',
  '  "nameReading": "ひらがな読み",',
  '  "line": "路線名（検索で確認）",',
  '  "prefecture": "都道府県",',
  '  "region": "北海道|東北|関東|中部|近畿|中国|四国|九州",',
  '  "mood": "story|empty",',
  '  "lat": 駅の緯度,',
  '  "lng": 駅の経度,',
  '  "tourTitle": "28字以内",',
  '  "catchCopy": "40字以内",',
  '  "railHint": "確信があるときだけ1文。不確かなら省略",',
  '  "bikeRental": { "available": boolean, "summary": "1〜2文", "places": [] },',
  '  "firstVisitFaces": [',
  '    { "role": "landform|landmark|town", "name": "正式名", "where": "位置", "why": "1文", "present": "1文", "walkMinutes": 5, "lat": 0, "lng": 0 }',
  "  ],",
  '  "corridors": [],',
  '  "preferredDetours": [],',
  '  "storyNotes": [],',
  '  "spots": [',
  "    {",
  '      "name": "土地の文章に出た正式名称、またはその土地の実在店名",',
  '      "genre": "history|gourmet|nature|odd",',
  '      "guide": "meal|souvenir|sight|rest|tip",',
  '      "mealTier": "casual|upscale（mealのみ）",',
  '      "mealTimes": ["morning|lunch|dinner"]（mealのみ）,',
  '      "soloOk": true|false（mealのみ）,',
  '      "budgetYen": "例 〜¥1,200",',
  '      "hours": "営業時間。屋外は終日（屋外）",',
  '      "blurb": "3〜4文",',
  '      "detail": "3〜4文",',
  '      "walkMinutes": 1〜40,',
  '      "lat": 緯度,',
  '      "lng": 経度,',
  '      "secretWorthy": boolean,',
  '      "majorWorthy": boolean',
  "    }",
  "  ]",
  "}",
  "",
  "制約:",
  "- 【禁止】stationIntro / areaAbout / walkGuide / historyNotes / sightseeingNotes は出力しない（正本の土地文を使う）。",
  "- 【最重要・名所】spots の名所・地形・町場は、渡した土地の文章に登場する正式名称を先に全部起こす。文章に無い名所を先にリストしない。",
  "- 【最重要・店】meal/souvenir は Google検索で実在確認できた正式店名だけ。生活感に合わせて推測で埋めない。不確かなら 0件でよい。",
  "- spots: 名所（sight 等）を厚く。meal 0〜4、souvenir 0〜3。rest/tip は無理に増やさない。",
  "- firstVisitFaces がある点は majorWorthy true。役割が欠けていても名所が確かならよい。",
  "- 店が無い土地文なら meal/souvenir を足さない（遠方チェーン禁止）。",
  "- 出町柳以外で鴨川デルタ・下鴨・枡形・ふたば等を出さない。",
  "- 出町柳の枡形は京阪改札のすぐ外ではない（デルタを通って5番方面→出町橋西へ徒歩約5分）。",
  "- 駅の lat/lng と spots の lat/lng は本物。spots を駅へ寄せない。徒歩25分超は出さない。",
].join("\n");

function buildStationPrompt(rawName: string): string {
  const name = rawName.replace(/駅$/u, "").trim() || rawName.trim();
  return [
    "あなたは日本の駅の徒歩圏を案内する編集者です。",
    "Google検索の結果を優先し、実在する駅・名所・店だけを使ってください。",
    "【信頼】名所は土地文の正式名称から。店（meal/souvenir）は検索で確かめたものだけ。不確かな店は件数を埋めずに出さない。",
    WANDER_TONE_RULES,
    "【この段階】土地の文章と、地図・案内の spots（名所を厚く、店は確かなものだけ）を一度に返す。",
    "出力は JSON オブジェクトのみ（前後の説明文なし）。",
    "",
    DEMACHI_TEMPLATE_PROMPT,
    "",
    `入力された駅名: ${name}`,
    "",
    landAnchorPromptBlock(name),
    "",
    LAND_PROSE_ROLE_RULES,
    "",
    STATION_SCHEMA_BLOCK,
  ].join("\n");
}

function buildPlacesFromLandPrompt(station: StationSeed): string {
  const faces = (station.firstVisitFaces ?? [])
    .map((f) => `${f.role}:${f.name}`)
    .join("、");
  const hist = (station.historyNotes ?? [])
    .slice(0, 8)
    .map((n) => `【${n.title}】${n.body}`)
    .join("\n");
  const sight = (station.sightseeingNotes ?? [])
    .slice(0, 7)
    .map((n) => `【${n.title}】${n.body}`)
    .join("\n");
  return [
    "あなたは日本の駅の徒歩圏を案内する編集者です。",
    "Google検索で実在を確認し、地図・案内の spots を作ってください。",
    "【順番】土地の文章はすでにできている（正本）。書き換えない。正式名称から spots を起こす。",
    WANDER_TONE_RULES,
    "出力は JSON のみ。",
    "",
    `駅名: ${station.name}`,
    `firstVisitFaces（参考）: ${faces || "（なし・土地文から起こす）"}`,
    "",
    "—— 土地の文章（正本・書き換え禁止）——",
    `stationIntro: ${station.stationIntro ?? ""}`,
    `areaAbout: ${station.areaAbout ?? ""}`,
    `walkGuide: ${station.walkGuide ?? ""}`,
    "historyNotes:",
    hist || "（なし）",
    "sightseeingNotes:",
    sight || "（なし）",
    "",
    landAnchorPromptBlock(station.name),
    "",
    PLACES_FROM_LAND_SCHEMA,
  ].join("\n");
}

function buildNearbyPrompt(lat: number, lng: number): string {
  return [
    "あなたは日本の駅の徒歩圏を案内する編集者です。",
    "Google検索の結果を優先し、実在する駅・名所だけを使ってください。",
    WANDER_TONE_RULES,
    "【この段階】最寄り駅を特定し、土地の文章と案内 spots（名所・ご飯・土産・休む）を一度に返す。",
    "出力は JSON オブジェクトのみ（前後の説明文なし）。",
    "",
    DEMACHI_TEMPLATE_PROMPT,
    "",
    // Coarsened coords only (~1 km). Do not ask the model for finer precision.
    `現在地（おおよそ）: 緯度 ${lat.toFixed(2)}, 経度 ${lng.toFixed(2)}`,
    "座標は約1km単位に丸めてあります。この付近で最も近い実在の鉄道駅（新幹線停車駅より、最寄りの在来線・私鉄駅を優先）を特定し、その駅名で土地文を返す。",
    "特定した駅に近い大学・キャンパスがあるなら、総称ではなく正式名称（例: 京都大学、同志社大学）を土地文に書く。",
    "",
    LAND_PROSE_ROLE_RULES,
    "",
    STATION_SCHEMA_BLOCK,
  ].join("\n");
}

function parseSpot(raw: unknown, index: number): Spot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const rawName = asString(o.name);
  let blurb = asString(o.blurb);
  if (!rawName || !blurb) return null;
  const name = clarifyLandscapeName(rawName);
  if (shouldRewriteLandscapeBlurb(blurb, rawName)) {
    blurb = landscapeWalkBlurb(
      rawName,
      clamp(Math.round(asNumber(o.walkMinutes, 10)), 1, 45),
    );
  }

  const genreRaw = asString(o.genre, "odd") as SpotGenre;
  const genre = GENRE_SET.has(genreRaw) ? genreRaw : "odd";
  const guideRaw = asString(o.guide) as GuideKind;
  const guide = GUIDE_SET.has(guideRaw) ? guideRaw : undefined;

  const walkMinutes = clamp(Math.round(asNumber(o.walkMinutes, 10)), 1, 45);
  const x = clamp(0.2 + (index % 5) * 0.12, 0.12, 0.88);
  const y = clamp(0.25 + Math.floor(index / 5) * 0.18, 0.18, 0.82);

  const spot: Spot = {
    id: `ai-spot-${index + 1}`,
    name,
    genre,
    guide,
    hours: asString(o.hours) || undefined,
    blurb,
    detail: asString(o.detail) || undefined,
    x,
    y,
    walkMinutes,
    secretWorthy: o.secretWorthy === true,
    majorWorthy: o.majorWorthy === true,
  };

  if (typeof o.lat === "number" && typeof o.lng === "number") {
    spot.lat = o.lat;
    spot.lng = o.lng;
  }

  if (guide === "meal" || (!guide && genre === "gourmet")) {
    const tier = asString(o.mealTier, "casual") as MealTier;
    spot.mealTier = MEAL_TIER_SET.has(tier) ? tier : "casual";
    const timesRaw = Array.isArray(o.mealTimes) ? o.mealTimes : ["lunch"];
    const times = timesRaw
      .map((t) => asString(t) as MealTime)
      .filter((t): t is MealTime => MEAL_TIME_SET.has(t));
    spot.mealTimes = times.length > 0 ? times : ["lunch"];
    if (typeof o.soloOk === "boolean") {
      spot.soloOk = o.soloOk;
    } else {
      spot.soloOk = spot.mealTier !== "upscale";
    }
    const budget = asString(o.budgetYen);
    spot.budgetYen =
      budget || (spot.mealTier === "upscale" ? "¥3,000〜" : "〜¥1,500");
    if (!spot.guide) spot.guide = "meal";
  }

  return spot;
}

function parseBike(raw: unknown): BikeRentalInfo | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const summary = asString(o.summary);
  if (!summary) return undefined;
  const placesRaw = Array.isArray(o.places) ? o.places : [];
  const places = placesRaw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const p = row as Record<string, unknown>;
      const name = asString(p.name);
      if (!name) return null;
      if (
        /^(駅前のレンタ|周辺のレンタ|レンタサイクル店|貸自転車|シェアサイクル|レンタサイクル)/.test(
          name,
        ) &&
        name.length < 14
      ) {
        return null;
      }
      const kindRaw = asString(p.kind);
      const kind =
        kindRaw === "app" || kindRaw === "local"
          ? kindRaw
          : /シェア|アプリ|HELLO|ドコモ|CLEW|クルー|CREW|Clew/i.test(name)
            ? ("app" as const)
            : ("local" as const);
      const walk =
        typeof p.walkMinutes === "number" && Number.isFinite(p.walkMinutes)
          ? Math.round(p.walkMinutes)
          : undefined;
      if (typeof walk === "number" && walk > 8) return null;
      const note = asString(p.note) || undefined;
      return { name, kind, walkMinutes: walk, note };
    })
    .filter((p): p is NonNullable<typeof p> => !!p)
    .slice(0, 6);
  const available = places.length > 0 && o.available === true;
  return {
    available,
    summary: available
      ? summary
      : "この駅で確認できたレンタサイクルは、いまのところありません。",
    places: places.length > 0 ? places : undefined,
  };
}

export function parseAiStationPayload(
  parsed: Record<string, unknown>,
  requestedName: string,
): StationSeed | { error: string; message: string } {
  if (asString(parsed.error) === "not_a_station") {
    return {
      error: "not_a_station",
      message:
        asString(parsed.message) ||
        "鉄道の駅として確認できませんでした。別の駅名で試してください。",
    };
  }

  const name =
    asString(parsed.name).replace(/駅$/u, "") ||
    requestedName.replace(/駅$/u, "").trim() ||
    requestedName.trim();
  if (!name) {
    return { error: "invalid", message: "駅名が空です。" };
  }

  const regionRaw = asString(parsed.region, "関東");
  const region = (
    REGION_SET.has(regionRaw) ? regionRaw : "関東"
  ) as StationSeed["region"];
  const mood: StationMood = parsed.mood === "empty" ? "empty" : "story";

  const spotsRaw = Array.isArray(parsed.spots) ? parsed.spots : [];
  const spots = spotsRaw
    .map((s, i) => parseSpot(s, i))
    .filter((s): s is Spot => !!s)
    .slice(0, 22);

  const facesPreview = parseFirstVisitFaces(parsed.firstVisitFaces);
  // 土地文先出し: spots は後段で土地文から起こす。faces があれば空でも進む。
  if (spots.length === 0 && !(facesPreview && facesPreview.length >= 1)) {
    const hasLand =
      asString(parsed.areaAbout).length >= 80 ||
      asString(parsed.stationIntro).length >= 80 ||
      (parseNoteList(parsed.historyNotes, 3)?.length ?? 0) >= 2;
    if (!hasLand) {
    return {
      error: "empty_spots",
      message: "案内スポットを作れませんでした。別の駅名で試してください。",
    };
    }
  }

  const lat = asNumber(parsed.lat, 35.0);
  const lng = asNumber(parsed.lng, 135.0);

  const historyNotes = parseNoteList(parsed.historyNotes, 9);
  const sightseeingNotes = parseNoteList(parsed.sightseeingNotes, 8);
  const storyNotes = parseNoteList(parsed.storyNotes, 4);
  const firstVisitFaces = parseFirstVisitFaces(parsed.firstVisitFaces);

  let station: StationSeed = {
    id: slugifyStationName(name),
    name,
    nameReading: asString(parsed.nameReading) || undefined,
    line: asString(parsed.line, "路線情報は要確認"),
    prefecture: asString(parsed.prefecture, "日本"),
    region,
    mood,
    radiiKm: [0.9, 1.0, 1.2],
    stationIntro: asString(parsed.stationIntro) || undefined,
    areaAbout: asString(parsed.areaAbout) || undefined,
    walkGuide: asString(parsed.walkGuide) || undefined,
    historyNotes: historyNotes && historyNotes.length > 0 ? historyNotes : undefined,
    sightseeingNotes:
      sightseeingNotes && sightseeingNotes.length > 0
        ? sightseeingNotes
        : undefined,
    storyNotes:
      storyNotes && storyNotes.length > 0 ? storyNotes : undefined,
    bikeRental: parseBike(parsed.bikeRental),
    tourTitle:
      asString(parsed.tourTitle).slice(0, 28) ||
      `${name}の徒歩圏を、ゆるく歩く`,
    catchCopy:
      asString(parsed.catchCopy).slice(0, 40) ||
      "降りた場所から、予定のない寄り道を。",
    railHint: sanitizeRailHint(asString(parsed.railHint)) || undefined,
    spots,
    lat,
    lng,
    source: "ai",
    firstVisitFaces,
    corridors: [],
  };
  station = {
    ...station,
    corridors: parseCorridors(parsed.corridors, station),
    preferredDetours: Array.isArray(parsed.preferredDetours)
      ? (parsed.preferredDetours as StationSeed["preferredDetours"])
      : undefined,
  };

  if (mood === "empty") {
    station.emptyCopy = {
      headline:
        asString(parsed.emptyHeadline).slice(0, 20) || "用事のない駅を、歩いて帰る",
      body:
        asString(parsed.emptyBody).slice(0, 80) ||
        "寄るところが少ないぶん、坂や川の向きだけを見て歩けます。小回りして、駅へ帰る。",
    };
  }

  station = applyFirstVisitFaces(station);
  // 出町雛形の固有名が他駅へ漏れたときの最後の門
  station = {
    ...station,
    spots: station.spots.filter(
      (s) => !isForeignDemachiPlace(s.name, station.name),
    ),
    sightseeingNotes: (station.sightseeingNotes ?? []).filter(
      (n) => !isForeignDemachiPlace(n.title, station.name),
    ),
    storyNotes: (station.storyNotes ?? []).filter(
      (n) => !isForeignDemachiPlace(n.title, station.name),
    ),
    firstVisitFaces: (station.firstVisitFaces ?? []).filter(
      (f) => !isForeignDemachiPlace(f.name, station.name),
    ),
  };
  return station;
}

type GeminiCallResult =
  | { ok: true; text: string }
  | { ok: false; error: string; message: string };

const GEMINI_FAST_MS = 22_000;
const GEMINI_GROUNDED_MS = 32_000;
const GEMINI_EXPAND_MS = 28_000;

/** 出町並みでない歩き方（抽象・方角なし・短すぎ）。検索生成の精度バー用。 */
export function isWalkGuideImprecise(text: string | undefined): boolean {
  const t = (text ?? "").trim();
  if (t.length < 48) return true;
  if (/滞在のリズム|空気を感|気配を|色が先/.test(t)) return true;
  if (!/(出口|改札|徒歩|分|北|南|東|西|通り|橋|川|坂)/.test(t)) return true;
  return false;
}

/** 寄るところが出町並みの『正式名＋行き方＋着いたら』になっていない。 */
export function isSightseeingImprecise(
  notes: AreaHistoryNote[] | undefined,
): boolean {
  if (!notes?.length) return true;
  const ok = notes.filter((n) => {
    const title = (n.title ?? "").trim();
    const body = (n.body ?? "").trim();
    if (body.length < 24) return false;
    if (/気配|空気が|色が先/.test(body)) return false;
    // title は場所名。方角だけの見出しは不可
    if (/^(北|南|東|西|方角|徒歩|見るポイント)/.test(title)) return false;
    if (title.length < 2) return false;
    return /(です。|徒歩|分|出口|改札|方面)/.test(body);
  });
  return ok.length < Math.min(2, notes.length);
}

/** 駅の開業・設置理由が stationIntro（〇〇駅のこと）に無い。 */
export function isStationFoundingMissing(
  intro: string | undefined,
): boolean {
  const t = (intro ?? "").trim();
  if (t.length < 40) return true;
  return !(
    /(開業|開通|開設|設置|開駅|置かれた|延伸)/.test(t) &&
    /(年|明治|大正|昭和|平成|令和|世紀)/.test(t)
  );
}

function needsPrecisionPolish(station: StationSeed): boolean {
  return (
    isWalkGuideImprecise(station.walkGuide) ||
    isSightseeingImprecise(station.sightseeingNotes) ||
    isStationFoundingMissing(station.stationIntro)
  );
}

function isNarrativeThin(station: StationSeed): boolean {
  // 足りていれば追加呼び出ししない（以前より緩め＝スキップしやすい）。
  const intro = (station.stationIntro ?? "").length;
  const about = (station.areaAbout ?? "").length;
  const walk = (station.walkGuide ?? "").length;
  const notes = station.historyNotes ?? [];
  const histChars = notes.reduce((n, h) => n + h.body.length, 0);
  const sight = station.sightseeingNotes ?? [];
  if (station.mood === "empty") {
    return intro < 80 || about < 160 || walk < 60 || notes.length < 2;
  }
  return (
    intro < 160 ||
    about < 240 ||
    walk < 100 ||
    notes.length < 4 ||
    histChars < 320 ||
    sight.length < 3
  );
}

function parseNoteList(
  raw: unknown,
  limit: number,
): Array<{ title: string; body: string }> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const notes = raw
    .map((n) => {
      if (!n || typeof n !== "object") return null;
      const o = n as Record<string, unknown>;
      const title = asString(o.title);
      const body = asString(o.body);
      if (!title || !body) return null;
      return { title, body };
    })
    .filter((n): n is { title: string; body: string } => !!n)
    .slice(0, limit);
  return notes.length > 0 ? notes : undefined;
}

function parseCorridors(
  raw: unknown,
  station: StationSeed,
  limit = 4,
): AtmosphereCorridor[] {
  if (!Array.isArray(raw)) return [];
  const out: AtmosphereCorridor[] = [];
  const names = new Set<string>();
  for (const [i, item] of raw.entries()) {
    if (out.length >= limit) break;
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const path = Array.isArray(o.path)
      ? o.path.map((p) => {
          if (!p || typeof p !== "object") return { lat: NaN, lng: NaN };
          const c = p as Record<string, unknown>;
          return { lat: asNumber(c.lat, NaN), lng: asNumber(c.lng, NaN) };
        })
      : [];
    const related = Array.isArray(o.relatedSpotNames)
      ? o.relatedSpotNames.map((s) => asString(s)).filter(Boolean)
      : [];
    const weaveBeforeKeys = Array.isArray(o.weaveBeforeKeys)
      ? o.weaveBeforeKeys.map((s) => asString(s)).filter((s) => s.length >= 2)
      : undefined;
    const c = sanitizeCorridor(
      {
        id: asString(o.id) || undefined,
        name: asString(o.name),
        kind: asString(o.kind, "road"),
        blurb: asString(o.blurb),
        path,
        relatedSpotNames: related,
        walkMinutes: asNumber(o.walkMinutes, 6),
        ...(weaveBeforeKeys?.length ? { weaveBeforeKeys } : {}),
      },
      station,
      i,
    );
    if (!c || names.has(c.name)) continue;
    names.add(c.name);
    out.push(c);
  }
  return out;
}

/** API 区間 ∪ 派生 ∪ 名もなき微地形。出町正本は corridorsForStation 内で優先。 */
function sealAtmosphereCorridors(station: StationSeed): StationSeed {
  const fromAi = parseCorridors(station.corridors, station);
  const merged = corridorsForStation({ ...station, corridors: fromAi });
  // 粋な寄り道を後段で先頭に足す余地を残す
  return { ...station, corridors: merged.slice(0, 5) };
}

/** 運行目安。短い・確信っぽいものだけ通す（宣伝口調や長い文は捨てる）。 */
function sanitizeRailHint(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (t.length < 6 || t.length > 48) return "";
  if (/http|www\.|予約|ランキング|必見|絶対/i.test(t)) return "";
  const ok =
    /本数|時刻|ローカル|近郊|都市|閑散|終電|帰る|運行|単線|電鉄|電車/.test(t);
  return ok ? t : "";
}

const ROLE_SET = new Set<FirstVisitRole>(["landform", "landmark", "town"]);

function parseFirstVisitFaces(raw: unknown): FirstVisitFace[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const faces: FirstVisitFace[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const roleRaw = asString(o.role) as FirstVisitRole;
    const rawName = asString(o.name);
    if (!ROLE_SET.has(roleRaw) || !rawName) continue;
    const name = clarifyLandscapeName(rawName);
    const lat = asNumber(o.lat, Number.NaN);
    const lng = asNumber(o.lng, Number.NaN);
    faces.push({
      role: roleRaw,
      name,
      where: asString(o.where) || undefined,
      why: asString(o.why) || undefined,
      present: asString(o.present) || undefined,
      walkMinutes: asNumber(o.walkMinutes, 8) || 8,
      ...(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {}),
    });
  }
  // 役割ごとに先頭1件だけ（出町雛形の3点）
  const byRole = new Map<FirstVisitRole, FirstVisitFace>();
  for (const face of faces) {
    if (!byRole.has(face.role)) byRole.set(face.role, face);
  }
  const ordered = (["landform", "landmark", "town"] as FirstVisitRole[])
    .map((r) => byRole.get(r))
    .filter((f): f is FirstVisitFace => !!f);
  // 真の空白駅は landform だけ等もありうる
  return ordered.length >= 1 ? ordered : undefined;
}

/** firstVisitFaces を観光メモ・スポットへ降ろす（知らない駅も出町と同じ型）。 */
function applyFirstVisitFaces(station: StationSeed): StationSeed {
  const faces = (station.firstVisitFaces ?? []).filter(
    (f) => !isForeignDemachiPlace(f.name, station.name),
  );
  if (!faces.length) return station;

  const faceNotes = faces.map((f) => ({
    title: f.name === "下鴨神社" ? "下鴨神社と糺の森" : f.name,
    body: [f.why, f.present].filter(Boolean).join("") || `${f.name}。この駅の土地の顔。`,
  }));
  // 雛形3点のあとに、AIが書いた実用メモを足す（上書きで消さない）
  const extras = (station.sightseeingNotes ?? []).filter((n) => {
    if (isForeignDemachiPlace(n.title, station.name)) return false;
    return !faceNotes.some(
      (f) =>
        n.title.includes(f.title) ||
        f.title.includes(n.title) ||
        faces.some((face) => n.title.includes(face.name)),
    );
  });
  const sightseeingNotes = [...faceNotes, ...extras].slice(0, 7);

  let spots = [...(station.spots ?? [])];
  for (const face of faces) {
    const idx = spots.findIndex(
      (s) => s.name.includes(face.name) || face.name.includes(s.name),
    );
    if (idx >= 0) {
      const cur = spots[idx]!;
      spots[idx] = {
        ...cur,
        name: cur.name.includes(face.name) ? cur.name : face.name,
        majorWorthy: true,
        guide: cur.guide ?? "sight",
        lat: face.lat ?? cur.lat,
        lng: face.lng ?? cur.lng,
        walkMinutes: face.walkMinutes ?? cur.walkMinutes,
        coordTrust:
          face.lat != null && face.lng != null
            ? ("lock" as const)
            : cur.coordTrust,
      };
      continue;
    }
    if (face.lat == null || face.lng == null) continue;
    spots.push({
      id: `face-${face.role}-${face.name.replace(/\s+/g, "").slice(0, 24)}`,
      name: face.name,
      genre: face.role === "landform" ? "nature" : "history",
      guide: "sight",
      mealTier: "casual",
      mealTimes: [],
      soloOk: true,
      budgetYen: "—",
      hours: "終日（屋外）",
      blurb: [face.why, face.present].filter(Boolean).join(" "),
      detail: face.where,
      walkMinutes: face.walkMinutes ?? 8,
      x: 0.45,
      y: 0.4,
      majorWorthy: true,
      secretWorthy: false,
      lat: face.lat,
      lng: face.lng,
      coordTrust: "lock",
    });
  }

  return { ...station, sightseeingNotes, spots };
}

function buildNarrativeExpandPrompt(station: StationSeed): string {
  return [
    "あなたは日本の駅の徒歩圏を案内する編集者です。",
    "実在の歴史・地名由来・産業・信仰・交通の変遷に加え、いまの生活・通学・店の気配も書いて、薄い紹介文を厚く書き直してください。",
    "近くに大学・キャンパス・学生街があれば正式名称で触れる（例: 出町柳なら京都大学・同志社大学）。",
    WANDER_TONE_RULES,
    "出力は JSON オブジェクトのみ。",
    "",
    `駅名: ${station.name}`,
    `路線: ${station.line}`,
    `都道府県: ${station.prefecture}`,
    `既存の短い紹介: ${station.stationIntro ?? "(なし)"}`,
    `既存の短いエリア文: ${station.areaAbout ?? "(なし)"}`,
    "",
    landAnchorPromptBlock(station.name),
    "",
    LAND_PROSE_ROLE_RULES,
    "",
    "スキーマ:",
    "{",
    '  "stationIntro": "3〜5文。改札・乗り換え・駅前の空気だけ。由来の詳説は書かない",',
    '  "areaAbout": "historyNotes が厚いときは省略。薄いときだけ1〜2文",',
    '  "walkGuide": "3〜6文。回り道の順番と方角だけ。由来は書かない",',
    '  "bikeRentalSummary": "2〜3文",',
    '  "historyNotes": [{ "title": "...", "body": "2〜4文。各件で由来といまを結ぶ" }]（4〜6件。同じ主題の二重記載禁止）,',
    '  "sightseeingNotes": [{ "title": "...", "body": "正式名＋方角・分＋着いたら何があるか。抽象禁止" }]（history と同題は出さない）',
    '  "storyNotes": [{ "title": "...", "body": "2〜4文" }]（徒歩圏のドラマ・映画・小説の撮影地／舞台。確かなものだけ。無ければ []）',
    "}",
    "",
    "同じ話題を intro / area / history / sight で繰り返さない。必須の具体名は historyNotes に一度だけ。",
  ].join("\n");
}

function countGuide(station: StationSeed, guide: GuideKind): number {
  return station.spots.filter((s) => s.guide === guide).length;
}

function isShopThin(station: StationSeed): boolean {
  // 信頼優先: 件数不足では薄扱いにしない。完全に0のときだけ任意補完の候補。
  return (
    countGuide(station, "meal") === 0 && countGuide(station, "souvenir") === 0
  );
}

function buildShopExpandPrompt(station: StationSeed): string {
  const meals = station.spots
    .filter((s) => s.guide === "meal")
    .map((s) => s.name)
    .join("、");
  const souvenirs = station.spots
    .filter((s) => s.guide === "souvenir")
    .map((s) => s.name)
    .join("、");
  return [
    "あなたは日本の駅の徒歩圏を案内する編集者です。",
    "Google検索で実在を確認できる店だけを使う。件数より確かさを優先する。",
    WANDER_TONE_RULES,
    "出力は JSON のみ。",
    "",
    `駅名: ${station.name}（${station.prefecture} · ${station.line}）`,
    `駅座標の目安: ${station.lat}, ${station.lng}`,
    `既存のご飯: ${meals || "（なし）"}`,
    `既存のお土産: ${souvenirs || "（なし）"}`,
    "",
    "スキーマ:",
    "{",
    '  "spots": [',
    "    {",
    '      "name": "実在店の正式名称",',
    '      "guide": "meal|souvenir",',
    '      "genre": "gourmet|odd",',
    '      "mealTier": "casual|upscale（mealのみ）",',
    '      "mealTimes": ["morning|lunch|dinner"]（mealのみ）,',
    '      "soloOk": true|false（mealのみ）,',
    '      "budgetYen": "例 〜¥1,200",',
    '      "hours": "営業時間",',
    '      "blurb": "3〜4文",',
    '      "detail": "3〜4文",',
    '      "walkMinutes": 1〜18,',
    '      "lat": number,',
    '      "lng": number',
    "    }",
    "  ]",
    "}",
    "",
    "制約:",
    `- いま meal ${countGuide(station, "meal")} / souvenir ${countGuide(station, "souvenir")}。検索で確実な店だけ追加（目安 meal 合計≤${PREFERRED_MEAL_SPOTS}、souvenir≤${PREFERRED_SOUVENIR_SPOTS}）。件数を埋めるための推測は禁止。見つからなければ spots: []。`,
    "- 既存と同名は出さない。名物菓子は souvenir 側。",
    "- meal は土地の定番めし優先: 地元パン屋・おにぎり・商店街の食堂・うどん・そば・定食。多目的カフェ・コワーキングは足さない。",
    "- 返す spots は追加する店だけ。",
    "- 徒歩18分以内のみ。遠い店・別エリア・閉店・確認できない店は出さない。座標を駅へ寄せない。",
    "- blurb と detail は各3文以上。",
  ].join("\n");
}

async function expandShopSpots(
  station: StationSeed,
  apiKey: string,
  viewerSub: string,
): Promise<StationSeed> {
  if (!isShopThin(station)) return station;

  const expanded = await callGeminiGenerate(
    apiKey,
    viewerSub,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: buildShopExpandPrompt(station) }],
        },
      ],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 4096,
      },
    },
    GEMINI_EXPAND_MS,
  );
  if (!expanded.ok) return station;
  const parsed = extractJsonObject(expanded.text);
  if (!parsed || !Array.isArray(parsed.spots)) return station;

  const existingNames = new Set(
    station.spots.map((s) => s.name.replace(/\s+/g, "")),
  );
  const extras = parsed.spots
    .map((raw, i) => parseSpot(raw, station.spots.length + i))
    .filter((s): s is Spot => {
      if (!s) return false;
      if (s.guide !== "meal" && s.guide !== "souvenir") return false;
      const key = s.name.replace(/\s+/g, "");
      if (existingNames.has(key)) return false;
      existingNames.add(key);
      return true;
    });

  if (extras.length === 0) return station;
  return {
    ...station,
    spots: [...station.spots, ...extras].slice(0, 22),
  };
}

const MIN_REST_SPOTS = 3;

function isSitDownCafeName(name: string): boolean {
  if (/多目的|つながる|知る、感じる|コワーキング|レンタルスペース|シェアキッチン/.test(name)) {
    return false;
  }
  if (/食堂|定食|レストラン|ラーメン|うどん|そば|寿司|すし|焼肉|居酒屋/.test(name)) {
    return false;
  }
  return /喫茶|純喫茶|茶房|カフェ|珈琲|コーヒー/.test(name);
}

function buildRestExpandPrompt(station: StationSeed): string {
  const rests = station.spots
    .filter((s) => s.guide === "rest")
    .map((s) => s.name)
    .join("、");
  const names = station.spots.map((s) => s.name).join("、");
  return [
    "あなたは日本の駅の徒歩圏を案内する編集者です。",
    "Google検索で実在を確認し、「休むところ」だけを足してください。店名の固定リストは使わない。この駅の徒歩圏から自分で選ぶ。",
    "出力は JSON のみ。",
    "",
    `駅名: ${station.name}（${station.prefecture} · ${station.line}）`,
    `駅座標の目安: ${station.lat}, ${station.lng}`,
    `既存の休むところ: ${rests || "（なし）"}`,
    `既に案内にある名前（再掲禁止）: ${names || "（なし）"}`,
    "",
    "スキーマ:",
    '{ "spots": [ { "name", "guide":"rest", "genre":"nature|town|gourmet", "blurb", "detail", "walkMinutes", "lat", "lng", "hours" } ] }',
    "",
    "制約:",
    `- rest が合計${MIN_REST_SPOTS}件以上になるまで追加する。返すのは追加分だけ。`,
    "- 腰を下ろせる景色を1件以上（川の合流、三角州、公園、橋のたもと、並木）。固有名詞にする。",
    "- 長居できる喫茶・カフェ・茶房を1件以上（guide は rest）。定食屋・食堂は入れない（それらはご飯）。",
    "- 寺・神社そのものは入れない（観光）。",
    "- 駅から徒歩18分以内。座標を駅へ寄せない。確認できない場所は出さない。",
    "- blurb と detail は各3文以上。そこでどう休むかを書く。",
  ].join("\n");
}

function hasSitDownCafeRest(station: StationSeed): boolean {
  return station.spots.some((s) => s.guide === "rest" && isSitDownCafeName(s.name));
}

async function expandRestSpots(
  station: StationSeed,
  apiKey: string,
  viewerSub: string,
): Promise<StationSeed> {
  if (countGuide(station, "rest") >= MIN_REST_SPOTS && hasSitDownCafeRest(station)) {
    return station;
  }
  const expanded = await callGeminiGenerate(
    apiKey,
    viewerSub,
    {
      contents: [
        { role: "user", parts: [{ text: buildRestExpandPrompt(station) }] },
      ],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 3072 },
    },
    GEMINI_EXPAND_MS,
  );
  if (!expanded.ok) return station;
  const parsed = extractJsonObject(expanded.text);
  if (!parsed || !Array.isArray(parsed.spots)) return station;
  const existingNames = new Set(station.spots.map((s) => s.name.replace(/\s+/g, "")));
  const extras = parsed.spots
    .map((raw, i) => parseSpot(raw, station.spots.length + i))
    .filter((s): s is Spot => {
      if (!s || s.guide !== "rest") return false;
      const key = s.name.replace(/\s+/g, "");
      if (existingNames.has(key)) return false;
      existingNames.add(key);
      return true;
    });
  if (extras.length === 0) return station;
  return { ...station, spots: [...station.spots, ...extras] };
}

async function expandStationNarrative(
  station: StationSeed,
  apiKey: string,
  viewerSub: string,
): Promise<StationSeed> {
  if (!isNarrativeThin(station)) return station;

  const expanded = await callGeminiGenerate(
    apiKey,
    viewerSub,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: buildNarrativeExpandPrompt(station) }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 6144,
        responseMimeType: "application/json",
      },
    },
    GEMINI_EXPAND_MS,
  );
  if (!expanded.ok) return station;

  const parsed = extractJsonObject(expanded.text);
  if (!parsed) return station;

  const historyNotes =
    parseNoteList(parsed.historyNotes, 9) ?? station.historyNotes;
  const sightseeingNotes =
    parseNoteList(parsed.sightseeingNotes, 8) ?? station.sightseeingNotes;
  const storyNotes =
    parseNoteList(parsed.storyNotes, 4) ?? station.storyNotes;
  const stationIntro = asString(parsed.stationIntro) || station.stationIntro;
  const areaAbout = asString(parsed.areaAbout) || station.areaAbout;
  const walkGuide = asString(parsed.walkGuide) || station.walkGuide;
  const bikeSummary = asString(parsed.bikeRentalSummary);

  return {
    ...station,
    stationIntro:
      (stationIntro?.length ?? 0) >= (station.stationIntro?.length ?? 0)
        ? stationIntro
        : station.stationIntro,
    areaAbout:
      (areaAbout?.length ?? 0) >= (station.areaAbout?.length ?? 0)
        ? areaAbout
        : station.areaAbout,
    walkGuide:
      (walkGuide?.length ?? 0) >= (station.walkGuide?.length ?? 0)
        ? walkGuide
        : station.walkGuide,
    historyNotes:
      (historyNotes?.length ?? 0) >= (station.historyNotes?.length ?? 0)
        ? historyNotes
        : station.historyNotes,
    storyNotes:
      (storyNotes?.length ?? 0) >= (station.storyNotes?.length ?? 0)
        ? storyNotes
        : station.storyNotes,
    sightseeingNotes:
      (sightseeingNotes?.length ?? 0) >= (station.sightseeingNotes?.length ?? 0)
        ? sightseeingNotes
        : station.sightseeingNotes,
    bikeRental: station.bikeRental
      ? {
          ...station.bikeRental,
          summary:
            bikeSummary.length > station.bikeRental.summary.length
              ? bikeSummary
              : station.bikeRental.summary,
        }
      : bikeSummary
        ? { available: true, summary: bikeSummary }
        : station.bikeRental,
  };
}

function extractPromptTextFromGeminiBody(body: Record<string, unknown>): string {
  const contents = body.contents;
  if (!Array.isArray(contents)) return "";
  const chunks: string[] = [];
  for (const item of contents) {
    if (!item || typeof item !== "object") continue;
    const parts = (item as { parts?: Array<{ text?: string }> }).parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (typeof part?.text === "string" && part.text.trim()) {
        chunks.push(part.text);
      }
    }
  }
  return chunks.join("\n\n").trim();
}

async function callOpenAiCompatibleGenerate(
  config: UserAiConfig,
  viewerSub: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<GeminiCallResult> {
  const paid = beginPaidAiCall(viewerSub);
  if (!paid.ok) {
    return {
      ok: false,
      error: "gemini_http",
      message: "いま混み合っています。少し待ってから、もう一度どうぞ。",
    };
  }

  const prompt = extractPromptTextFromGeminiBody(body);
  if (!prompt) {
    paid.release();
    return {
      ok: false,
      error: "empty_response",
      message: "案内の入力を組み立てられませんでした。もう一度どうぞ。",
    };
  }

  const base = (config.baseUrl || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  const model = config.model || "gpt-4o-mini";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.45,
        max_tokens: 8192,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "あなたは日本の駅の徒歩圏案内の編集者です。出力は JSON オブジェクトのみ。前後に説明文を付けない。",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        ok: false,
        error: "gemini_http",
        message: `AI API への接続に失敗しました（${res.status}）。${detail.slice(0, 120)}`,
      };
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) {
      return {
        ok: false,
        error: "empty_response",
        message: "AI から案内が返りませんでした。もう一度どうぞ。",
      };
    }
    return { ok: true, text };
  } catch (err) {
    const aborted =
      err instanceof Error &&
      (err.name === "AbortError" || /aborted/i.test(err.message));
    return {
      ok: false,
      error: aborted ? "timeout" : "network",
      message: aborted
        ? "案内の生成が時間切れになりました。もう一度どうぞ。"
        : "AI API への通信に失敗しました。もう一度どうぞ。",
    };
  } finally {
    clearTimeout(timer);
    paid.release();
  }
}

async function callGeminiGenerate(
  apiKey: string,
  viewerSub: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<GeminiCallResult> {
  const byok = byokRuntime.getStore();
  if (byok?.provider === "openai") {
    // OpenAI 互換には Google Search grounding が無いので、プロンプト本文だけで JSON を返す。
    return callOpenAiCompatibleGenerate(byok, viewerSub, body, timeoutMs);
  }

  const key = byok?.provider === "gemini" ? byok.apiKey : apiKey;
  const paid = beginPaidAiCall(viewerSub);
  if (!paid.ok) {
    return {
      ok: false,
      error: "gemini_http",
      message: "いま混み合っています。少し待ってから、もう一度どうぞ。",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // BYOK の Gemini でも Search は使える（ユーザー課金）。ホスト経路と同じ。
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        ok: false,
        error: "gemini_http",
        message: `Gemini への接続に失敗しました（${res.status}）。${detail.slice(0, 120)}`,
      };
    }
    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) {
      return {
        ok: false,
        error: "empty_response",
        message: "Gemini から案内が返りませんでした。もう一度どうぞ。",
      };
    }
    return { ok: true, text };
  } catch (err) {
    const aborted =
      err instanceof Error &&
      (err.name === "AbortError" || /aborted/i.test(err.message));
    return {
      ok: false,
      error: aborted ? "timeout" : "network",
      message: aborted
        ? "案内の生成が時間切れになりました。もう一度どうぞ。"
        : "Gemini への通信に失敗しました。もう一度どうぞ。",
    };
  } finally {
    clearTimeout(timer);
    paid.release();
  }
}

function stationFromGeminiText(
  text: string,
  rawName: string,
): AiStationResult | { error: string; message: string } {
  const parsed = extractJsonObject(text);
  if (!parsed) {
    return {
      error: "bad_json",
      message: "案内の形式を読めませんでした。もう一度どうぞ。",
    };
  }
  const stationOrErr = parseAiStationPayload(parsed, rawName);
  if ("error" in stationOrErr) return stationOrErr;
  return { station: stationOrErr, source: "ai" };
}

const WALK_RADIUS_KM = 2.0;
/** ご飯・土産は駅前の空気が残る狭い圏（徒歩おおよそ18分）。丸太町までは広げない */
const SHOP_WALK_RADIUS_KM = 1.35;
const SHOP_MAX_WALK_MINUTES = 18;

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLng = toR(b.lng - a.lng);
  const lat1 = toR(a.lat);
  const lat2 = toR(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 信頼優先の目安（強制しない）。件数を埋める下限には使わない。 */
const PREFERRED_MEAL_SPOTS = 3;
const PREFERRED_SOUVENIR_SPOTS = 2;
/** 後方互換: 古い「件数床」呼び出しは目安に読み替え。 */
const MIN_MEAL_SPOTS = PREFERRED_MEAL_SPOTS;
const MIN_SOUVENIR_SPOTS = PREFERRED_SOUVENIR_SPOTS;

function isShopGuide(s: Spot): boolean {
  return s.guide === "meal" || s.guide === "souvenir";
}

function shopWithinStationArea(
  center: { lat: number; lng: number },
  s: Spot,
): boolean {
  if (s.walkMinutes > SHOP_MAX_WALK_MINUTES) return false;
  if (typeof s.lat !== "number" || typeof s.lng !== "number") return true;
  const km = haversineKm(center, { lat: s.lat, lng: s.lng });
  // 座標はAI推定でズレやすいので、徒歩分が近ければやや広めまで許容
  return km <= SHOP_WALK_RADIUS_KM || km <= 1.6;
}

/** AI が駅の外の有名店を載せた／遠い座標のまま残したものを落とす。遠い店は件数のためにも戻さない。 */
function filterFarSpots(station: StationSeed): StationSeed {
  if (
    typeof station.lat !== "number" ||
    typeof station.lng !== "number" ||
    !Number.isFinite(station.lat) ||
    !Number.isFinite(station.lng)
  ) {
    return station;
  }
  const center = { lat: station.lat, lng: station.lng };
  const spots = station.spots.filter((s) => {
    if (typeof s.lat !== "number" || typeof s.lng !== "number") return true;
    const km = haversineKm(center, { lat: s.lat, lng: s.lng });
    if (isShopGuide(s)) return shopWithinStationArea(center, s);
    return km <= WALK_RADIUS_KM;
  });
  if (spots.length === station.spots.length) return station;
  return { ...station, spots: spots.length > 0 ? spots : station.spots.slice(0, 1) };
}

/**
 * 遠距離フィルタ後、圏内に戻せる店だけを控えめに足す（目安まで）。
 * 信頼のため、件数床まで無理に戻さない。総称・弱い店名は戻さない。
 */
function ensureShopGuideFloor(
  station: StationSeed,
  original: StationSeed,
): StationSeed {
  if (
    typeof station.lat !== "number" ||
    typeof station.lng !== "number" ||
    !Number.isFinite(station.lat) ||
    !Number.isFinite(station.lng)
  ) {
    return station;
  }
  const center = { lat: station.lat, lng: station.lng };
  const ids = new Set(station.spots.map((s) => s.id));
  const next = [...station.spots];
  const soft = (guide: "meal" | "souvenir", preferred: number) => {
    let n = next.filter((s) => s.guide === guide).length;
    if (n >= preferred) return;
    const pool = original.spots
      .filter(
        (s) =>
          s.guide === guide &&
          !ids.has(s.id) &&
          !isWeakShopName(s.name) &&
          shopWithinStationArea(center, s),
      )
      .sort((a, b) => a.walkMinutes - b.walkMinutes);
    for (const s of pool) {
      if (n >= preferred) break;
      next.push(s);
      ids.add(s.id);
      n += 1;
    }
  };
  soft("meal", PREFERRED_MEAL_SPOTS);
  soft("souvenir", PREFERRED_SOUVENIR_SPOTS);
  if (next.length === station.spots.length) return station;
  return { ...station, spots: next };
}

/** 総称・メモ混入・弱すぎる店名（meal/souvenir から落とす） */
function isWeakShopName(name: string): boolean {
  if (isEditorialPlaceName(name)) return true;
  const title = placeTitle(name);
  if (title.length < 3) return true;
  if (
    /^(駅前の|周辺の|近くの|あたりの|おすすめの|地元の)/.test(title) ||
    /の(食堂|カフェ|パン屋|和菓子屋|お土産屋|商店|定食屋)$/.test(title) ||
    /^(食堂|カフェ|パン屋|お土産屋|商店|喫茶店)$/.test(title)
  ) {
    return true;
  }
  return false;
}

/** 不確かな店名の meal/souvenir を落とす。名所（sight 等）は残す。 */
function stripUntrustedShops(station: StationSeed): StationSeed {
  const spots = station.spots.filter((s) => {
    if (s.guide !== "meal" && s.guide !== "souvenir") return true;
    if (isWeakShopName(s.name)) return false;
    if (
      s.guide === "meal" &&
      isNonWalkInMeal({ name: s.name, blurb: s.blurb, detail: s.detail })
    ) {
      return false;
    }
    return true;
  });
  if (spots.length === station.spots.length) return station;
  return { ...station, spots };
}

function countMajor(station: StationSeed): number {
  return station.spots.filter((s) => s.majorWorthy).length;
}

function applyMajorNames(
  station: StationSeed,
  names: string[],
): StationSeed {
  const wanted = names
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (wanted.length === 0) return station;
  const matchedIds = new Set<string>();
  for (const want of wanted) {
    const hit =
      station.spots.find((s) => s.name === want) ||
      station.spots.find(
        (s) => s.name.includes(want) || want.includes(s.name),
      );
    if (hit) matchedIds.add(hit.id);
  }
  if (matchedIds.size === 0) return station;
  return {
    ...station,
    spots: station.spots.map((s) => ({
      ...s,
      majorWorthy: matchedIds.has(s.id),
      // 定番と穴場は重ねない
      secretWorthy: matchedIds.has(s.id) ? false : s.secretWorthy,
    })),
  };
}

/** AI が major を付け損ねたときのヒューリスティック（名所・近い・有名店っぽさ） */
function promoteMajorHeuristic(station: StationSeed): StationSeed {
  if (countMajor(station) === MAJOR_FACE_TOTAL) return station;
  const scored = station.spots.map((s) => {
    let score = 0;
    if (s.majorWorthy) score += 100;
    if (s.guide === "sight") score += 42;
    if (s.guide === "souvenir") score += 28;
    if (s.guide === "meal") score += 22;
    if (s.guide === "rest") score += 8;
    if (isNeighborhoodWorship(s.name, station.name)) score -= 80;
    else if (
      isGuidebookWorship(s.name, station.name) ||
      isOrdinaryPublicFace(s.name) ||
      /城|宮|本店|老舗|陵/.test(s.name)
    ) {
      score += 24;
    }
    score += Math.max(0, 22 - s.walkMinutes);
    if (s.secretWorthy) score -= 35;
    return { s, score };
  });
  scored.sort((a, b) => b.score - a.score || a.s.walkMinutes - b.s.walkMinutes);
  const picked: Spot[] = [];
  const isFood = (g?: string) => g === "meal" || g === "souvenir";
  for (const row of scored) {
    if (picked.length >= MAJOR_SIGHT_TARGET) break;
    if (isFood(row.s.guide)) continue;
    if (!picked.some((p) => p.id === row.s.id)) picked.push(row.s);
  }
  for (const row of scored) {
    if (picked.filter((p) => isFood(p.guide)).length >= MAJOR_FOOD_TARGET) break;
    if (!isFood(row.s.guide)) continue;
    if (!picked.some((p) => p.id === row.s.id)) picked.push(row.s);
  }
  for (const row of scored) {
    if (picked.length >= MAJOR_FACE_TOTAL) break;
    if (!picked.some((p) => p.id === row.s.id)) picked.push(row.s);
  }
  const ids = new Set(picked.slice(0, MAJOR_FACE_TOTAL).map((p) => p.id));
  return {
    ...station,
    spots: station.spots.map((s) => ({
      ...s,
      majorWorthy: ids.has(s.id),
      secretWorthy: ids.has(s.id) ? false : s.secretWorthy,
    })),
  };
}

/**
 * どの駅でも「ガイドブック級のメジャーどころ」を必ず足す。
 * - landmarks: 一番有名な名所・景色（合計5の名所側）
 * - omiyage: 手土産になる名物菓子・名産（名物側）
 */
const BIKE_GENERIC =
  /^(駅前のレンタサイクル|枡形・駅前のレンタサイクル店|レンタサイクル店|周辺のレンタサイクル|貸自転車|シェアサイクル|レンタサイクル)$/;

const BIKE_FOREIGN_HINTS = [
  "出町柳",
  "三条",
  "四条",
  "宇治",
  "伏見",
  "嵐山",
  "奈良",
  "大阪",
  "神戸",
] as const;

/** その駅にある実在貸出だけ残す。他駅名・総称・遠すぎる徒歩は落とす。正本は bike-rental-locks.json。 */
function sanitizeBikeRentals(station: StationSeed): StationSeed {
  const generics = /駅前のレンタ|枡形・駅前のレンタ|周辺のレンタ|貸自転車$/;
  const places = [...(station.bikeRental?.places ?? [])].filter((p) => {
    if (!p.name || BIKE_GENERIC.test(p.name) || generics.test(p.name)) {
      return false;
    }
    // えむじかは 2026-01 閉業
    if (/えむじか/.test(p.name)) return false;
    if (typeof p.walkMinutes === "number" && p.walkMinutes > 8) return false;
    if (!/出町柳/.test(station.name) && /出町柳|京阪出町柳/.test(p.name)) {
      return false;
    }
    for (const hint of BIKE_FOREIGN_HINTS) {
      if (p.name.includes(hint) && !station.name.includes(hint)) return false;
    }
    return true;
  });

  return {
    ...station,
    bikeRental: applyBikeRentalLocks(station.name, {
      available: places.length > 0,
      summary: station.bikeRental?.summary ?? "",
      places,
    }),
  };
}

/**
 * ご飯タブ用: 土地の定番めし（パン・おにぎり・商店街食堂など）を確保。
 * 近い無名カフェで埋めない。
 */
async function ensureStapleMealEntries(
  station: StationSeed,
  apiKey: string,
  viewerSub: string,
): Promise<StationSeed> {
  // 条件スキップ: ご飯が下限に達していれば追加呼び出ししない
  if (countGuide(station, "meal") >= MIN_MEAL_SPOTS) return station;
  const catalog = station.spots
    .filter((s) => s.guide === "meal")
    .map((s) => `- ${s.name}（徒歩${s.walkMinutes}分）`)
    .join("\n");
  const prompt = [
    "あなたは日本の駅の徒歩圏案内の編集者です。Google検索で実在を確認してください。",
    "どの駅でも同じ基準で「定番めし」を出してください。穴場カフェ優先は禁止。",
    "",
    "必ず返すもの:",
    "stapleMeals ちょうど3〜4件 … その駅名と結びついて、地元・旅人が『ここで食べる』と言う定番。",
    "名前は必ず正式屋号。「業態だけ」（例: おにぎり屋）禁止。「屋号＋業態」（例: お米自慢 おにぎり屋さん）にする。",
    "優先ジャンル: 地元パン屋、おにぎり、商店街の食堂、うどん、そば、定食、昔からの一軒。",
    "禁止: 多目的カフェ、コワーキング併設、知る・感じる系の屋号、土地と結びつかない新しいカフェ、曖昧な業態名のみ。",
    "",
    "例:",
    "- 出町柳: 進々堂 京大北門前, お米自慢 おにぎり屋さん, 満寿形屋",
    "- 出町柳のおにぎりは『お米自慢 おにぎり屋さん』のみ。おにぎり利次郎など他店は出さない。メジャー人気店だけ。",
    "- 石清水八幡宮: 朝日屋（鯖の棒寿司・駅前）。参詣の定番めしは必ず入れる。",
    "- 鎌倉: 小町通りの定番めし（実在店名）",
    "- 宇治: 抹茶・甘味の定番とは別に、腹ごしらえの定番食堂・麺があれば入れる",
    "",
    "一覧にあれば正式名を使い、無ければ実在の定番を新たに出す。",
    "guide は必ず meal。出力は JSON のみ:",
    "{",
    '  "stapleMeals": [ { "name", "guide":"meal", "genre":"gourmet", "mealTier":"casual", "mealTimes":["morning"|"lunch"|"dinner"], "soloOk":true, "budgetYen", "blurb", "detail", "walkMinutes", "lat", "lng", "hours" } ]',
    "}",
    "3〜4件。確認できない店は無理に埋めない。",
    "",
    `駅: ${station.name}（${station.prefecture} · ${station.line}）`,
    `駅座標目安: ${station.lat}, ${station.lng}`,
    "いまのご飯一覧（参考）:",
    catalog || "（なし）",
  ].join("\n");

  const result = await callGeminiGenerate(
    apiKey,
    viewerSub,
    {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.25, maxOutputTokens: 3072 },
    },
    GEMINI_EXPAND_MS,
  );
  if (!result.ok) return station;
  const parsed = extractJsonObject(result.text);
  if (!parsed) return station;
  const rawMeals = Array.isArray(parsed.stapleMeals)
    ? parsed.stapleMeals
    : Array.isArray(parsed.meals)
      ? parsed.meals
      : [];
  if (rawMeals.length === 0) return station;

  let next = station;
  let addIndex = next.spots.length;
  for (const raw of rawMeals.slice(0, 4)) {
    const forced =
      raw && typeof raw === "object"
        ? { ...(raw as Record<string, unknown>), guide: "meal" }
        : raw;
    const parsedSpot = parseSpot(forced, addIndex++);
    if (!parsedSpot) continue;
    const soft =
      /多目的|つながる|知る、感じる|コワーキング|レンタルスペース/.test(
        `${parsedSpot.name}${parsedSpot.blurb ?? ""}`,
      );
    if (soft) continue;
    const existing =
      next.spots.find((s) => s.name === parsedSpot.name) ||
      next.spots.find(
        (s) =>
          s.name.includes(parsedSpot.name) || parsedSpot.name.includes(s.name),
      );
    if (existing) {
      next = {
        ...next,
        spots: next.spots.map((s) =>
          s.id === existing.id
            ? {
                ...s,
                guide: "meal",
                blurb: s.blurb || parsedSpot.blurb,
                detail: s.detail || parsedSpot.detail,
                walkMinutes: Math.min(s.walkMinutes, parsedSpot.walkMinutes),
                lat: parsedSpot.lat ?? s.lat,
                lng: parsedSpot.lng ?? s.lng,
                hours: parsedSpot.hours || s.hours,
              }
            : s,
        ),
      };
    } else {
      next = {
        ...next,
        spots: [
          ...next.spots,
          {
            ...parsedSpot,
            id: `ai-staple-meal-${addIndex}`,
            guide: "meal",
            majorWorthy: false,
            secretWorthy: false,
          },
        ],
      };
    }
  }
  return next;
}

async function ensureMajorSpotEntries(
  station: StationSeed,
  apiKey: string,
  viewerSub: string,
): Promise<StationSeed> {
  // 条件スキップ: 土地の顔が揃っていれば API せずヒューリスティックも不要
  if (countMajor(station) >= MAJOR_FACE_TOTAL) return station;
  const catalog = station.spots
    .map((s) => `- ${s.name}（${s.guide ?? "?"} / 徒歩${s.walkMinutes}分）`)
    .join("\n");
  const prompt = [
    "あなたは日本の駅の徒歩圏案内の編集者です。Google検索で実在を確認してください。",
    "どの駅でも同じ基準で「メジャーどころ」を出してください。穴場・マニア向けは禁止。",
    "",
    "必ず返すもの:",
    "1) landmarks ちょうど3件 … その駅でいちばん有名な観光名所・景色（名社寺・川の合流・橋・商店街・城・市場の顔など）。近所の無名な寺・脇社・小さな祠・マイナー店は禁止。",
    "2) omiyage ちょうど2件 … 手土産になる名物（菓子・銘菓・土地の顔になる甘いお土産を優先）。一般の漬物屋・鰹節屋・雑貨より、ガイドブックに載る名物菓子を優先。",
    "",
    "例:",
    "- 出町柳: landmarks=下鴨神社（賀茂御祖神社）, 鴨川デルタ / omiyage=出町ふたば, 加茂みたらし茶屋",
    "- 鎌倉: landmarks=鶴岡八幡宮, 小町大路まわりの顔になる名所 / omiyage=鳩サブレーで有名な店, 他の銘菓",
    "- 宇治: landmarks=平等院, 宇治橋まわりの顔 / omiyage=抹茶菓子の名店",
    "",
    "一覧にあれば正式名を使い、無ければ実在の定番を新たに出す。",
    "landmarks の guide は sight。omiyage の guide は必ず souvenir（meal にしない）。",
    "出力は JSON のみ:",
    "{",
    '  "landmarks": [ { "name", "guide":"sight", "genre", "blurb", "detail", "walkMinutes", "lat", "lng", "hours" } ],',
    '  "omiyage": [ { "name", "guide":"souvenir", "genre":"gourmet", "blurb", "detail", "walkMinutes", "lat", "lng", "hours", "budgetYen" } ]',
    "}",
    "landmarks は2件、omiyage は2件。足りない場合は無理に埋めず実在だけ。",
    "",
    `駅: ${station.name}（${station.prefecture} · ${station.line}）`,
    `駅座標目安: ${station.lat}, ${station.lng}`,
    "いまの一覧（参考・不足なら追加してよい）:",
    catalog || "（なし）",
  ].join("\n");

  const result = await callGeminiGenerate(
    apiKey,
    viewerSub,
    {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.25, maxOutputTokens: 4096 },
    },
    GEMINI_EXPAND_MS,
  );

  if (!result.ok) return promoteMajorHeuristic(station);
  const parsed = extractJsonObject(result.text);
  if (!parsed) return promoteMajorHeuristic(station);

  const rawLandmarks = Array.isArray(parsed.landmarks)
    ? parsed.landmarks
    : Array.isArray(parsed.spots)
      ? parsed.spots.slice(0, 2)
      : [];
  const rawOmiyage = Array.isArray(parsed.omiyage) ? parsed.omiyage : [];

  if (rawLandmarks.length === 0 && rawOmiyage.length === 0) {
    return promoteMajorHeuristic(station);
  }

  let next: StationSeed = {
    ...station,
    spots: station.spots.map((s) => ({ ...s, majorWorthy: false })),
  };
  const majorIds: string[] = [];
  let addIndex = next.spots.length;

  const upsertIcon = (
    raw: unknown,
    opts: { forceGuide?: GuideKind; idPrefix: string; asMajor: boolean },
  ) => {
    const forced =
      raw && typeof raw === "object"
        ? { ...(raw as Record<string, unknown>), guide: opts.forceGuide ?? (raw as Record<string, unknown>).guide }
        : raw;
    const parsedSpot = parseSpot(forced, addIndex++);
    if (!parsedSpot) return;
    const spot: Spot = {
      ...parsedSpot,
      guide: opts.forceGuide ?? parsedSpot.guide,
      secretWorthy: false,
    };
    const existing =
      next.spots.find((s) => s.name === spot.name) ||
      next.spots.find(
        (s) => s.name.includes(spot.name) || spot.name.includes(s.name),
      );
    if (existing) {
      next = {
        ...next,
        spots: next.spots.map((s) =>
          s.id === existing.id
            ? {
                ...s,
                guide: opts.forceGuide ?? s.guide,
                majorWorthy: opts.asMajor || s.majorWorthy,
                secretWorthy: false,
                blurb: s.blurb || spot.blurb,
                detail: s.detail || spot.detail,
                walkMinutes: Math.min(s.walkMinutes, spot.walkMinutes),
                lat: spot.lat ?? s.lat,
                lng: spot.lng ?? s.lng,
              }
            : s,
        ),
      };
      if (opts.asMajor) majorIds.push(existing.id);
    } else {
      const added: Spot = {
        ...spot,
        id: `${opts.idPrefix}-${addIndex}`,
        majorWorthy: opts.asMajor,
      };
      next = { ...next, spots: [...next.spots, added] };
      if (opts.asMajor) majorIds.push(added.id);
    }
  };

  // 名所・景色 + 名物 = 合計5の材料
  for (let i = 0; i < Math.min(MAJOR_SIGHT_TARGET, rawLandmarks.length); i++) {
    upsertIcon(rawLandmarks[i], {
      forceGuide: "sight",
      idPrefix: "ai-landmark",
      asMajor: true,
    });
  }
  for (let i = 0; i < Math.min(MAJOR_FOOD_TARGET, rawOmiyage.length); i++) {
    upsertIcon(rawOmiyage[i], {
      forceGuide: "souvenir",
      idPrefix: "ai-omiyage",
      asMajor: true,
    });
  }

  if (majorIds.length >= 2) {
    const idSet = new Set(majorIds.slice(0, MAJOR_FACE_TOTAL));
    next = {
      ...next,
      spots: next.spots.map((s) => ({
        ...s,
        majorWorthy: idSet.has(s.id),
        secretWorthy: idSet.has(s.id) ? false : s.secretWorthy,
      })),
    };
    return sealIconicMajors(next);
  }

  return sealIconicMajors(promoteMajorHeuristic(next));
}

const ICONIC_SHOP_RE =
  /ふたば|みたらし|だんご|団子|最中|羊羹|カステラ|たい焼|人形焼|もみじ饅頭|赤福|治一郎|千鳥屋|亀屋|老舗/;

/**
 * メジャーに「一般土産」が入り名物店が外れたとき、名物店を押し込む。
 * 例: 出町柳で野呂本店が major になり出町ふたばが落ちる、を防ぐ。
 */
function sealIconicMajors(station: StationSeed): StationSeed {
  let working = {
    ...station,
    spots: station.spots.filter((s) => !isEditorialPlaceName(s.name)),
  };
  // 出町柳は豆餅のふたばをスポット自体として必ず持たせる
  // 注釈の「ふたば以外」は店そのものではない
  if (
    /出町柳/.test(working.name) &&
    !working.spots.some((s) => placeTitle(s.name).includes("ふたば"))
  ) {
    working = {
      ...working,
      spots: [
        ...working.spots,
        {
          id: "ai-major-futaba",
          name: "出町ふたば",
          genre: "gourmet",
          guide: "souvenir",
          mealTier: "casual",
          mealTimes: ["morning", "lunch"],
          soloOk: true,
          budgetYen: "〜¥800",
          hours: "8:30〜17:30（売切次第終了・火曜定休の場合あり）",
          blurb:
            "豆餅（きな粉）とよもぎ餅が看板。袋のまま鴨川デルタへ歩くのが定番の食べ方。",
          detail:
            "駅前・枡形で買ってデルタのベンチで食べる。朝から昼は行列ができやすいので、歩きの序盤か終盤に寄せるとよい。",
          x: 0.45,
          y: 0.4,
          walkMinutes: 3,
          majorWorthy: true,
          secretWorthy: false,
          lat: 35.03011,
          lng: 135.76963,
        },
      ],
    };
  }

  const bare = working.name.replace(/駅$/u, "").trim();
  const shops = working.spots.filter(
    (s) => s.guide === "meal" || s.guide === "souvenir",
  );
  const iconic =
    shops.find((s) => ICONIC_SHOP_RE.test(`${s.name}${s.blurb ?? ""}`)) ||
    shops.find(
      (s) => bare.length >= 2 && s.name.includes(bare) && s.guide === "meal",
    ) ||
    shops.find(
      (s) =>
        bare.length >= 2 &&
        s.name.includes(bare) &&
        (s.guide === "souvenir" || s.guide === "meal"),
    ) ||
    null;

  // 出町柳は豆餅のふたばを欠かさない
  const demachiFutaba = /出町柳/.test(working.name)
    ? working.spots.find((s) => placeTitle(s.name).includes("ふたば"))
    : null;
  const must = demachiFutaba || iconic;
  if (!must) return working;
  station = working; // continue with enriched station

  const majors = station.spots.filter((s) => s.majorWorthy);
  if (majors.some((m) => m.id === must.id)) {
    // 余分な一般土産 major を外し、合計5件に整える
    return trimMajorsToLimit(station, must.id);
  }

  const drop =
    majors.find(
      (m) =>
        (m.guide === "souvenir" || m.guide === "meal") &&
        m.id !== must.id &&
        !ICONIC_SHOP_RE.test(m.name) &&
        !/神社|寺|デルタ|城|宮/.test(m.name),
    ) ||
    majors.find(
      (m) =>
        m.guide === "souvenir" &&
        m.id !== must.id &&
        !ICONIC_SHOP_RE.test(m.name),
    ) ||
    majors
      .filter((m) => !/神社|寺|デルタ|城|宮/.test(m.name))
      .sort((a, b) => b.walkMinutes - a.walkMinutes)[0] ||
    null;

  const nextIds = new Set(
    majors.filter((m) => !drop || m.id !== drop.id).map((m) => m.id),
  );
  nextIds.add(must.id);
  while (nextIds.size > MAJOR_FACE_TOTAL) {
    const removable = [...nextIds].find((id) => id !== must.id);
    if (!removable) break;
    nextIds.delete(removable);
  }

  return {
    ...station,
    spots: station.spots.map((s) => ({
      ...s,
      majorWorthy: nextIds.has(s.id),
      secretWorthy: nextIds.has(s.id) ? false : s.secretWorthy,
    })),
  };
}

function trimMajorsToLimit(
  station: StationSeed,
  keepShopId: string,
): StationSeed {
  const majors = station.spots.filter((s) => s.majorWorthy);
  if (
    majors.length <= MAJOR_FACE_TOTAL &&
    majors.some((m) => m.id === keepShopId)
  ) {
    return station;
  }
  const keep: Spot[] = [];
  const shop = majors.find((m) => m.id === keepShopId);
  if (shop) keep.push(shop);
  for (const m of majors
    .filter((m) => /神社|寺|デルタ|城|宮/.test(m.name))
    .sort((a, b) => a.walkMinutes - b.walkMinutes)) {
    if (keep.length >= MAJOR_FACE_TOTAL) break;
    if (!keep.some((k) => k.id === m.id)) keep.push(m);
  }
  for (const m of majors.sort((a, b) => a.walkMinutes - b.walkMinutes)) {
    if (keep.length >= MAJOR_FACE_TOTAL) break;
    if (!keep.some((k) => k.id === m.id)) keep.push(m);
  }
  const ids = new Set(keep.slice(0, MAJOR_FACE_TOTAL).map((k) => k.id));
  return {
    ...station,
    spots: station.spots.map((s) => ({
      ...s,
      majorWorthy: ids.has(s.id),
      secretWorthy: ids.has(s.id) ? false : s.secretWorthy,
    })),
  };
}

/** 土地文に書いた名前から地図・案内の spots を起こす。 */
async function expandPlacesFromLand(
  station: StationSeed,
  apiKey: string,
  viewerSub: string,
): Promise<StationSeed> {
  // 条件スキップ強化: 件数と店が足りていれば起こし直ししない
  const spotCount = station.spots?.length ?? 0;
  if (spotCount >= 12 || (spotCount >= 8 && !isShopThin(station))) return station;

  const expanded = await callGeminiGenerate(
    apiKey,
    viewerSub,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: buildPlacesFromLandPrompt(station) }],
        },
      ],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 8192,
      },
    },
    GEMINI_GROUNDED_MS,
  );
  if (!expanded.ok) {
    // グラウンディング失敗時は JSON 専用でもう一度
    const fast = await callGeminiGenerate(
      apiKey,
      viewerSub,
      {
        contents: [
          {
            role: "user",
            parts: [{ text: buildPlacesFromLandPrompt(station) }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      },
      GEMINI_FAST_MS,
    );
    if (!fast.ok) return station;
    return mergePlacesFromLandText(station, fast.text);
  }
  return mergePlacesFromLandText(station, expanded.text);
}

function mergePlacesFromLandText(
  station: StationSeed,
  text: string,
): StationSeed {
  const parsed = extractJsonObject(text);
  if (!parsed) return station;

  let next: StationSeed = { ...station };
  const line = asString(parsed.line);
  if (line && line !== "路線情報は要確認") next = { ...next, line };
  const prefecture = asString(parsed.prefecture);
  if (prefecture && prefecture !== "日本") {
    next = { ...next, prefecture };
  }
  const regionRaw = asString(parsed.region);
  if (regionRaw && REGION_SET.has(regionRaw)) {
    next = { ...next, region: regionRaw as StationSeed["region"] };
  }
  const nameReading = asString(parsed.nameReading);
  if (nameReading) next = { ...next, nameReading };
  const lat = asNumber(parsed.lat, next.lat ?? 35.0);
  const lng = asNumber(parsed.lng, next.lng ?? 135.0);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    next = { ...next, lat, lng };
  }
  const mood: StationMood = parsed.mood === "empty" ? "empty" : next.mood;
  next = { ...next, mood };
  const tourTitle = asString(parsed.tourTitle).slice(0, 28);
  if (tourTitle) next = { ...next, tourTitle };
  const catchCopy = asString(parsed.catchCopy).slice(0, 40);
  if (catchCopy) next = { ...next, catchCopy };
  const railHint = sanitizeRailHint(asString(parsed.railHint));
  if (railHint) next = { ...next, railHint };
  const bike = parseBike(parsed.bikeRental);
  if (bike) next = { ...next, bikeRental: bike };
  const faces = parseFirstVisitFaces(parsed.firstVisitFaces);
  if (faces?.length) next = { ...next, firstVisitFaces: faces };
  const storyNotes = parseNoteList(parsed.storyNotes, 4);
  if (storyNotes?.length && !(next.storyNotes?.length ?? 0)) {
    next = { ...next, storyNotes };
  }
  if (Array.isArray(parsed.corridors)) {
    next = {
      ...next,
      corridors: parseCorridors(parsed.corridors, next),
    };
  }
  if (Array.isArray(parsed.preferredDetours)) {
    next = {
      ...next,
      preferredDetours:
        parsed.preferredDetours as StationSeed["preferredDetours"],
    };
  }

  if (!Array.isArray(parsed.spots)) return next;
  const extras = parsed.spots
    .map((raw, i) => parseSpot(raw, (next.spots?.length ?? 0) + i))
    .filter((s): s is Spot => !!s)
    .filter((s) => !isForeignDemachiPlace(s.name, next.name));
  if (!extras.length) return next;

  const existing = [...(next.spots ?? [])];
  const names = new Set(existing.map((s) => s.name));
  for (const spot of extras) {
    if (names.has(spot.name)) continue;
    names.add(spot.name);
    existing.push(spot);
  }
  return { ...next, spots: existing.slice(0, 22) };
}

/**
 * 1回目で足りていれば 2 回目（穴埋め＝Search 付き）を打たない。
 * 穴埋めは「土地文・名所」が薄いときだけ。店・休み・major の枚数合わせでは打たない
 * （店は MapKit／ロック、major はヒューリスティックで後段が補う）。
 * 収録土地文がある駅は土地理由では打たず、sight spots 不足のときだけ。
 */
function needsGapFill(station: StationSeed): boolean {
  if (isRichLandDepth(lookupAreaDepthByName(station.name))) {
    return countGuide(station, "sight") < 2;
  }
  if (isNarrativeThin(station)) return true;
  if (countGuide(station, "sight") < 2) return true;
  // 検索駅も出町並み精度へ（歩き方・目の置きどころが抽象なら穴埋め）
  if (needsPrecisionPolish(station)) return true;
  return false;
}

function buildGapFillPrompt(station: StationSeed): string {
  const meals = station.spots
    .filter((s) => s.guide === "meal")
    .map((s) => s.name)
    .join("、");
  const souvenirs = station.spots
    .filter((s) => s.guide === "souvenir")
    .map((s) => s.name)
    .join("、");
  const rests = station.spots
    .filter((s) => s.guide === "rest")
    .map((s) => s.name)
    .join("、");
  const majors = station.spots
    .filter((s) => s.majorWorthy)
    .map((s) => s.name)
    .join("、");
  const names = station.spots.map((s) => s.name).join("、");
  const hist = (station.historyNotes ?? [])
    .slice(0, 6)
    .map((n) => `【${n.title}】${n.body}`)
    .join("\n");
  const sight = (station.sightseeingNotes ?? [])
    .slice(0, 6)
    .map((n) => `【${n.title}】${n.body}`)
    .join("\n");
  const polishWalk = isWalkGuideImprecise(station.walkGuide);
  const polishSight = isSightseeingImprecise(station.sightseeingNotes);
  const polishFounding = isStationFoundingMissing(station.stationIntro);
  return [
    "あなたは日本の駅の徒歩圏案内の編集者です。Google検索で実在を確認してください。",
    "【目的】足りない穴だけを一度で埋める。優先は名所（土地文）と土地文の厚さ。店は確かなときだけ。",
    "既にある名前の再掲は禁止。観光ランキング口調は禁止。件数を埋めるための推測は禁止。",
    "出力は JSON のみ。",
    "",
    PRECISION_BAR_PROMPT,
    "",
    `駅名: ${station.name}（${station.prefecture} · ${station.line}）`,
    `駅座標: ${station.lat}, ${station.lng}`,
    `いま meal ${countGuide(station, "meal")} / souvenir ${countGuide(station, "souvenir")} / rest ${countGuide(station, "rest")} / sight ${countGuide(station, "sight")} / major ${countMajor(station)} / spots ${station.spots.length}`,
    `精度: walkGuide${polishWalk ? "要修正" : "OK"} / sightseeing${polishSight ? "要修正" : "OK"} / 駅のこと開業${polishFounding ? "要追記" : "OK"}`,
    `既存めし: ${meals || "（なし）"}`,
    `既存土産: ${souvenirs || "（なし）"}`,
    `既存休み: ${rests || "（なし）"}`,
    `既存 major: ${majors || "（なし）"}`,
    `既存すべての名前（再掲禁止）: ${names || "（なし）"}`,
    "",
    "—— 土地文（正本・名所はここから起こす）——",
    `stationIntro: ${station.stationIntro ?? ""}`,
    `areaAbout: ${station.areaAbout ?? ""}`,
    `walkGuide: ${station.walkGuide ?? ""}`,
    "historyNotes:",
    hist || "（なし）",
    "sightseeingNotes:",
    sight || "（なし）",
    "",
    landAnchorPromptBlock(station.name),
    "",
    "スキーマ:",
    "{",
    '  "stationIntro": "薄いとき、または開業が無いとき書き直し。路線・駅前＋開業年・設置理由",',
    '  "areaAbout": "薄いときだけ",',
    '  "walkGuide": "要修正または薄いとき必須。出口→通る順→方角→定番食べ方（分かれば）。抽象禁止",',
    '  "historyNotes": [{ "title", "body" }]（薄いときだけ追加・厚く。土地の層。駅開業は intro へ）,',
    '  "sightseeingNotes": [{ "title", "body" }]（要修正または薄いとき必須。正式名です。行き方。着いたら）,',
    '  "storyNotes": [{ "title", "body" }]（徒歩圏の撮影地／文学の舞台。確かなものだけ。無ければ省略）,',
    '  "spots": [ { "name", "guide":"meal|souvenir|sight|rest|tip", "genre", "blurb", "detail", "walkMinutes", "lat", "lng", "hours", "budgetYen", "mealTier", "mealTimes", "soloOk", "majorWorthy", "secretWorthy" } ]',
    "}",
    "",
    "制約:",
    "- spots は追加分だけ。",
    "- 【名所】土地文に出た正式名称でまだspotsに無いものは必ず起こす（sight 優先）。",
    "- 【店】meal/souvenir は検索で確実なときだけ追加（目安 合計 meal≤3 / souvenir≤2）。不確かなら足さない。0件のままでよい。",
    "- 【休み】景色の休みが無ければ足す。喫茶は検索で確実なときだけ。",
    "- majorWorthy は名所を優先。名物店 major は確実なときだけ。合計5未満でも名所が確かならよい。",
    "- 出町柳以外で鴨川デルタ・下鴨・枡形・ふたば等を出さない。",
    "- blurb/detail は各3文以上。確認できない店・総称名は出さない。",
    polishWalk
      ? "- 【必須】walkGuide を出町並み精度で書き直す（いまの文は抽象または方角不足）。"
      : "",
    polishSight
      ? "- 【必須】sightseeingNotes を『正式名です。行き方。着いたら』型で書き直す／厚くする。"
      : "",
    polishFounding
      ? "- 【必須】stationIntro（〇〇駅のこと）に開業年・設置理由を追記して書き直す（検索確認。年の捏造禁止。historyNotes に開業だけを独立で足さない）。"
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function mergeGapFillIntoStation(
  station: StationSeed,
  text: string,
): StationSeed {
  const parsed = extractJsonObject(text);
  if (!parsed) return station;

  let next = station;
  // 物語のゆかりは土地文が厚くても空なら足す（以前は薄いときだけマージして捨てていた）
  const parsedStory = parseNoteList(parsed.storyNotes, 4);
  if (parsedStory?.length && !(next.storyNotes?.length ?? 0)) {
    next = { ...next, storyNotes: parsedStory };
  }
  const polishLand =
    isNarrativeThin(next) ||
    isWalkGuideImprecise(next.walkGuide) ||
    isSightseeingImprecise(next.sightseeingNotes) ||
    isStationFoundingMissing(next.stationIntro);
  if (polishLand) {
    const historyNotes =
      parseNoteList(parsed.historyNotes, 9) ?? next.historyNotes;
    const parsedSight = parseNoteList(parsed.sightseeingNotes, 8);
    const sightseeingNotes =
      parsedSight &&
      !isSightseeingImprecise(parsedSight) &&
      (parsedSight.length >= (next.sightseeingNotes?.length ?? 0) ||
        isSightseeingImprecise(next.sightseeingNotes))
        ? parsedSight
        : (parsedSight ?? next.sightseeingNotes);
    const parsedIntro = asString(parsed.stationIntro);
    const stationIntro =
      parsedIntro &&
      (!isStationFoundingMissing(parsedIntro) ||
        isStationFoundingMissing(next.stationIntro))
        ? parsedIntro
        : (parsedIntro || next.stationIntro);
    const areaAbout = asString(parsed.areaAbout) || next.areaAbout;
    const parsedWalk = asString(parsed.walkGuide);
    const walkGuide =
      parsedWalk &&
      (!isWalkGuideImprecise(parsedWalk) ||
        isWalkGuideImprecise(next.walkGuide))
        ? parsedWalk
        : next.walkGuide;
    next = {
      ...next,
      stationIntro,
      areaAbout,
      walkGuide,
      historyNotes,
      sightseeingNotes,
    };
  }

  if (!Array.isArray(parsed.spots)) return next;
  const existing = new Set(
    next.spots.map((s) => s.name.replace(/\s+/g, "")),
  );
  const extras = parsed.spots
    .map((raw, i) => parseSpot(raw, next.spots.length + i))
    .filter((s): s is Spot => !!s)
    .filter((s) => !isForeignDemachiPlace(s.name, next.name))
    .filter((s) => !existing.has(s.name.replace(/\s+/g, "")));
  if (!extras.length) return next;
  return {
    ...next,
    spots: [...next.spots, ...extras].slice(0, 22),
  };
}

/** 足りない穴を 1 回の Gemini 呼び出しで埋める（店・名所・休み・薄い土地文）。 */
async function fillStationGapsOnce(
  station: StationSeed,
  apiKey: string,
  viewerSub: string,
): Promise<StationSeed> {
  const filled = await callGeminiGenerate(
    apiKey,
    viewerSub,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: buildGapFillPrompt(station) }],
        },
      ],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 8192,
      },
    },
    GEMINI_GROUNDED_MS,
  );
  if (!filled.ok) return station;
  return mergeGapFillIntoStation(station, filled.text);
}

/** 駅名だけで物語のゆかりを grounded 検索（コイン前の無料チラ見せ用）。 */
export async function lookupStoryNotesForName(
  rawName: string,
  apiKey: string,
  viewerSub: string,
  meta?: { prefecture?: string; line?: string; lat?: number; lng?: number },
): Promise<
  | { ok: true; storyNotes: NonNullable<StationSeed["storyNotes"]> }
  | { ok: false; error: string; message: string }
> {
  const bare = rawName.replace(/駅$/u, "").trim();
  if (!bare) {
    return {
      ok: false,
      error: "invalid_name",
      message: "駅名を入力してください。",
    };
  }
  const label = bare.endsWith("駅") ? bare : `${bare}駅`;
  const place =
    meta?.prefecture || meta?.line
      ? `（${meta?.prefecture ?? "日本"} · ${meta?.line ?? "路線情報は要確認"}）`
      : "";
  const coords =
    typeof meta?.lat === "number" && typeof meta?.lng === "number"
      ? `\n駅座標の目安: ${meta.lat}, ${meta.lng}`
      : "";
  const prompt = [
    "あなたは日本の駅の徒歩圏案内の編集者です。Google検索で実在を確認してください。",
    "目的: この駅の徒歩圏が映画・ドラマ・小説・アニメの撮影地／舞台として知られる作品だけを storyNotes に書く。",
    "出力は JSON のみ。観光ランキング口調禁止。推測・都市伝説・遠いスタジオは禁止。",
    "土地の歴史・店リスト・歩き方の全文は書かない。storyNotes だけ。",
    "",
    `駅名: ${label}${place}${coords}`,
    `検索のヒント: 「${bare} ロケ地」「${bare} 撮影地」「${bare} 聖地」「${bare} 映画」「${bare} ドラマ」「${bare} 小説 舞台」`,
    "",
    "スキーマ:",
    '{ "storyNotes": [{ "title": "『作品名』と場所", "body": "2〜4文。作品名と、いま歩いて何が見えるか。最後は知識の完結で終わらせず、改札の外にその気配を足でたどれる予感を一文残す" }] }',
    "",
    "制約:",
    "- 最大4件。確かなものだけ。無ければ { \"storyNotes\": [] }",
    "- title に作品名を入れる（『』付きが望ましい）",
    "- 各 body の結びは百科事典の要約で閉じない。例:「改札の外に、その名残を感じながら歩ける道が続いています。」",
    "- 店リスト・散歩コース全体・コインや課金の話は書かない",
    "- 出町柳以外で鴨川デルタ・下鴨・枡形・ふたばを出さない",
  ].join("\n");
  const filled = await callGeminiGenerate(
    apiKey,
    viewerSub,
    {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    },
    GEMINI_GROUNDED_MS,
  );
  if (!filled.ok) {
    return {
      ok: false,
      error: filled.error,
      message: filled.message,
    };
  }
  const parsed = extractJsonObject(filled.text);
  if (!parsed) {
    return { ok: true, storyNotes: [] };
  }
  const storyNotes = ensureStoryPeekWalkInvite(
    parseNoteList(parsed.storyNotes, 4) ?? [],
  );
  return { ok: true, storyNotes };
}

/** BYOK で物語のゆかりだけ調べる。 */
export async function lookupStoryNotesWithUserAi(
  rawName: string,
  config: UserAiConfig,
  viewerSub: string,
  meta?: { prefecture?: string; line?: string; lat?: number; lng?: number },
): Promise<
  | { ok: true; storyNotes: NonNullable<StationSeed["storyNotes"]> }
  | { ok: false; error: string; message: string }
> {
  return byokRuntime.run(config, () =>
    lookupStoryNotesForName(rawName, config.apiKey, viewerSub, meta),
  );
}

/** 物語のゆかりだけ grounded で拾う（正本も1回目も空のとき）。 */
async function fillStoryNotesIfEmpty(
  station: StationSeed,
  apiKey: string,
  viewerSub: string,
): Promise<StationSeed> {
  if ((station.storyNotes?.length ?? 0) > 0) return station;
  const looked = await lookupStoryNotesForName(station.name, apiKey, viewerSub, {
    prefecture: station.prefecture,
    line: station.line,
    lat: station.lat,
    lng: station.lng,
  });
  if (!looked.ok || !looked.storyNotes.length) return station;
  return { ...station, storyNotes: looked.storyNotes };
}

/**
 * 後処理。Gemini は最大もう 1 回（穴埋め）だけ。
 * 以前の多段 expand（店・定番・名所・休みを別々）は打たない。
 */
async function finalizeAiStation(
  result: AiStationResult | { error: string; message: string },
  apiKey: string,
  viewerSub: string,
): Promise<AiStationResult | { error: string; message: string }> {
  if ("error" in result) return result;

  let station = result.station;
  // 収録ノート（二ノ瀬・出町など）があれば土地文を正本で上書き
  // withAreaDepth 内で物語のゆかり正本も載る。目の置きどころは AI 優先
  station = withAreaDepth(station);
  station = refineLandProse(ensureLandPresentAnchors(station));
  station = ensureLandMentions(station);

  // 1回目で薄ければ、店・名所・休み・土地文をまとめて 1 回だけ穴埋め
  if (needsGapFill(station)) {
    station = await fillStationGapsOnce(station, apiKey, viewerSub);
    station = ensureLandMentions(station);
  }
  // 正本にも1回目にも無ければ、撮影地だけ grounded でもう一度
  station = await fillStoryNotesIfEmpty(station, apiKey, viewerSub);
  station = withAreaDepth(station);
  station = sealAtmosphereCorridors(station);
  station = sealPreferredDetours(station);

  if ((station.spots?.length ?? 0) < 3) {
    return {
      error: "empty_spots",
      message: "案内スポットを作れませんでした。別の駅名で試してください。",
    };
  }

  const shopsBeforeFar = station;
  station = filterFarSpots(station);
  station = stripUntrustedShops(station);
  station = ensureShopGuideFloor(station, shopsBeforeFar);
  station = stripUntrustedShops(station);
  station = sanitizeBikeRentals(station);
  // major 不足は API せずヒューリスティックで印を付ける（名所優先）
  if (countMajor(station) < MAJOR_FACE_TOTAL) {
    station = promoteMajorHeuristic(station);
  }
  station = sealIconicMajors(station);
  station = balanceMajorsSightseeing(station);
  station = normalizeEdibleSouvenirs(station);
  station = reclassifyWorshipPlaces(station);
  station = stripUntrustedShops(station);
  station = {
    ...station,
    spots: filterFirstVisitSpots(station.spots, station.name),
  };
  station = snapLandmarkCoordinates(station);
  station = balanceMajorsSightseeing(station);
  station = refineLandProse(ensureLandPresentAnchors(station));
  station = snapLandmarkCoordinates(station);
  station = sealGuideIntegrity(station);
  // 関所後の間引きで 3 未満になったら失敗（土地寄り→通常生成フォールバックの判定用）
  if ((station.spots?.length ?? 0) < 3) {
    return {
      error: "empty_spots",
      message: "案内スポットを作れませんでした。別の駅名で試してください。",
    };
  }
  return { station, source: "ai" };
}

/** 正本は data/landmark-locks.json（住所 + OSM／Apple 店舗ノード）。AI 仮座標は捨てる。 */
type LandmarkLock = {
  station: string;
  kind: string;
  keywords: string[];
  canonical?: string;
  lat: number;
  lng: number;
  walkMinutes: number;
};

function lockMatches(name: string, lock: LandmarkLock): boolean {
  if (name.includes("※") || name.includes("以外")) return false;
  const title = name.replace(/[（(][^）)]*[）)]/g, "").trim();
  if (lock.kind === "river") {
    if (title.includes("公園")) return false;
    const river =
      /デルタ|河川敷|三角州/.test(title) || (/鴨川/.test(title) && /川端|川沿い/.test(title));
    return river && !/カフェ|茶房|ふたば/.test(title) && !title.endsWith("店");
  }
  return lock.keywords.some((k) => title.includes(k));
}

function isLockedSpot(name: string, stationName: string): boolean {
  return (landmarkLocks.locks as LandmarkLock[]).some(
    (p) => stationName.includes(p.station) && lockMatches(name, p),
  );
}

/**
 * 座標の正本: ロック → 駅直上の未確定仮ピン座標は捨てる（スポットは案内用に残す）。
 * 地図に出るのは lock / Apple のみ（sealMapCoordinates + mapTrustedSpots）。
 */
function snapLandmarkCoordinates(station: StationSeed): StationSeed {
  return sealMapCoordinates(station);
}

const EDIBLE_OMIYAGE_RE =
  /ふたば|みたらし|だんご|団子|豆餅|阿闍梨|最中|羊羹|もみじ饅頭|赤福|サブレ|カステラ|饅頭|もなか|最中|大福|羊羹|銘菓/;

function isWorshipPlaceName(name: string): boolean {
  if (/茶屋|茶房|食堂|本店|店$/.test(name)) return false;
  return /(寺|神社|神宮|大社|寺院)$/.test(name);
}

/** 寺社がお土産・ご飯に入っていたら観光へ戻す */
function reclassifyWorshipPlaces(station: StationSeed): StationSeed {
  const spots = station.spots.map((s) => {
    if ((s.guide === "souvenir" || s.guide === "meal") && isWorshipPlaceName(s.name)) {
      return { ...s, guide: "sight" as const };
    }
    return s;
  });
  return { ...station, spots };
}

function isEdibleOmiyage(spot: Spot): boolean {
  // 店名だけ。blurb の「銘菓」「饅頭」まで拾うと定食屋が土産に化け、ご飯が3件前後に減る
  return EDIBLE_OMIYAGE_RE.test(spot.name);
}

/** 名物菓子・銘菓を souvenir に寄せる（どの駅でも）。喫茶は休むところへ。 */
function normalizeEdibleSouvenirs(station: StationSeed): StationSeed {
  const spots: Spot[] = station.spots.map((s) => {
    if (isSitDownCafeName(s.name) && (s.guide === "meal" || s.guide === "tip")) {
      return { ...s, guide: "rest" as const, genre: "nature", majorWorthy: false };
    }
    // 銘菓だけ souvenir へ。majorWorthy の定食・食堂は meal のまま（ご飯や最低5件を守る）
    if (s.guide === "meal" && isEdibleOmiyage(s)) {
      return { ...s, guide: "souvenir" as const };
    }
    return s;
  });
  return { ...station, spots };
}

function landmarkFameScore(spot: Spot, stationName?: string): number {
  const n = spot.name;
  const blob = `${n}${spot.blurb ?? ""}`;
  let score = 0;
  if (spot.majorWorthy) score += 40;
  if (spot.guide === "sight") score += 8;
  if (isGuidebookWorship(n, stationName)) score += 55;
  if (/デルタ|三角州/.test(n)) score += 70;
  if (isOrdinaryPublicFace(n) || /合流/.test(n)) score += 45;
  if (/城|金閣|清水|浅草/.test(n)) score += 35;
  if (/世界遺産/.test(blob)) score += 20;
  if (/城跡|復元|参道|楼門/.test(n)) score -= 20;
  if (isNeighborhoodWorship(n, stationName)) score -= 80;
  if (/幸神社|境内社|摂社/.test(n)) score -= 60;
  score += Math.max(0, 8 - spot.walkMinutes * 0.2);
  return score;
}

function sealDemachiMustFaces(station: StationSeed): StationSeed {
  if (!/出町柳/.test(station.name)) return station;
  let spots = [...station.spots];
  if (!spots.some((s) => /デルタ|三角州/.test(s.name))) {
    spots.push({
      id: "lock-demachi-delta",
      name: "鴨川デルタ",
      genre: "history",
      guide: "rest",
      blurb: "鴨川と高野川の合流。飛び石が並び、多くの人が川辺で憩う町の顔。",
      detail: "鴨川と高野川の合流（鴨川デルタ）",
      walkMinutes: 3,
      x: 0.42,
      y: 0.55,
      majorWorthy: true,
      secretWorthy: false,
      lat: 35.0301227,
      lng: 135.7717415,
    });
  } else {
    spots = spots.map((s) => {
      if (!/デルタ|三角州/.test(s.name)) return s;
      return {
        ...s,
        name: s.name.includes("鴨川") ? s.name : "鴨川デルタ",
        majorWorthy: true,
        walkMinutes: Math.min(s.walkMinutes, 5),
        lat: 35.0301227,
        lng: 135.7717415,
      };
    });
  }
  if (!spots.some((s) => /下鴨|賀茂御祖/.test(s.name))) {
    spots.push({
      id: "ai-major-shimogamo",
      name: "下鴨神社（賀茂御祖神社）",
      genre: "history",
      guide: "sight",
      blurb: "世界遺産の社。糺の森を抜けて本殿へ。出町柳の顔になる名所。",
      detail: "駅から北東へ。デルタを経由すると道がわかりやすい。",
      hours: "6:30〜17:00（季節により変動）",
      walkMinutes: 12,
      x: 0.55,
      y: 0.35,
      majorWorthy: true,
      secretWorthy: false,
      lat: 35.0387,
      lng: 135.7727,
    });
  }
  return { ...station, spots };
}

/** major を観光2＋名物1に整える（ベタな名所優先。小社で埋めない） */
function balanceMajorsSightseeing(station: StationSeed): StationSeed {
  let working = sealDemachiMustFaces(station);

  working = {
    ...working,
    spots: filterFirstVisitSpots(working.spots, working.name),
  };

  const majors = working.spots.filter((s) => s.majorWorthy);
  const isFood = (s: Spot) => s.guide === "meal" || s.guide === "souvenir";
  const isSightish = (s: Spot) =>
    s.guide === "sight" ||
    s.guide === "rest" ||
    isGuidebookWorship(s.name, working.name) ||
    isOrdinaryPublicFace(s.name) ||
    /城|宮|デルタ/.test(s.name);

  const landmarkPool = [...majors, ...working.spots]
    .filter(isSightish)
    .filter((s) => !isNeighborhoodWorship(s.name, working.name))
    .filter((s) => !/幸神社/.test(s.name))
    .reduce<Spot[]>((acc, s) => {
      if (!acc.some((x) => x.id === s.id)) acc.push(s);
      return acc;
    }, [])
    .sort(
      (a, b) =>
        landmarkFameScore(b, working.name) - landmarkFameScore(a, working.name),
    );

  const foodMajors = majors.filter(isFood);
  const iconicFood =
    working.spots.find((s) => s.name.includes("ふたば")) ||
    foodMajors.find((s) => ICONIC_SHOP_RE.test(`${s.name}${s.blurb ?? ""}`)) ||
    foodMajors[0] ||
    null;

  // 出町柳は鴨川デルタ＋下鴨を名所枠に優先。合計5（名所3＋名物2目安）
  const keep: Spot[] = [];
  const isSoftCafe = (s: Spot) =>
    /多目的|つながる|知る、感じる|コワーキング|レンタルスペース/.test(
      `${s.name}${s.blurb ?? ""}`,
    );
  if (/出町柳/.test(working.name)) {
    const delta = landmarkPool.find((s) => /デルタ|三角州/.test(s.name));
    const shrine = landmarkPool.find((s) => /下鴨|賀茂御祖/.test(s.name));
    if (delta) keep.push(delta);
    if (shrine && !keep.some((k) => k.id === shrine.id)) keep.push(shrine);
  }
  for (const s of landmarkPool) {
    if (keep.length >= MAJOR_SIGHT_TARGET) break;
    if (isSoftCafe(s)) continue;
    if (/城跡|復元|参道|楼門/.test(s.name)) continue;
    if (!keep.some((k) => k.id === s.id)) keep.push(s);
  }
  for (const s of landmarkPool) {
    if (keep.length >= MAJOR_SIGHT_TARGET) break;
    if (isSoftCafe(s)) continue;
    if (!keep.some((k) => k.id === s.id)) keep.push(s);
  }
  const foodPool = [
    ...(iconicFood ? [iconicFood] : []),
    ...foodMajors,
    ...working.spots.filter(isFood),
  ].filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i);
  let foodAdded = 0;
  for (const food of foodPool) {
    if (foodAdded >= MAJOR_FOOD_TARGET || keep.length >= MAJOR_FACE_TOTAL) break;
    if (isSoftCafe(food)) continue;
    if (!keep.some((k) => k.id === food.id)) {
      keep.push(food);
      foodAdded += 1;
    }
  }
  for (const s of landmarkPool) {
    if (keep.length >= MAJOR_FACE_TOTAL) break;
    if (isSoftCafe(s)) continue;
    if (!keep.some((k) => k.id === s.id)) keep.push(s);
  }

  const ids = new Set(keep.slice(0, MAJOR_FACE_TOTAL).map((k) => k.id));
  if (ids.size === 0) return working;
  return {
    ...working,
    spots: working.spots.map((s) => ({
      ...s,
      majorWorthy: ids.has(s.id),
      secretWorthy: ids.has(s.id) ? false : s.secretWorthy,
    })),
  };
}

async function generateFromPrompt(
  prompt: string,
  fallbackName: string,
  apiKey: string,
  viewerSub: string,
): Promise<AiStationResult | { error: string; message: string }> {
  const contents = [{ role: "user", parts: [{ text: prompt }] }];

  // 実在店・名所の精度を上げるため、Google検索グラウンディングを先に使う。
  const grounded = await callGeminiGenerate(
    apiKey,
    viewerSub,
    {
      contents,
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.45,
        maxOutputTokens: 8192,
      },
    },
    GEMINI_GROUNDED_MS,
  );

  if (grounded.ok) {
    const parsed = stationFromGeminiText(grounded.text, fallbackName);
    if (!("error" in parsed)) {
      return finalizeAiStation(parsed, apiKey, viewerSub);
    }
    if (parsed.error === "not_a_station") return parsed;
  } else if (grounded.error === "gemini_http") {
    return { error: grounded.error, message: grounded.message };
  }

  // グラウンディングが空／壊れたときだけ、JSON専用の速い経路へ。
  const fast = await callGeminiGenerate(
    apiKey,
    viewerSub,
    {
      contents,
      generationConfig: {
        temperature: 0.45,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    },
    GEMINI_FAST_MS,
  );

  if (!fast.ok) {
    return grounded.ok
      ? finalizeAiStation(
          stationFromGeminiText(grounded.text, fallbackName),
        apiKey,
        viewerSub,
        )
      : { error: fast.error, message: fast.message };
  }
  return finalizeAiStation(
    stationFromGeminiText(fast.text, fallbackName),
    apiKey,
    viewerSub,
  );
}

/**
 * 収録土地文がある駅: 土地は正本のまま、Search は spots／殻メタだけ。
 * （フル土地生成＋土地穴埋め Search を避ける）
 */
async function generateGuideFromLandStock(
  rawName: string,
  apiKey: string,
  viewerSub: string,
): Promise<AiStationResult | { error: string; message: string }> {
  const depth = lookupAreaDepthByName(rawName);
  if (!isRichLandDepth(depth) || !depth) {
    return generateFromPrompt(
      buildStationPrompt(rawName),
      rawName,
      apiKey,
      viewerSub,
    );
  }
  const seed = stationShellFromLandDepth(rawName, depth);
  const withPlaces = await expandPlacesFromLand(seed, apiKey, viewerSub);
  if ((withPlaces.spots?.length ?? 0) < 1) {
    // spots が空なら通常生成へフォールバック（Search 失敗時など）
    return generateFromPrompt(
      buildStationPrompt(rawName),
      rawName,
      apiKey,
      viewerSub,
    );
  }
  // 土地文は正本を維持（モデルが触っていても戻す）
  const locked: StationSeed = {
    ...withPlaces,
    stationIntro: depth.stationIntro ?? withPlaces.stationIntro,
    areaAbout: undefined,
    walkGuide: depth.walkGuide ?? withPlaces.walkGuide,
    historyNotes: depth.historyNotes ?? withPlaces.historyNotes,
    sightseeingNotes: depth.sightseeingNotes ?? withPlaces.sightseeingNotes,
    storyNotes: depth.storyNotes ?? withPlaces.storyNotes,
  };
  const finalized = await finalizeAiStation(
    { station: locked, source: "ai" },
    apiKey,
    viewerSub,
  );
  // spots 寄りだけだと 1〜2 件で関所落ちすることがある → 通常生成へ（土地は finalize 内 withAreaDepth で戻る）
  if ("error" in finalized && finalized.error === "empty_spots") {
    return generateFromPrompt(
      buildStationPrompt(rawName),
      rawName,
      apiKey,
      viewerSub,
    );
  }
  return finalized;
}

export async function generateStationGuideWithGemini(
  rawName: string,
  apiKey: string,
  viewerSub: string,
): Promise<AiStationResult | { error: string; message: string }> {
  if (isRichLandDepth(lookupAreaDepthByName(rawName))) {
    return generateGuideFromLandStock(rawName, apiKey, viewerSub);
  }
  return generateFromPrompt(
    buildStationPrompt(rawName),
    rawName,
    apiKey,
    viewerSub,
  );
}

/** 買い切りユーザーの自分の AI（Gemini / OpenAI 互換）で駅案内を作る。 */
export async function generateStationGuideWithUserAi(
  rawName: string,
  config: UserAiConfig,
  viewerSub: string,
): Promise<AiStationResult | { error: string; message: string }> {
  return byokRuntime.run(config, () => {
    if (isRichLandDepth(lookupAreaDepthByName(rawName))) {
      return generateGuideFromLandStock(rawName, config.apiKey, viewerSub);
    }
    return generateFromPrompt(
      buildStationPrompt(rawName),
      rawName,
      config.apiKey,
      viewerSub,
    );
  });
}

export async function generateNearbyStationWithGemini(
  lat: number,
  lng: number,
  apiKey: string,
  viewerSub: string,
): Promise<AiStationResult | { error: string; message: string }> {
  // Defensive: always send coarsened coords even if a caller forgot to fuzz.
  const coarse = fuzzLatLngForExternal(lat, lng);
  return generateFromPrompt(
    buildNearbyPrompt(coarse.lat, coarse.lng),
    `現在地(${coarse.lat.toFixed(2)},${coarse.lng.toFixed(2)})`,
    apiKey,
    viewerSub,
  );
}
