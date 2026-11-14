import type {
  AreaHistoryNote,
  StationSeed,
} from "@/data/mishiranu-stations";
import {
  EIZAN_LAND_DEPTH,
  EIZAN_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-eizan-land-depth";
import {
  KEIHAN_LAND_DEPTH,
  KEIHAN_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-keihan-land-depth";
import {
  RANDEN_LAND_DEPTH,
  RANDEN_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-randen-land-depth";
import {
  HANKYU_LAND_DEPTH,
  HANKYU_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-hankyu-land-depth";
import {
  SAGANO_LAND_DEPTH,
  SAGANO_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-sagano-land-depth";
import {
  KARASUMA_LAND_DEPTH,
  KARASUMA_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-karasuma-land-depth";
import { ensureLandPresentAnchors } from "@/lib/mishiranu-land-anchors";
import { refineLandProse } from "@/lib/mishiranu-land-prose";
import { withStoryNotes } from "@/lib/mishiranu-story-notes";

export type AreaDepth = {
  stationIntro?: string;
  areaAbout?: string;
  walkGuide?: string;
  historyNotes?: AreaHistoryNote[];
  sightseeingNotes?: AreaHistoryNote[];
  /** ドラマ・映画・文学の撮影地／舞台（徒歩圏・確かなもの） */
  storyNotes?: AreaHistoryNote[];
};

/**
 * Extra narrative depth layered onto curated stations.
 * Merges with seed fields: longer copy wins when both exist by preferring depth.
 */
export const AREA_DEPTH: Record<string, AreaDepth> = {
  demachiyanagi: {
    // 01 駅のこと — 路線・駅前＋いつなぜできたか
    stationIntro:
      "京阪本線と叡山電鉄が隣り合う、鴨川デルタのたもと。叡電側は大正14年（1925年）、京都電燈の鞍馬線として出町柳付近が開業し、北山へ向かう山の線の起点になりました。京阪側は平成元年（1989年）、鴨東線（三条〜出町柳）の開業で地下駅が置かれ、都心・大阪方面と叡電が隣り合う結節点になりました。いま地下の京阪から地上の叡電へ乗り換える駅で、甘いものの匂いと水音、自転車の群れが同じ半径にあります。観光の起点にも、日常の寄り道にもなります。",
    // 概観は historyNotes が担う（同じ川・街・大学を二重に書かない）
    areaAbout: undefined,
    // 02 歩き方 — 順番と方角だけ（デルタを通って枡形）
    walkGuide:
      "京阪は5番出口から鴨川デルタの合流を通り、出町橋を西へ渡って枡形商店街へ。時間があるときは北の並木から下鴨へ。東は百万遍・京都大学方面。南西の同志社大学へは、相国寺の中を通っていく（最短の南回りより境内の方が土地らしい）。食べ物は駅前で買って、鴨川デルタで食べるのがおすすめです。",
    historyNotes: [
      {
        title: "「出町」の名",
        body:
          "京の都の外縁に「出た町」としてひらけた地名で、御所の北側・今出川あたりから先の町場を指し、市や人の出入りの場として長く使われてきました。駅名の「柳」は川端の風景と結びついた語感でもあり、いま枡形を歩くと、用事と寄り道が同じ道幅で行き交うその外縁の役割が、言葉より先に体でわかります。",
      },
      {
        title: "鴨川デルタと二つの川",
        body:
          "西側の上流を賀茂川、東側を高野川と呼び、合流点から南は鴨川になります。三角州のような地形は治水と信仰の両方に関わり、下鴨の森へ続く景色の入口でもありました。いまベンチや水遊びの人が居るのも同じ三角で、水音の向きを聞けばどちらの川に近いかが体でわかります。",
      },
      {
        title: "枡形商店街と鯖街道",
        body:
          "枡形商店街は、鯖街道（若狭街道）の京都側の終点・着き口として知られます。若狭の塩鯖が都へ入る最後の町場だった距離感が、短いアーケードの幅に残っています。買う・食べる・通り過ぎるが同じ道で起きるのは昔の着き口の続きで、甘いものの匂いはいまの出町の顔です。",
      },
      {
        title: "下鴨と糺の森",
        body:
          "北方の下鴨神社（賀茂御祖神社）と糺の森は、古くからこの土地の聖域で、世界遺産「古都京都の文化財」の一部です。参道の木立は駅からも気配が届き、半日コースの芯になるのも、聖域が日常の北の方角として残っているからです。",
      },
      {
        title: "京都大学と通学の東",
        body:
          "東の百万遍・吉田に広がる京都大学は、近代以降に厚くなった学びの層です。キャンパスは駅のすぐ隣ではありませんが、学生の自転車・古本・喫茶の流れが駅前と川端まで届き、出町から見て「東＝学び」の方角がいまでも空気を決めています。",
      },
      {
        title: "同志社大学と今出川",
        body:
          "南西の今出川に同志社大学のキャンパスがあり、烏丸今出川まわりの通学路が近代の学問都市の骨格を支えてきました。その流れは出町側の川端や定食屋の客層にもつながり、乗り換え客と学生が同じベンチを分け合う景色になっています。",
      },
    ],
    // 寄るところ — 正式名＋行き方＋着いたら（具体カード）
    sightseeingNotes: [
      {
        title: "鴨川デルタ",
        body:
          "鴨川デルタです。京阪5番出口を出てすぐ北〜東の合流の三角へ歩けます（徒歩約2〜3分）。賀茂川と高野川が一つになる縁で、水音と空が開けます。食べ物は駅前で買って、ここで食べるのが定番です。",
      },
      {
        title: "枡形商店街",
        body:
          "枡形商店街です。5番出口からデルタの合流を通り、出町橋を西へ渡ると短いアーケードに入ります（徒歩約5分）。買う・食べる・通り過ぎるが同じ道幅で起きます。",
      },
      {
        title: "下鴨神社・糺の森",
        body:
          "下鴨神社（賀茂御祖神社）と糺の森です。駅から北の並木・参道へ進み、徒歩15〜20分ほど。木立の参道が続き、半日コースの北の芯になります。",
      },
      {
        title: "相国寺",
        body:
          "相国寺です。同志社・今出川へ向かうとき、境内の木立を東西に通る寄り道になります（駅から南西へ徒歩10分前後）。最短の南回りより、こちらが土地らしい通り方です。",
      },
    ],
  },
  chushojima: {
    stationIntro:
      "京阪本線と宇治線が分かれる、伏見の結節点。京阪の中書島駅は大正3年（1914年）に開業し、水路と町場のあいだに駅が置かれました。のちに宇治線が分岐し、本線と宇治方面をここで分ける役割が厚くなりました。ホームを出るとすぐに御香宮の参道へ歩け、少し足を伸ばせば濠川の水面と酒蔵の入口が続きます。乗り換えの駅でありながら、水路と神社の気配が濃く、すでに伏見の中に立っている感覚があります。",
    areaAbout: undefined,
    walkGuide:
      "駅を出たらまず御香宮で方角と香りの伝説を押さえ、そのあと濠川へ下りると伏見の水路がわかりやすいです。半日あるなら閘門方面か酒蔵入口まで伸ばし、食べる・土産は帰り道の駅前でまとめると荷物が軽く済みます。",
    historyNotes: [
      {
        title: "中書島の名",
        body:
          "秀吉家臣・松村対馬守（中書）が居を構えたことに由来する地名とされ、島の字は水路に囲まれた土地の記憶です。地名そのものが地形説明になっており、いま駅前から水面を見下ろすと、その「島」の感覚がいまでも先に来ます。",
      },
      {
        title: "水運と伏見",
        body:
          "宇治川派流・濠川は伏見の物流を支えた水路で、物資と酒が水面を行き来した時代の延長に、いまの十石舟や蔵の景観があります。岸の石積みを見ると観光の装飾より土木の実用が先に見え、歩く足がそのまま水運の跡を踏む感じです。",
      },
      {
        title: "御香宮と「香の水」",
        body:
          "御香宮神社は芳しい水の伝説で知られる古社で、伏見の名の由来にも重ねて語られてきました。駅からすぐの距離に「水の町」の入口が開き、参道の石灯籠と境内の静けさは、乗り換え客の一休みにもちょうどよいいまの距離感です。",
      },
      {
        title: "京阪の分岐点",
        body:
          "本線と宇治線がここで分かれ、ホーム端に立つと行き先が二枚の地図に割れる気配がします。近代の鉄道結節と、それ以前の水路の結節が重なっているのが中書島らしい構造で、いま発車メロディの向こうに水音が残るのもその重なりです。",
      },
      {
        title: "酒造の手前",
        body:
          "伏見の酒蔵めぐりの本場は桃山寄りにもう少し先へ広がってきましたが、中書島はその手前で呼吸を整える場所として残っています。粕漬けや小瓶の土産をここで見つけてから蔵の町へ入ると、歩くテンポが急ぎすぎません。",
      },
    ],
    sightseeingNotes: [
      {
        title: "駅から徒歩すぐ・北",
        body:
          "御香宮神社です。改札を出て北の参道へ入ると、石灯籠と境内が続きます。伏見の入口として最初に立ち寄りやすい場所です。",
      },
      {
        title: "駅から水路へ",
        body:
          "濠川の岸です。駅から少し歩くと水面と石積みが見えます。十石舟が通ることもあり、伏見の水路が体でわかります。",
      },
      {
        title: "食べる・休むの目安",
        body:
          "昼は駅前の定食やうどん、休みは御香宮の境内の木陰が使いやすいです。酒蔵方面へ足を延ばすなら、帰りは別の京阪駅も使えます。",
      },
    ],
  },
  biei: {
    areaAbout:
      "富良野線の小さな駅前は、観光地のチェックリストより先に、空と風の面積が広がります。丘と畑の遠景が駅のスケールを超えて見える場所で、用事がなくても「いる」だけで滞在が成立します。",
    walkGuide:
      "駅前の空地で地平線の向きを確認し、線路沿いの草道を短く往復するだけで十分なことが多いです。無理に名所へ飛ばず、風の強さを時間の単位にしてください。",
    historyNotes: [
      {
        title: "畑作と鉄道",
        body:
          "美瑛周辺は畑作の景観と鉄道が長く並走してきました。観光写真の丘も、もともとは暮らしの生産の場です。駅はその縁の、日常側の入口にあります。",
      },
    ],
    sightseeingNotes: [
      {
        title: "見るポイント",
        body:
          "駅名標の影、線路の直線、空の割れ方。小さなものほど、この駅では大きく見えます。",
      },
    ],
  },
  kanita: {
    areaAbout:
      "津軽海峡へ向かう気配が、駅前の待合と港寄りの風に残っています。フェリーの時間が町の時計代わりになる場所で、観光の派手さより、待ち時間の質が景色になります。",
    walkGuide:
      "待合で風を測ってから、港寄りの食堂と防風林の切れ目へ。短時間なら待合と踏切だけで十分です。",
    historyNotes: [
      {
        title: "海峡の手前",
        body:
          "蟹田は本州側から海峡へ向かう動線の手前にあります。港と鉄道が近接し、人の移動が季節と天候に左右されてきた土地です。",
      },
    ],
    sightseeingNotes: [
      {
        title: "見るポイント",
        body:
          "防風林の切れ目から見える明るさと、干物の匂い。港町の案内は、視覚より嗅覚が先に来ることもあります。",
      },
    ],
  },
  ashio: {
    areaAbout:
      "足尾の谷あいに残る鉱山の記憶が、木造駅舎や渓流の橋ににじんでいます。産業遺産を「見る」だけでなく、谷の狭さと水音の大きさで、当時の立地条件が体にわかります。",
    walkGuide:
      "駅舎と渓流の橋を往復し、鉱山遺産の看板で地名の層を確認する流れがわかりやすいです。斜面の歩きは靴次第なので、無理に奥まで入らなくて大丈夫です。",
    historyNotes: [
      {
        title: "足尾と通洞",
        body:
          "通洞は足尾銅山の坑口に近い駅のひとつです。近代日本の産業と公害の両方の記憶が、谷の地名に重なっています。観光化されても、土地の重さは消えません。",
      },
    ],
    sightseeingNotes: [
      {
        title: "見るポイント",
        body:
          "木造駅舎の質感、渓流の色、遺産看板の短い文。大きな博物館へ行かなくても、駅周辺で「産業の縁」が読めます。",
      },
    ],
  },
  sawara: {
    areaAbout:
      "小野川沿いの蔵造りの町並みが、水郷の佐原の顔です。舟と商人の町だった距離感が、いまも甘味の匂いや縁台の高さに残っています。駅から蔵へ歩くあいだに、観光と生活の境がゆるく混ざります。",
    walkGuide:
      "駅から蔵通りへ入り、川沿いを往復するのが基本です。甘味は途中で、縁台や水門で休みを挟むと半日がきれいに割れます。",
    historyNotes: [
      {
        title: "水郷の商人町",
        body:
          "佐原は利根川水系の水運で栄えた商人町です。蔵造りは防火と格式の表れでもあり、いまの観光景観の芯になっています。",
      },
    ],
    sightseeingNotes: [
      {
        title: "見るポイント",
        body:
          "蔵の壁の厚み、川面の反射、消防の倉庫など「守る」ための建物。甘いものだけ見て終わらせず、道の幅も覚えてください。",
      },
    ],
  },
  manazuru: {
    areaAbout:
      "真鶴半島の入口で、石と海の気配が駅前から混ざります。石材の町としての記憶と、港町の生活が短い徒歩圏に同居していて、観光の名所探しより素材の感触を追うと楽しいです。",
    walkGuide:
      "駅前の石の気配を拾ってから港寄りへ。定食で区切り、戻るときに海風の向きを確認すると滞在が締まります。",
    historyNotes: [
      {
        title: "石の町",
        body:
          "真鶴は石材で知られてきた半島の町です。切り出した石が建物や港の景色に残り、産業の痕跡が観光資源になる前から、暮らしの材料でした。",
      },
    ],
    sightseeingNotes: [
      {
        title: "見るポイント",
        body:
          "石の肌理、港の匂い、坂の角度。写真より手触りと勾配が、この駅の案内になります。",
      },
    ],
  },
  hamakanaya: {
    areaAbout:
      "東京湾の対岸へ渡るフェリーの気配が強い駅です。到着と出発が日常のリズムで、観光客も地元も同じ待合の時間を共有します。海風が強い日ほど、町の輪郭がはっきりします。",
    walkGuide:
      "駅と港のあいだをゆっくり往復し、待ち時間を景色にしてください。無理に内陸へ入らず、岸の線を見るだけで十分なことが多いです。",
    historyNotes: [
      {
        title: "渡船の結節",
        body:
          "浜金谷は海を渡る動線の結節として使われてきました。鉄道と船が近接する配置そのものが、この土地の説明です。",
      },
    ],
    sightseeingNotes: [
      {
        title: "見るポイント",
        body:
          "船の出入り、対岸の濃淡、待合の椅子の向き。動いているものに目を合わせると、滞在が短くても密度が出ます。",
      },
    ],
  },
  nagatoro: {
    areaAbout:
      "荒川の岩畳と山の近さが、長瀞の印象を決めます。舟下りの観光地として知られつつ、駅前にはまだ「川へ下りる」準備の空気が残っています。水音の大きさで、天気と水量がわかります。",
    walkGuide:
      "駅から川へ向かう坂を一度歩き、岩と水面のスケールを見てから戻るのがよい導入です。時間があれば舟乗り場周辺まで。",
    historyNotes: [
      {
        title: "岩畳と観光",
        body:
          "長瀞は奇岩と渓谷美で知られ、近代以降に観光地として整備されてきました。それでも駅からの距離感は、いまも「自然の縁」に降りる感じを保っています。",
      },
    ],
    sightseeingNotes: [
      {
        title: "見るポイント",
        body:
          "岩の層理、川の濁り具合、山の影。晴れた日の青さだけが魅力ではなく、曇り日の灰色も土地の色です。",
      },
    ],
  },
  katsunuma: {
    areaAbout:
      "葡萄畑の起伏が駅の背後に広がる、勝沼の入口です。ワインの町として知られる一方、畑の手入れの時間が景色の主語になっています。観光の試飲より先に、畝の向きを見ると土地がわかります。",
    walkGuide:
      "駅前で畑の傾斜を眺め、近場のぶどう・土産を見て戻る短冊コースが扱いやすいです。酒気を伴う寄り道は徒歩計画を先に。",
    historyNotes: [
      {
        title: "葡萄の産地",
        body:
          "勝沼は甲州葡萄とワイン醸造の産地として長く知られます。鉄道は出荷と人の往来を支え、駅は畑と町のあいだの結節でした。",
      },
    ],
    sightseeingNotes: [
      {
        title: "見るポイント",
        body:
          "畝の直線、ネットの輝き、駅からの俯瞰。近づきすぎず、一段高い場所から畑を見るのが勝沼らしい見方です。",
      },
    ],
  },
  kobuchizawa: {
    areaAbout:
      "八ヶ岳と南アルプスのあいだで、乗り換えと旅の起点になる駅です。高原の風がホームに入り、行き先の分岐が地図より先に体感されます。観光のゲートであり、滞在そのものにもなる場所です。",
    walkGuide:
      "ホームと駅前で山の方角を確認し、近場の休みと食事で滞在を組み立てるのがよいです。遠くの山座に気を取られすぎず、足元の風も測ってください。",
    historyNotes: [
      {
        title: "高原の結節点",
        body:
          "小淵沢は中央本線と小海線の結節として、高原観光の入口になってきました。乗換の待ち時間が、景色を見る時間に変わりやすい駅です。",
      },
    ],
    sightseeingNotes: [
      {
        title: "見るポイント",
        body:
          "山のシルエット、空の乾燥、ホームの長さ。大きな展望台へ行かなくても、駅構内で十分に高原が読めます。",
      },
    ],
  },
  obasute: {
    areaAbout:
      "姨捨の棚田を見下ろす夜景・月の名所として語られる一方、駅自体は小さな余白です。観光地の喧騒から一段降りた場所で、景色の「手前」に立つ感覚があります。",
    walkGuide:
      "無理に名所の中心へ入らず、駅からの見下ろしと風を優先してください。夜や季節で見え方が大きく変わるので、同じ場所でも滞在の質が違います。",
    historyNotes: [
      {
        title: "棚田と月",
        body:
          "姨捨は棚田と月の眺望で知られ、古典のイメージとも重なります。駅はそんな物語の縁に置かれた、静かめの扉です。",
      },
    ],
    sightseeingNotes: [
      {
        title: "見るポイント",
        body:
          "棚田の段、空の明るさ、眼下の灯り。昼間と夜で別の土地に見えます。",
      },
    ],
  },
  shimosuwa: {
    areaAbout:
      "諏訪湖のほとり、温泉と宿場の記憶が残る下諏訪です。湖の風と湯の匂いが近く、短い徒歩圏でも「滞在」の空気が出ます。観光の回り方より、湯上がりの速度で町を見ると馴染みます。",
    walkGuide:
      "駅から湖や温泉街の入口まで歩き、湯気と水面のどちらが近いかでコースを選ぶと迷いにくいです。",
    historyNotes: [
      {
        title: "中山道と温泉",
        body:
          "下諏訪は中山道の宿場であり、温泉地でもあります。旅人が休むための町の機能が、いまの観光地の下地になっています。",
      },
    ],
    sightseeingNotes: [
      {
        title: "見るポイント",
        body:
          "湯気、湖の水平線、宿場の道幅。大きな名所より、足元の湿気と温かさが案内になります。",
      },
    ],
  },
  yui: {
    areaAbout:
      "薩埵峠へ向かう手前の、由比の海沿いです。古い街道と海の距離が近く、桜えびで知られる味覚の土地でもあります。駅は峠の景色へ行く前の、呼吸を整える場所です。",
    walkGuide:
      "駅前で海風を確認し、短く港・街路を歩いてから峠方面の判断を。食べる寄り道は帰りに残すと荷物が楽です。",
    historyNotes: [
      {
        title: "東海道の風景",
        body:
          "由比は東海道の景勝地・薩埵峠に近い宿場町の系譜を持ちます。海と山が迫る地形が、昔もいまも旅の印象を強くします。",
      },
    ],
    sightseeingNotes: [
      {
        title: "見るポイント",
        body:
          "海の近さ、峠への勾配、干物や桜えびの匂い。風景と味覚が同じ徒歩圏にあります。",
      },
    ],
  },
  nebukawa: {
    areaAbout:
      "丹那断層や災害の記憶が語られることもある、根府川の海縁です。駅からの眺めは美しい一方で、土地の履歴は穏やかではありません。景色のきれいに、歴史の厚みが混ざります。",
    walkGuide:
      "安全な範囲で海側の眺めを取り、説明板があれば先に読むと滞在の意味が変わります。無理な海岸歩行は避けてください。",
    historyNotes: [
      {
        title: "災害と鉄道",
        body:
          "根府川周辺は関東大震災などに伴う災害の記憶と結びついて語られることがあります。美しい車窓の背後に、土地の危うさの歴史があります。",
      },
    ],
    sightseeingNotes: [
      {
        title: "見るポイント",
        body:
          "海と崖の距離、線路の通い方。眺めの良さだけでなく、地形の厳しさも案内の一部です。",
      },
    ],
  },
  amarube: {
    areaAbout:
      "旧余部鉄橋の景色で知られる、日本海側の駅です。高い橋脚の記憶と、いまの橋梁・公園的な眺めが重なり、産業遺産と観光が同居しています。海風が強く、空が広い日に駅の性格が出ます。",
    walkGuide:
      "鉄橋・橋梁の眺めポイントを先に押さえ、風が強い日は短時間で区切るのが安全です。写真の位置取りより、風の音を優先してください。",
    historyNotes: [
      {
        title: "余部の橋梁",
        body:
          "余部は高い鉄橋で知られ、鉄道写真と観光の両方で名を馳せました。橋梁の更新後も、「高所を走る」イメージが土地に残っています。",
      },
    ],
    sightseeingNotes: [
      {
        title: "見るポイント",
        body:
          "橋脚のリズム、日本海の水平線、風の強さ。晴れた青さだけでなく、曇天の金属色もこの駅の色です。",
      },
    ],
  },
  onomichi: {
    areaAbout:
      "坂と猫としまなみの入口として知られる尾道は、駅前からすでに上下の運動が始まります。寺と路地が密度高く、観光の消費より「迷う」ことが価値になる町です。海が見える角度を探すだけでも半日が埋まります。",
    walkGuide:
      "駅から坂へ少し上がり、海を見下ろす位置を確保してから路地へ。急がず、下りと上りの往復で町の厚みを測ると疲れにくいです。",
    historyNotes: [
      {
        title: "港町と坂の寺",
        body:
          "尾道は港と寺院が斜面に重なる町として長く描かれてきました。文学や映画の舞台にもなり、観光以前から「眺めの町」でした。",
      },
    ],
    sightseeingNotes: [
      {
        title: "見るポイント",
        body:
          "坂の勾配、海の切れ込み、路地の幅。名所カードより、迷った角の方が尾道らしいです。",
      },
    ],
  },
  misumi: {
    areaAbout:
      "三角浦の海と、明治の港町の面影が残る三角です。レトロな駅と海の近さが印象的で、大きな観光地というより、港の縁で時間を置く場所です。",
    walkGuide:
      "駅と海のあいだを往復し、港の線を目で追うのが基本。古い建物があれば外観だけでも十分な案内になります。",
    historyNotes: [
      {
        title: "港と近代化",
        body:
          "三角は近代の港湾整備と結びついて発展した町のひとつです。駅や港の配置に、その時代の設計思想が残っています。",
      },
    ],
    sightseeingNotes: [
      {
        title: "見るポイント",
        body:
          "海の色、埠頭の直線、駅舎の年代感。派手な名所がなくても、配置そのものが展示です。",
      },
    ],
  },
  usuki: {
    areaAbout:
      "臼杵は城下町と石仏で知られる豊後の町です。駅から町へ入ると、石の表情と通りの折れ方が案内役になります。観光バスの密度より、路地の静けさに土地の芯があります。",
    walkGuide:
      "駅から城下の通りへ入り、石と壁の質感を見ながら折り返す。石仏まで行くなら体力と時間を半日枠で見てください。",
    historyNotes: [
      {
        title: "城下と石仏",
        body:
          "臼杵城下町と磨崖仏は、この土地の二大テーマです。信仰と領主の町づくりが、いまの観光の骨格になっています。",
      },
    ],
    sightseeingNotes: [
      {
        title: "見るポイント",
        body:
          "石の彫り、通りの屈折、城下の門の名残。遠い名所へ急がず、手前の壁面を丁寧に見ると密度が出ます。",
      },
    ],
  },
  hitoyoshi: {
    areaAbout:
      "人吉は球磨川沿いの城下町で、川霧や温泉のイメージと重なります。駅は町の日常側にあり、観光の「川下り」へ行く前の生活感が残っています。",
    walkGuide:
      "駅前で川の方角を確かめ、近場の町歩きで城下の道幅を感じてから遠出を判断するとよいです。",
    historyNotes: [
      {
        title: "相良と球磨川",
        body:
          "人吉は相良氏の城下として発展し、球磨川の水運・風景と深く結びついてきました。川は恵みでもあり、ときの脅威でもありました。",
      },
    ],
    sightseeingNotes: [
      {
        title: "見るポイント",
        body:
          "川の気配、城下の角、湯気。晴れた日の青さだけでなく、霧の日の町も人吉らしいです。",
      },
    ],
  },
  tsukazaki: {
    areaAbout:
      "田舎の小さな駅の、余白が主役になる場所です。用事のなさ自体が景色で、観光情報を厚くしすぎない方が土地に合います。風と虫の音が案内板代わりです。",
    walkGuide:
      "ホームと駅前をゆっくり往復し、見える範囲の畑や森の境界を見るだけで十分です。",
    historyNotes: [
      {
        title: "小さな駅の役割",
        body:
          "こうした駅は、花形の観光地ではなく、地域の移動の点滴として残ってきました。残っていること自体が歴史です。",
      },
    ],
    sightseeingNotes: [
      {
        title: "見るポイント",
        body:
          "空の大きさ、草木の高さ、列車の通過間隔。何もないことの細部を拾う旅向きです。",
      },
    ],
  },
  tamatsukuri: {
    areaAbout:
      "玉造は温泉の香りが駅の段階からする町です。川沿いの足湯や湯めぐりの入口として機能し、観光の「効能」より先に、足元の温度が案内になります。",
    walkGuide:
      "駅から温泉街の入口まで歩き、足湯で一度区切るのがわかりやすいです。湯上がりのあとで寄り道を足すとペースが安定します。",
    historyNotes: [
      {
        title: "温泉の門前",
        body:
          "玉造温泉は古代からの湯治の地としても語られ、神話や出雲の文脈と結びつけて紹介されることが多い土地です。駅はその門前の縁にあります。",
      },
    ],
    sightseeingNotes: [
      {
        title: "見るポイント",
        body:
          "湯気、川音、足湯の温度。景色の派手さより、体温の変化がこの駅の観光案内です。",
      },
    ],
  },
  ninose: {
    stationIntro:
      "叡山電鉄鞍馬線の山あいの無人駅。昭和初期（1928〜29年ごろ）に北山へ人を運ぶ線が敷かれ、二ノ瀬はその途中の停留所として置かれました。終着の観光駅ではなく、谷の呼吸を整える中間の駅です。ホームに立つと、すぐに川と木立の気配がまわり、電車の合間の静けさが案内の入口になります。短い滞在でも「余白の駅」であることが体でわかります。",
    areaAbout: undefined,
    walkGuide:
      "駅を出たらまず二ノ瀬川の水音で方角をとり、短い滞在なら駅前の山道を往復するだけで十分です。時間があるときは北の貴船神社まで石段と川沿いをたどります。食べる・休むは貴船側か、電車で一駅動いてからでも遅くありません。",
    historyNotes: [
      {
        title: "叡電の山あい",
        body:
          "叡山電鉄鞍馬線は、京都の北山へ人を運ぶための細い線として敷かれました。二ノ瀬はその途中の無人駅として残り、観光の終着ではなく谷の呼吸を整える停留所の役割を持っています。列車が去ったあとの静けさが、いまもこの駅の歴史の感触です。",
      },
      {
        title: "二ノ瀬川の気配",
        body:
          "駅のすぐそばを流れる渓流が、長いあいだ土地の骨格でした。治水の大きな話や広い河川敷はなく、水音そのものが方角と距離感を教え、ホームから川へ視線を落とすだけで山あいの駅だとわかります。耳が先の案内は、いまでも変わりません。",
      },
      {
        title: "貴船への道",
        body:
          "北の貴船神社までは徒歩でおよそ30〜40分。石段と川沿いが続き、参拝は境内に着く前から始まる道筋です。二ノ瀬は貴船口の手前で一度息を整える場所として残っており、急がずに歩くと谷の濃さが体に残ります。",
      },
      {
        title: "無人駅の層",
        body:
          "改札のないホーム、少ない本数、通り過ぎるだけの時間は、山あいの鉄道が残した運用の形です。用事のなさが景色になっており、観光情報を厚くしすぎない方が土地に合います。電車の時刻表が、いまもいちばん実用的な案内板です。",
      },
    ],
    sightseeingNotes: [
      {
        title: "ホームのすぐそば",
        body:
          "二ノ瀬川です。ホームを出ると渓流と木立がすぐ目の前にあります。短い滞在なら、ここで水音を聞いて戻っても十分です。",
      },
      {
        title: "北へ徒歩30〜40分",
        body:
          "貴船神社です。川沿いと石段を北へ進みます。本宮までの道が長く、時間があるときの行き先になります。",
      },
      {
        title: "食べる・休むの目安",
        body:
          "駅前に定番の食堂はほとんどありません。食べる・休むは貴船側の川床や茶店、または電車で一駅動いてから探す方が現実的です。",
      },
    ],
  },
  ...EIZAN_LAND_DEPTH,
  ...KEIHAN_LAND_DEPTH,
  ...RANDEN_LAND_DEPTH,
  ...HANKYU_LAND_DEPTH,
  ...SAGANO_LAND_DEPTH,
  ...KARASUMA_LAND_DEPTH,
};

/** AI 生成の id が揺んでも、駅名で厚みノートを当てる。 */
const AREA_DEPTH_BY_NAME: Record<string, string> = {
  出町柳: "demachiyanagi",
  中書島: "chushojima",
  二ノ瀬: "ninose",
  ...EIZAN_LAND_DEPTH_BY_NAME,
  ...KEIHAN_LAND_DEPTH_BY_NAME,
  ...RANDEN_LAND_DEPTH_BY_NAME,
  ...HANKYU_LAND_DEPTH_BY_NAME,
  ...SAGANO_LAND_DEPTH_BY_NAME,
  ...KARASUMA_LAND_DEPTH_BY_NAME,
};

function areaDepthFor(station: StationSeed): AreaDepth | undefined {
  const byId = AREA_DEPTH[station.id];
  if (byId) return byId;
  return lookupAreaDepthByName(station.name);
}

/** 駅名だけで収録土地文を引く（生成前の分岐用）。 */
export function lookupAreaDepthByName(rawName: string): AreaDepth | undefined {
  const bare = rawName.replace(/駅$/u, "").trim();
  if (!bare) return undefined;
  const mapped = AREA_DEPTH_BY_NAME[bare];
  if (mapped) return AREA_DEPTH[mapped];
  // AI の駅名揺れ（「京阪出町柳」等）。駅名がキーを含むときだけ（逆方向は出町誤爆の温床）
  for (const [key, id] of Object.entries(AREA_DEPTH_BY_NAME)) {
    if (key.length >= 2 && bare.includes(key)) {
      return AREA_DEPTH[id];
    }
  }
  return undefined;
}

/**
 * 土地文ストックとして「もう十分」か。
 * 生成時は spots 寄りにし、穴埋め Search を土地理由で打たない。
 */
export function isRichLandDepth(depth: AreaDepth | undefined): boolean {
  if (!depth) return false;
  const intro = (depth.stationIntro ?? "").trim().length;
  const walk = (depth.walkGuide ?? "").trim().length;
  const hist = depth.historyNotes?.length ?? 0;
  return intro >= 80 && walk >= 60 && hist >= 2;
}

/**
 * 土地文ストック駅の spots バッチ正本名（docs/land-stock 見出しと一致）。
 * 別名キーは BY_NAME にあるが、キャッシュ鍵はここで一本化する。
 */
export const LAND_STOCK_SPOT_BATCH: ReadonlyArray<{
  line: "eizan" | "keihan" | "randen" | "hankyu" | "sagano" | "karasuma";
  name: string;
}> = [
  // 叡山 14
  { line: "eizan", name: "元田中" },
  { line: "eizan", name: "茶山・京都芸術大学" },
  { line: "eizan", name: "一乗寺" },
  { line: "eizan", name: "修学院" },
  { line: "eizan", name: "宝ヶ池" },
  { line: "eizan", name: "三宅八幡" },
  { line: "eizan", name: "八瀬比叡山口" },
  { line: "eizan", name: "八幡前" },
  { line: "eizan", name: "岩倉" },
  { line: "eizan", name: "木野" },
  { line: "eizan", name: "京都精華大前" },
  { line: "eizan", name: "市原" },
  { line: "eizan", name: "貴船口" },
  { line: "eizan", name: "鞍馬" },
  // 京阪 21
  { line: "keihan", name: "神宮丸太町" },
  { line: "keihan", name: "三条" },
  { line: "keihan", name: "祇園四条" },
  { line: "keihan", name: "清水五条" },
  { line: "keihan", name: "七条" },
  { line: "keihan", name: "鳥羽街道" },
  { line: "keihan", name: "伏見稲荷" },
  { line: "keihan", name: "深草" },
  { line: "keihan", name: "藤森" },
  { line: "keihan", name: "墨染" },
  { line: "keihan", name: "丹波橋" },
  { line: "keihan", name: "伏見桃山" },
  { line: "keihan", name: "淀" },
  { line: "keihan", name: "石清水八幡宮" },
  { line: "keihan", name: "観月橋" },
  { line: "keihan", name: "桃山南口" },
  { line: "keihan", name: "六地蔵" },
  { line: "keihan", name: "木幡" },
  { line: "keihan", name: "黄檗" },
  { line: "keihan", name: "三室戸" },
  { line: "keihan", name: "宇治" },
  // 嵐電 15
  { line: "randen", name: "四条大宮" },
  { line: "randen", name: "西大路三条" },
  { line: "randen", name: "山ノ内" },
  { line: "randen", name: "嵐電天神川" },
  { line: "randen", name: "蚕ノ社" },
  { line: "randen", name: "帷子ノ辻" },
  { line: "randen", name: "撮影所前" },
  { line: "randen", name: "鹿王院" },
  { line: "randen", name: "嵐電嵯峨" },
  { line: "randen", name: "嵐山" },
  { line: "randen", name: "御室仁和寺" },
  { line: "randen", name: "妙心寺" },
  { line: "randen", name: "龍安寺" },
  { line: "randen", name: "等持院・立命館大学衣笠キャンパス前" },
  { line: "randen", name: "北野白梅町" },
  // 阪急 12（嵐山は阪急表記で嵐電と鍵を分ける）
  { line: "hankyu", name: "京都河原町" },
  { line: "hankyu", name: "烏丸" },
  { line: "hankyu", name: "大宮" },
  { line: "hankyu", name: "西院" },
  { line: "hankyu", name: "西京極" },
  { line: "hankyu", name: "桂" },
  { line: "hankyu", name: "東向日" },
  { line: "hankyu", name: "洛西口" },
  { line: "hankyu", name: "長岡天神" },
  { line: "hankyu", name: "上桂" },
  { line: "hankyu", name: "松尾大社" },
  { line: "hankyu", name: "嵐山（阪急）" },
  // JR嵯峨野 5
  { line: "sagano", name: "二条" },
  { line: "sagano", name: "円町" },
  { line: "sagano", name: "花園" },
  { line: "sagano", name: "太秦" },
  { line: "sagano", name: "嵯峨嵐山" },
  // 地下鉄烏丸・洛内 7
  { line: "karasuma", name: "鞍馬口" },
  { line: "karasuma", name: "今出川" },
  { line: "karasuma", name: "丸太町" },
  { line: "karasuma", name: "烏丸御池" },
  { line: "karasuma", name: "四条" },
  { line: "karasuma", name: "五条" },
  { line: "karasuma", name: "京都" },
];

export function listLandStockSpotBatchTargets(opts?: {
  line?: (typeof LAND_STOCK_SPOT_BATCH)[number]["line"];
}): typeof LAND_STOCK_SPOT_BATCH {
  const line = opts?.line;
  return line
    ? LAND_STOCK_SPOT_BATCH.filter((t) => t.line === line)
    : LAND_STOCK_SPOT_BATCH;
}

/** 収録土地文から、spots 生成用の殻を作る。 */
export function stationShellFromLandDepth(
  rawName: string,
  depth: AreaDepth,
): StationSeed {
  const name = rawName.replace(/駅$/u, "").trim() || rawName.trim();
  const mappedId = AREA_DEPTH_BY_NAME[name];
  const id =
    mappedId ??
    `ai-${name}`
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48);
  return {
    id: id || "station",
    name,
    line: "路線情報は要確認",
    prefecture: "日本",
    region: "近畿",
    mood: "story",
    radiiKm: [0.9, 1.0, 1.2],
    stationIntro: depth.stationIntro,
    areaAbout: undefined,
    walkGuide: depth.walkGuide,
    historyNotes: depth.historyNotes,
    sightseeingNotes: depth.sightseeingNotes,
    storyNotes: depth.storyNotes,
    tourTitle: `${name}の徒歩圏を、ゆるく歩く`,
    catchCopy: "降りた場所から、予定のない寄り道を。",
    spots: [],
    lat: 35.0,
    lng: 135.0,
    source: "ai",
  };
}

/**
 * 収録ノートがある駅は、土地文を正本の厚みで上書きする。
 * （歴史だけでなく、いまの姿・大学など編集済みの文を優先）
 * 観光案内は ensureLandPresentAnchors 側で mustVisit 雛形に揃える。
 */
/** 出町柳: 枡形へ先に行ってからデルタ、の旧順を正す。 */
export function isWrongDemachiWalkOrder(text: string): boolean {
  if (!text.includes("枡形") || !text.includes("デルタ")) return false;
  // 「枡形へ。その足でデルタ」型
  if (/枡形商店街へ[。．]?\s*その足で.*デルタ/.test(text)) return true;
  // デルタを通る／先に見る、が無く、枡形がデルタより先に出る
  if (!/デルタを通|デルタの合流を通|デルタで.*枡形|デルタ.*枡形/.test(text)) {
    const iMasu = text.search(/枡形/);
    const iDelta = text.search(/デルタ/);
    if (iMasu >= 0 && iDelta >= 0 && iMasu < iDelta) return true;
  }
  return false;
}

const DEMACHI_FOOD_AT_DELTA =
  "食べ物は駅前で買って、鴨川デルタで食べるのがおすすめです。";

/** 「駅前で済ませて川端へ」など旧い食べ方を、駅前で買ってデルタで食べる、に直す。 */
export function scrubDemachiWalkFood(text: string): string {
  let next = text;
  if (/駅前で済ませて/.test(next) || /川端へ持って/.test(next)) {
    next = next.replace(
      /食べるものは駅前で済ませて[^。]*。|食べ物は駅前で済ませて[^。]*。/g,
      DEMACHI_FOOD_AT_DELTA,
    );
    next = next.replace(/川端へ持っていくと[^。]*。/g, "");
  }
  // 出町の歩き方に「駅前で買ってデルタで食べる」が無いときは定番を足す
  if (!/デルタで食べ|デルタへ持|袋のまま|駅前で買って/.test(next)) {
    next = `${next.trim()}${DEMACHI_FOOD_AT_DELTA}`;
  }
  return next.replace(/\s{2,}/g, " ").trim();
}

export function withAreaDepth(station: StationSeed): StationSeed {
  const extra = areaDepthFor(station);
  const merged = extra
    ? {
        ...station,
        stationIntro: extra.stationIntro ?? station.stationIntro,
        areaAbout:
          (extra.historyNotes?.length ?? 0) >= 2
            ? undefined
            : (extra.areaAbout ?? station.areaAbout),
        // 土地文ストックがある駅は walkGuide 正本。無い駅だけ AI。食べ方はデルタ定番へ
        walkGuide: (() => {
          const ai = (station.walkGuide ?? "").trim();
          const canon = (extra.walkGuide ?? "").trim();
          const pick = isRichLandDepth(extra)
            ? (extra.walkGuide ?? station.walkGuide)
            : ai && !isWrongDemachiWalkOrder(ai)
              ? ai
              : (extra.walkGuide ?? station.walkGuide);
          if (!pick) return pick;
          const bare = station.name.replace(/駅$/u, "");
          const isDemachi =
            bare.includes("出町柳") || station.name.includes("出町柳");
          return isDemachi ? scrubDemachiWalkFood(pick) : pick;
        })(),
        historyNotes: extra.historyNotes ?? station.historyNotes,
        // 寄るところ: 土地文ストック／出町は正本。他は AI、空なら正本
        sightseeingNotes: (() => {
          const depthSight = extra.sightseeingNotes;
          const ai = station.sightseeingNotes ?? [];
          const bare = station.name.replace(/駅$/u, "");
          const preferDepth =
            bare.includes("出町柳") ||
            station.name.includes("出町柳") ||
            isRichLandDepth(extra);
          if (preferDepth && depthSight?.length) return depthSight;
          if (ai.length > 0) return ai;
          return depthSight ?? ai;
        })(),
        storyNotes:
          extra.storyNotes && extra.storyNotes.length > 0
            ? extra.storyNotes
            : station.storyNotes,
      }
    : station;
  // 物語のゆかりは駅横断の正本（作品名付き）を最後に載せる
  return withStoryNotes(refineLandProse(ensureLandPresentAnchors(merged)));
}

export function paragraphsFrom(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
