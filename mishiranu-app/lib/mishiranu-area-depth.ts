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
import {
  KARASUMA_EXTENDS_LAND_DEPTH,
  KARASUMA_EXTENDS_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-karasuma-extends-land-depth";
import {
  TOZAI_LAND_DEPTH,
  TOZAI_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-tozai-land-depth";
import {
  KINTETSU_KYOTO_LAND_DEPTH,
  KINTETSU_KYOTO_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-kintetsu-kyoto-land-depth";
import {
  JR_NARA_LAND_DEPTH,
  JR_NARA_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-jr-nara-land-depth";
import {
  JR_KYOTO_LAND_DEPTH,
  JR_KYOTO_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-jr-kyoto-land-depth";
import {
  KINTETSU_KASHIHARA_LAND_DEPTH,
  KINTETSU_KASHIHARA_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-kintetsu-kashihara-land-depth";
import {
  KEIHANNA_LAND_DEPTH,
  KEIHANNA_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-keihanna-land-depth";
import {
  KEIHAN_OSAKA_LAND_DEPTH,
  KEIHAN_OSAKA_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-keihan-osaka-land-depth";
import {
  KEIHAN_NAKANOSHIMA_LAND_DEPTH,
  KEIHAN_NAKANOSHIMA_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-keihan-nakanoshima-land-depth";
import {
  KEIHAN_KATANO_LAND_DEPTH,
  KEIHAN_KATANO_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-keihan-katano-land-depth";
import {
  SANYO_LAND_DEPTH,
  SANYO_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-sanyo-land-depth";
import {
  KOBE_SUBWAY_LAND_DEPTH,
  KOBE_SUBWAY_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-kobe-subway-land-depth";
import {
  JR_FUKUCHIYAMA_LAND_DEPTH,
  JR_FUKUCHIYAMA_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-jr-fukuchiyama-land-depth";
import {
  SENBOKU_LAND_DEPTH,
  SENBOKU_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-senboku-land-depth";
import {
  KITAKYU_LAND_DEPTH,
  KITAKYU_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-kitakyu-land-depth";
import {
  OSAKA_MONORAIL_LAND_DEPTH,
  OSAKA_MONORAIL_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-osaka-monorail-land-depth";
import {
  KINTETSU_NARA_LAND_DEPTH,
  KINTETSU_NARA_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-kintetsu-nara-land-depth";
import {
  KINTETSU_NARA_OSAKA_LAND_DEPTH,
  KINTETSU_NARA_OSAKA_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-kintetsu-nara-osaka-land-depth";
import {
  JR_GAKKEN_LAND_DEPTH,
  JR_GAKKEN_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-jr-gakken-land-depth";
import {
  KINTETSU_OSAKA_LAND_DEPTH,
  KINTETSU_OSAKA_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-kintetsu-osaka-land-depth";
import {
  KINTETSU_OSAKA_EAST_LAND_DEPTH,
  KINTETSU_OSAKA_EAST_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-kintetsu-osaka-east-land-depth";
import {
  KINTETSU_MINAMI_OSAKA_LAND_DEPTH,
  KINTETSU_MINAMI_OSAKA_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-kintetsu-minami-osaka-land-depth";
import {
  HANSHIN_MUKOGAWA_LAND_DEPTH,
  HANSHIN_MUKOGAWA_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-hanshin-mukogawa-land-depth";
import {
  JR_KAKOGAWA_LAND_DEPTH,
  JR_KAKOGAWA_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-jr-kakogawa-land-depth";
import {
  HOJO_LAND_DEPTH,
  HOJO_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-hojo-land-depth";
import {
  SHINTETSU_AO_LAND_DEPTH,
  SHINTETSU_AO_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-shintetsu-ao-land-depth";
import {
  SHINTETSU_KOEN_TOSHI_LAND_DEPTH,
  SHINTETSU_KOEN_TOSHI_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-shintetsu-koen-toshi-land-depth";
import {
  SHINTETSU_SANDA_LAND_DEPTH,
  SHINTETSU_SANDA_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-shintetsu-sanda-land-depth";
import {
  SHINTETSU_ARIMA_LAND_DEPTH,
  SHINTETSU_ARIMA_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-shintetsu-arima-land-depth";
import {
  NOSE_LAND_DEPTH,
  NOSE_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-nose-land-depth";
import {
  HANSHIN_LAND_DEPTH,
  HANSHIN_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-hanshin-land-depth";
import {
  HANSHIN_NAMBA_LAND_DEPTH,
  HANSHIN_NAMBA_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-hanshin-namba-land-depth";
import {
  HANKYU_KOBE_LAND_DEPTH,
  HANKYU_KOBE_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-hankyu-kobe-land-depth";
import {
  HANKYU_TAKARAZUKA_LAND_DEPTH,
  HANKYU_TAKARAZUKA_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-hankyu-takarazuka-land-depth";
import {
  HANKYU_KYOTO_OSAKA_LAND_DEPTH,
  HANKYU_KYOTO_OSAKA_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-hankyu-kyoto-osaka-land-depth";
import {
  HANKYU_IMAZU_LAND_DEPTH,
  HANKYU_IMAZU_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-hankyu-imazu-land-depth";
import {
  HANKYU_SENRI_LAND_DEPTH,
  HANKYU_SENRI_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-hankyu-senri-land-depth";
import {
  JR_TOZAI_LAND_DEPTH,
  JR_TOZAI_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-jr-tozai-land-depth";
import {
  JR_LOOP_LAND_DEPTH,
  JR_LOOP_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-jr-loop-land-depth";
import {
  JR_KOBE_LAND_DEPTH,
  JR_KOBE_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-jr-kobe-land-depth";
import {
  JR_TAKARAZUKA_LAND_DEPTH,
  JR_TAKARAZUKA_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-jr-takarazuka-land-depth";
import {
  JR_HANWA_LAND_DEPTH,
  JR_HANWA_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-jr-hanwa-land-depth";
import {
  JR_YAMATO_LAND_DEPTH,
  JR_YAMATO_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-jr-yamato-land-depth";
import {
  MIDOSUJI_LAND_DEPTH,
  MIDOSUJI_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-midosuji-land-depth";
import {
  TANIMACHI_LAND_DEPTH,
  TANIMACHI_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-tanimachi-land-depth";
import {
  YOTSUBASHI_LAND_DEPTH,
  YOTSUBASHI_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-yotsubashi-land-depth";
import {
  CHUO_LAND_DEPTH,
  CHUO_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-chuo-land-depth";
import {
  SAKAISUJI_LAND_DEPTH,
  SAKAISUJI_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-sakaisuji-land-depth";
import {
  SENNICHIMAE_LAND_DEPTH,
  SENNICHIMAE_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-sennichimae-land-depth";
import {
  NAGAHORI_LAND_DEPTH,
  NAGAHORI_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-nagahori-land-depth";
import {
  NANKAI_KOYA_LAND_DEPTH,
  NANKAI_KOYA_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-nankai-koya-land-depth";
import {
  NANKAI_MAIN_LAND_DEPTH,
  NANKAI_MAIN_LAND_DEPTH_BY_NAME,
} from "@/lib/mishiranu-nankai-main-land-depth";
import { ensureLandPresentAnchors } from "@/lib/mishiranu-land-anchors";
import { applyLandNowNotes } from "@/lib/mishiranu-land-now-notes";
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
    stationIntro:
      "1925年に京都電燈（現在の叡山電鉄叡山本線）の起点駅として地上に開業し、1989年に地下の京阪電気鉄道鴨東線が乗り入れて結節点となった、京都市左京区に位置する駅です。高野川と賀茂川が合流して鴨川となる「鴨川デルタ」の東岸に位置し、地上の頭端式3面4線の叡山電鉄ホームと、川端通の地下を走る島式1面2線の京阪鴨東線ホームが上下に連絡しています。高野川に架かる河合橋と賀茂川に架かる出町橋を渡れば旧若狭街道の市場町であった出町枡形へ通じ、東へ今出川通を進めば百万遍の学生街へと緩やかに標高が上がっていきます。洛北の山間部へ向かう地上電車と都心へ潜る地下電車が、二つの川が交わる水辺で接続する構造が特徴です。",
    areaAbout: undefined,
    walkGuide:
      "地上の叡山電鉄改札口（または地下の京阪叡電口）から川端通へ出て、高野川に架かる河合橋を西へ渡り、下鴨神社の参道入口の前を通って賀茂川に架かる出町橋を渡ります。出町通（旧若狭街道）から出町枡形の通りを抜けて寺町通へ出たあと、南へ折れて今出川通を東へ進みます。賀茂大橋の上から合流直後の鴨川と鴨川デルタの飛び石を見下ろしつつ東岸へ渡り、川端通の交差点をさらに東へ直進して、百万遍交差点の手前・柳月町付近の路地を北へ折れます。住宅街を抜けて高野川東岸の川端通へ戻り、水辺の並木道を北へ歩いて叡山電鉄の駅前広場と改札口へ戻る一周ルートです。",
    historyNotes: [
      {
        title: "地上頭端式の叡電と地下を潜る京阪鴨東線の二層結節",
        body:
          "1925年に洛北・比叡山方面へ向かう叡山電鉄のターミナルとして高野川東岸の地上に開業したのち、長らく三条駅が終点だった京阪電車が1989年に川端通の地下を延伸して接続しました。そのため現在も、地上の櫛形ホームに並ぶ叡山電鉄の車両と、エスカレーターで地下深くへ降りる京阪鴨東線のコンコースが、時代と構造の異なる二つの駅として上下に重なっています。",
      },
      {
        title: "鴨川デルタと出町枡形を結ぶ二つの橋",
        body:
          "駅のすぐ西側では北西からの賀茂川と北東からの高野川がY字型に合流し、三角州の先端に飛び石が並ぶ鴨川デルタを形づくっています。高野川を渡る河合橋と賀茂川を渡る出町橋の二橋を連続して渡った西岸には、かつて若狭街道（鯖街道）の終着点として物資が集まった「出町枡形」のクランク状の街区が今も残っています。",
      },
      {
        title: "高野川の河岸から百万遍へ登る扇状地の微高地",
        body:
          "駅がある川端通沿いは高野川の河岸段丘の低地にあたりますが、今出川通を東の百万遍交差点（東大路通）へ向かうにつれて、白川が形成した扇状地の緩やかな上り坂となります。駅前から百万遍方面にかけての街区では、水辺の開けた河原の風景から寺院の築地塀や大学の構内が連なる微高地へと少しずつ地形がせり上がっていく様子が確かめられます。",
      }
    ],
    sightseeingNotes: [
      {
        title: "賀茂御祖神社（下鴨神社）",
        body:
          "賀茂御祖神社（下鴨神社）です。改札から河合橋を渡り北西へ徒歩約8分。着いたら高野川と賀茂川に挟まれた糺の森の広い参道と、朱塗りの楼門および社殿群が見えます。",
      },
      {
        title: "鴨川公園（鴨川デルタ）",
        body:
          "鴨川公園（鴨川デルタ）です。改札から川端通を西へ渡り徒歩約2分。着いたら賀茂川と高野川が合流する三角州の水際と、両岸を結んで水面に置かれた亀形や千鳥形の飛び石が見えます。",
      },
      {
        title: "知恩寺",
        body:
          "知恩寺です。改札から今出川通を東へ徒歩約10分。着いたら百万遍交差点の北東角に面した総門と、境内中央に建つ木造の御影堂の大屋根が見えます。",
      }
    ],
  },
  chushojima: {
    stationIntro:
      "1910年に京阪電気鉄道京阪本線の開業と同時に設置され、1913年に宇治線が乗り入れて分岐駅となった、京都市伏見区葭島矢倉町に位置する地上駅です。大きくカーブする島式・相対式複合の3面4線ホームを持ち、京阪本線の列車と宇治線の折り返し列車が同じ平面で行き交う構造になっています。駅のすぐ北側を濠川と宇治川派流が流れ、南側にはかつての伏見港の船溜まり跡である伏見港公園と宇治川本流の堤防が控えています。北東へ広がる酒蔵街区や御香宮神社のある桃山丘陵へ向かう手前の水陸結節点として、運河と橋に囲まれた低地の風景が広がっています。",
    areaAbout: undefined,
    walkGuide:
      "北改札口を出て駅前通りを北へ進み、宇治川派流に架かる弁天橋を渡って長建寺の門前を通ります。そこから酒蔵街区の南縁にあたる宇治川派流沿いの遊歩道を西へ歩き、濠川と宇治川派流が合流する地点に架かる伏見であい橋を渡ります。濠川の西岸に沿って南へ下り、京阪本線の踏切と伏見みなと橋を渡って伏見港公園の広場へ入ります。公園の南端にある三栖閘門のゲートを見上げたあと、濠川東岸の遊歩道を北へたどって南改札口へ戻る一周ルートです。",
    historyNotes: [
      {
        title: "宇治川派流の曲線に沿う3面4線の分岐構造",
        body:
          "1910年の京阪本線開業に続き、1913年に宇治線が分岐する際、既存の河川や水路を避けるように線路が敷かれたため、ホーム全体が大きく弓なりに湾曲しています。現在も北改札口（1番線側）と地下道で結ばれた南改札口（4番線側）の間に4本の線路が並び、本線と宇治線の車両が平面上で接続する結節駅の姿を見せています。",
      },
      {
        title: "脇坂安治の屋敷跡に由来する「中書島」の地名",
        body:
          "駅名の「中書島」は、安土桃山時代に豊臣秀吉が伏見城の築城と河川改修を行った際、宇治川と濠川などの水路に囲まれた島状の土地に、中務少輔（唐名で中書）の官位を持つ大名・脇坂安治が屋敷を構えたことに由来します。現在も駅の周囲は濠川・宇治川派流・宇治川本流に囲まれており、橋を渡らなければ北側の市街地へ出られない水郷の地形が残っています。",
      },
      {
        title: "伏見港の舟運から鉄道へ引き継がれた水陸の玄関口",
        body:
          "駅南側の濠川下流から三栖閘門にかけての一帯は、江戸時代から明治にかけて京都と大坂を結ぶ三十石船や蒸気船が発着した「伏見港」の中心地でした。東側の桃山丘陵に鎮座する御香宮神社の門前町や湧水を使った酒蔵街区に対し、その南西端の手前にあたる中書島は港湾として発達し、近代以降は舟運に代わって鉄道が分岐する玄関口となりました。",
      }
    ],
    sightseeingNotes: [
      {
        title: "長建寺",
        body:
          "長建寺です。北改札口から北へ進み弁天橋を渡って徒歩約4分。着いたら宇治川派流のほとりに建つ竜宮門形式の朱塗りの山門と、境内の鐘楼や閼伽水が見えます。",
      },
      {
        title: "伏見港公園",
        body:
          "伏見港公園です。南改札口から西へ徒歩約2分。着いたら旧伏見港の船溜まり跡を整備した芝生広場と、濠川に面した水辺の散策路が見えます。",
      },
      {
        title: "三栖閘門（三栖閘門資料館）",
        body:
          "三栖閘門（三栖閘門資料館）です。南改札口から濠川沿いを南西へ徒歩約10分。着いたら濠川と宇治川の合流点にそびえる1929年竣工のコンクリートの閘門塔と、復元された水位調節ゲートが見えます。",
      }
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
      "1929年に鞍馬電気鉄道（現在の叡山電鉄鞍馬線）が市原から延伸された際に開業した、京都市左京区鞍馬二ノ瀬町に位置する無人駅です。市原駅から50パーミルの急勾配とカエデの木立が覆う「もみじのトンネル」を登りきった山腹の斜面に、相対式2面2線のホームと構内踏切が設けられています。駅のすぐ眼下には二ノ瀬川（鞍馬川）が刻んだ深い渓谷と旧鞍馬街道の集落が細長く横たわり、ホームからは谷底の屋根並みと対岸の杉林を見下ろすことができます。貴船や鞍馬の観光拠点の手前に位置する谷の中間停留所として、単線区間の列車交換の合間には川のせせらぎと山風が静かなホームを吹き抜けます。",
    areaAbout: undefined,
    walkGuide:
      "ホーム南端の構内踏切を渡り、出口から山の斜面を下る急な石段と坂道を降りて、谷底を通る旧鞍馬街道（府道38号京都広河原美山線の旧道）へ出ます。二ノ瀬川（鞍馬川）の流れを右手に見ながら旧街道の細道を北へ歩き、山際に建つ守谷神社・富士神社の石段前を通って集落の北側へ進みます。二ノ瀬バイパスの高架下付近で川に架かる橋を対岸へ渡り、川沿いの小道を南へ折り返して水音を聞きながら下ります。再び駅下の小さな橋を渡って旧鞍馬街道へ合流し、斜面を登る階段を上がって二ノ瀬駅のホームへ戻る一周ルートです。",
    historyNotes: [
      {
        title: "急勾配の終わりに設けられた斜面上の交換可能無人駅",
        body:
          "市原駅から二ノ瀬駅にかけての区間は、平坦な盆地から一気に山岳区間へ入る50パーミルの急勾配となっており、その登り坂の途中に列車が行き違いを行う2面2線の地上駅として造られました。山肌を切り開いた狭い敷地に木造の上屋と構内踏切だけが並ぶ無人駅の構造に、昭和初期の山岳鉄道建設の姿がそのまま残っています。",
      },
      {
        title: "二ノ瀬川の渓谷と旧鞍馬街道の細長い谷集落",
        body:
          "駅の眼下を流れる二ノ瀬川（鞍馬川）の両岸は急峻な山が迫るV字谷となっており、わずかな平地に旧鞍馬街道と山間の民家が細長く並んでいます。山を貫く二ノ瀬トンネル（二ノ瀬バイパス）が開通して通過車両がトンネルへ移ったことで、谷底の旧道には往時の静かな山村の道幅と川沿いの石積みが保たれています。",
      },
      {
        title: "惟喬親王の伝承を伝える守谷神社と山の信仰",
        body:
          "二ノ瀬の谷は平安時代に惟喬親王が隠棲した地と伝わり、駅北側の線路脇には親王と母君を祀る守谷神社・富士神社が二社並んで鎮座しています。境内すぐ後ろの斜面を鞍馬線の線路が通過しており、山間の小さな集落の信仰の場と近代の鉄路が重なり合う独特の景観をつくっています。",
      }
    ],
    sightseeingNotes: [
      {
        title: "守谷神社・富士神社",
        body:
          "守谷神社・富士神社です。出口から階段を下り旧鞍馬街道を北へ徒歩約8分。着いたら叡山電鉄の線路のすぐ脇の斜面に並ぶ二つの社殿と、杉木立に囲まれた石段が見えます。",
      },
      {
        title: "白龍園",
        body:
          "白龍園です。出口から階段を下り旧鞍馬街道を南へ徒歩約7分。着いたら二ノ瀬川（鞍馬川）沿いの山裾に整えられた生垣と、安養寺山の斜面を活かした庭園の門構えおよび苔庭の木立が見えます。",
      }
    ],
  },
  ...EIZAN_LAND_DEPTH,
  ...KEIHAN_LAND_DEPTH,
  ...RANDEN_LAND_DEPTH,
  ...HANKYU_LAND_DEPTH,
  ...SAGANO_LAND_DEPTH,
  ...KARASUMA_LAND_DEPTH,
  ...KARASUMA_EXTENDS_LAND_DEPTH,
  ...TOZAI_LAND_DEPTH,
  ...KINTETSU_KYOTO_LAND_DEPTH,
  ...JR_NARA_LAND_DEPTH,
  ...JR_KYOTO_LAND_DEPTH,
  ...KINTETSU_KASHIHARA_LAND_DEPTH,
  ...KEIHANNA_LAND_DEPTH,
  ...KEIHAN_OSAKA_LAND_DEPTH,
  ...KEIHAN_NAKANOSHIMA_LAND_DEPTH,
  ...KEIHAN_KATANO_LAND_DEPTH,
  ...SANYO_LAND_DEPTH,
  ...KOBE_SUBWAY_LAND_DEPTH,
  ...JR_FUKUCHIYAMA_LAND_DEPTH,
  ...SENBOKU_LAND_DEPTH,
  ...KITAKYU_LAND_DEPTH,
  ...OSAKA_MONORAIL_LAND_DEPTH,
  ...KINTETSU_NARA_LAND_DEPTH,
  ...KINTETSU_NARA_OSAKA_LAND_DEPTH,
  ...JR_GAKKEN_LAND_DEPTH,
  ...KINTETSU_OSAKA_LAND_DEPTH,
  ...KINTETSU_OSAKA_EAST_LAND_DEPTH,
  ...KINTETSU_MINAMI_OSAKA_LAND_DEPTH,
  ...HANSHIN_LAND_DEPTH,
  ...HANSHIN_MUKOGAWA_LAND_DEPTH,
  ...JR_KAKOGAWA_LAND_DEPTH,
  ...HOJO_LAND_DEPTH,
  ...SHINTETSU_AO_LAND_DEPTH,
  ...SHINTETSU_KOEN_TOSHI_LAND_DEPTH,
  ...SHINTETSU_SANDA_LAND_DEPTH,
  ...SHINTETSU_ARIMA_LAND_DEPTH,
  ...NOSE_LAND_DEPTH,
  ...HANSHIN_NAMBA_LAND_DEPTH,
  ...HANKYU_KOBE_LAND_DEPTH,
  ...HANKYU_TAKARAZUKA_LAND_DEPTH,
  ...HANKYU_KYOTO_OSAKA_LAND_DEPTH,
  ...HANKYU_IMAZU_LAND_DEPTH,
  ...HANKYU_SENRI_LAND_DEPTH,
  ...JR_TOZAI_LAND_DEPTH,
  ...JR_LOOP_LAND_DEPTH,
  ...JR_KOBE_LAND_DEPTH,
  ...JR_TAKARAZUKA_LAND_DEPTH,
  ...JR_HANWA_LAND_DEPTH,
  ...JR_YAMATO_LAND_DEPTH,
  ...MIDOSUJI_LAND_DEPTH,
  ...TANIMACHI_LAND_DEPTH,
  ...YOTSUBASHI_LAND_DEPTH,
  ...CHUO_LAND_DEPTH,
  ...SAKAISUJI_LAND_DEPTH,
  ...SENNICHIMAE_LAND_DEPTH,
  ...NAGAHORI_LAND_DEPTH,
  ...NANKAI_KOYA_LAND_DEPTH,
  ...NANKAI_MAIN_LAND_DEPTH,
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
  ...KARASUMA_EXTENDS_LAND_DEPTH_BY_NAME,
  ...TOZAI_LAND_DEPTH_BY_NAME,
  ...KINTETSU_KYOTO_LAND_DEPTH_BY_NAME,
  ...JR_NARA_LAND_DEPTH_BY_NAME,
  ...JR_KYOTO_LAND_DEPTH_BY_NAME,
  ...KINTETSU_KASHIHARA_LAND_DEPTH_BY_NAME,
  ...KEIHANNA_LAND_DEPTH_BY_NAME,
  ...KEIHAN_OSAKA_LAND_DEPTH_BY_NAME,
  ...KEIHAN_NAKANOSHIMA_LAND_DEPTH_BY_NAME,
  ...KEIHAN_KATANO_LAND_DEPTH_BY_NAME,
  ...SANYO_LAND_DEPTH_BY_NAME,
  ...KOBE_SUBWAY_LAND_DEPTH_BY_NAME,
  ...JR_FUKUCHIYAMA_LAND_DEPTH_BY_NAME,
  ...SENBOKU_LAND_DEPTH_BY_NAME,
  ...KITAKYU_LAND_DEPTH_BY_NAME,
  ...OSAKA_MONORAIL_LAND_DEPTH_BY_NAME,
  ...KINTETSU_NARA_LAND_DEPTH_BY_NAME,
  ...KINTETSU_NARA_OSAKA_LAND_DEPTH_BY_NAME,
  ...JR_GAKKEN_LAND_DEPTH_BY_NAME,
  ...KINTETSU_OSAKA_LAND_DEPTH_BY_NAME,
  ...KINTETSU_OSAKA_EAST_LAND_DEPTH_BY_NAME,
  ...KINTETSU_MINAMI_OSAKA_LAND_DEPTH_BY_NAME,
  ...HANSHIN_LAND_DEPTH_BY_NAME,
  ...HANSHIN_MUKOGAWA_LAND_DEPTH_BY_NAME,
  ...JR_KAKOGAWA_LAND_DEPTH_BY_NAME,
  ...HOJO_LAND_DEPTH_BY_NAME,
  ...SHINTETSU_AO_LAND_DEPTH_BY_NAME,
  ...SHINTETSU_KOEN_TOSHI_LAND_DEPTH_BY_NAME,
  ...SHINTETSU_SANDA_LAND_DEPTH_BY_NAME,
  ...SHINTETSU_ARIMA_LAND_DEPTH_BY_NAME,
  ...NOSE_LAND_DEPTH_BY_NAME,
  ...HANSHIN_NAMBA_LAND_DEPTH_BY_NAME,
  ...HANKYU_KOBE_LAND_DEPTH_BY_NAME,
  ...HANKYU_TAKARAZUKA_LAND_DEPTH_BY_NAME,
  ...HANKYU_KYOTO_OSAKA_LAND_DEPTH_BY_NAME,
  ...HANKYU_IMAZU_LAND_DEPTH_BY_NAME,
  ...HANKYU_SENRI_LAND_DEPTH_BY_NAME,
  ...JR_TOZAI_LAND_DEPTH_BY_NAME,
  ...JR_LOOP_LAND_DEPTH_BY_NAME,
  ...JR_KOBE_LAND_DEPTH_BY_NAME,
  ...JR_TAKARAZUKA_LAND_DEPTH_BY_NAME,
  ...JR_HANWA_LAND_DEPTH_BY_NAME,
  ...JR_YAMATO_LAND_DEPTH_BY_NAME,
  ...MIDOSUJI_LAND_DEPTH_BY_NAME,
  ...TANIMACHI_LAND_DEPTH_BY_NAME,
  ...YOTSUBASHI_LAND_DEPTH_BY_NAME,
  ...CHUO_LAND_DEPTH_BY_NAME,
  ...SAKAISUJI_LAND_DEPTH_BY_NAME,
  ...SENNICHIMAE_LAND_DEPTH_BY_NAME,
  ...NAGAHORI_LAND_DEPTH_BY_NAME,
  ...NANKAI_KOYA_LAND_DEPTH_BY_NAME,
  ...NANKAI_MAIN_LAND_DEPTH_BY_NAME,
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
 * Search / 生成クエリの別名（正本名はキャッシュ鍵・見出しのまま）。
 * 長い駅名・曖昧名で empty_spots になる駅用。
 */
export const LAND_STOCK_QUERY_ALIASES: Record<string, readonly string[]> = {
  "等持院・立命館大学衣笠キャンパス前": [
    "嵐電 等持院",
    "等持院",
  ],
  太秦: ["JR嵯峨野線 太秦", "JR太秦"],
  山科: ["地下鉄東西線 山科", "地下鉄 山科"],
  東山: ["地下鉄東西線 東山", "地下鉄 東山"],
  小野: ["地下鉄東西線 小野", "東西線 小野"],
  十条: ["近鉄 十条", "近鉄京都線 十条"],
  伏見: ["近鉄 伏見", "近鉄京都線 伏見"],
  竹田: ["近鉄 竹田", "近鉄京都線 竹田"],
  小倉: ["近鉄 小倉", "近鉄京都線 小倉"],
  大久保: ["近鉄 大久保", "近鉄京都線 大久保"],
  平城: ["近鉄 平城", "近鉄京都線 平城"],
  近鉄丹波橋: ["近鉄丹波橋駅", "丹波橋 近鉄"],
  近鉄宮津: ["近鉄宮津駅", "宮津車庫"],
  大和西大寺: ["近鉄 大和西大寺", "西大寺"],
  木津川台: ["近鉄 木津川台", "木津川台駅 精華", "近鉄京都線 木津川台"],
  地下鉄十条: ["地下鉄烏丸線 十条", "烏丸 十条", "十条烏丸"],
  国際会館: ["地下鉄 国際会館", "烏丸線 国際会館"],
  くいな橋: ["地下鉄 くいな橋", "くいなばし"],
  JR東福寺: ["JR奈良線 東福寺", "東福寺 JR"],
  JR稲荷: ["JR奈良線 稲荷", "稲荷駅 JR"],
  JR藤森: ["JR奈良線 藤森", "藤森 JR"],
  JR桃山: ["JR奈良線 桃山", "桃山 JR"],
  JR六地蔵: ["JR奈良線 六地蔵", "六地蔵 JR"],
  JR木幡: ["JR奈良線 木幡", "木幡 JR"],
  JR黄檗: ["JR奈良線 黄檗", "黄檗 JR"],
  JR宇治: ["JR奈良線 宇治", "宇治 JR"],
  JR小倉: ["JR奈良線 小倉", "小倉 JR奈良線"],
  JR奈良: ["JR奈良線 奈良", "奈良駅 JR"],
  新田: ["JR奈良線 新田", "新田駅 宇治"],
  城陽: ["JR奈良線 城陽", "城陽駅"],
  山城青谷: ["JR奈良線 山城青谷", "青谷 梅林"],
  山城多賀: ["JR奈良線 山城多賀", "多賀 井手"],
  平城山: ["JR奈良線 平城山", "平城山駅"],
  西大路: ["JR京都線 西大路", "西大路駅 JR"],
  桂川: ["JR京都線 桂川", "桂川駅 久世"],
  向日町: ["JR京都線 向日町", "向日町駅"],
  長岡京: ["JR京都線 長岡京", "長岡京駅"],
  JR山崎: ["JR京都線 山崎", "山崎駅 大山崎"],
  島本: ["JR京都線 島本", "島本駅"],
  JR高槻: ["JR京都線 高槻", "高槻駅 JR"],
  摂津富田: ["JR京都線 摂津富田", "摂津富田駅"],
  JR総持寺: ["JR京都線 総持寺", "JR総持寺駅"],
  JR茨木: ["JR京都線 茨木", "茨木駅 JR"],
  千里丘: ["JR京都線 千里丘", "千里丘駅"],
  岸辺: ["JR京都線 岸辺", "岸辺駅"],
  JR吹田: ["JR京都線 吹田", "吹田駅 JR"],
  東淀川: ["JR京都線 東淀川", "東淀川駅"],
  近鉄九条: ["近鉄橿原線 九条", "九条駅 奈良"],
  近鉄石見: ["近鉄橿原線 石見", "石見駅 三宅"],
  近鉄郡山: ["近鉄 郡山", "郡山駅 近鉄"],
  西ノ京: ["近鉄 西ノ京", "西ノ京駅"],
  ファミリー公園前: ["近鉄 ファミリー公園前", "まほろば健康パーク"],
  畝傍御陵前: ["近鉄 畝傍御陵前", "神武天皇陵"],
  橿原神宮前: ["近鉄 橿原神宮前", "橿原神宮前駅"],
  大和八木: ["近鉄 大和八木", "八木駅 近鉄"],
  笠縫: ["近鉄 笠縫", "笠縫駅 田原本", "秦楽寺 笠縫", "近鉄橿原線 笠縫"],
  けいはんな長田: ["近鉄けいはんな線 長田", "長田駅 東大阪", "地下鉄中央線 長田"],
  けいはんな吉田: ["近鉄けいはんな線 吉田", "吉田駅 東大阪"],
  荒本: ["近鉄 荒本", "荒本駅"],
  新石切: ["近鉄 新石切", "石切劔箭神社"],
  白庭台: ["近鉄 白庭台", "白庭台駅"],
  学研北生駒: ["近鉄 学研北生駒", "長弓寺"],
  学研奈良登美ヶ丘: ["近鉄 学研奈良登美ヶ丘", "登美ヶ丘 けいはんな"],
  京阪橋本: ["京阪 橋本", "橋本駅 八幡", "京阪本線 橋本"],
  樟葉: ["京阪 樟葉", "くずは", "楠葉台場"],
  枚方公園: ["京阪 枚方公園", "ひらかたパーク"],
  枚方市: ["京阪 枚方市", "枚方市駅"],
  御殿山: ["京阪 御殿山", "御殿山駅"],
  京阪牧野: ["京阪 牧野", "牧野駅 枚方"],
  香里園: ["京阪 香里園", "成田山 香里園"],
  寝屋川市: ["京阪 寝屋川市", "寝屋川市駅"],
  萱島: ["京阪 萱島", "萱島神社 クスノキ"],
  京阪大和田: ["京阪 大和田", "大和田駅 門真", "堤根神社"],
  古川橋: ["京阪 古川橋", "古川橋駅", "願得寺 門真"],
  門真市: ["京阪 門真市", "門真市駅", "パナソニックミュージアム"],
  西三荘: ["京阪 西三荘", "西三荘駅"],
  守口市: ["京阪 守口市", "守口宿", "文禄堤"],
  京阪土居: ["京阪 土居", "土居駅 守口", "京阪東通商店街"],
  滝井: ["京阪 滝井", "滝井駅"],
  千林: ["京阪 千林", "千林商店街"],
  森小路: ["京阪 森小路", "森小路駅"],
  関目: ["京阪 関目", "関目神社"],
  京阪野江: ["京阪 野江", "野江駅 京阪", "野江水神社"],
  京阪京橋: ["京阪 京橋", "京橋駅 京阪", "京街道起点", "寝屋川 京橋"],
  京阪天満橋: ["京阪 天満橋", "八軒家浜", "天満橋 大川"],
  京阪北浜: ["京阪 北浜", "難波橋", "適塾", "少彦名神社"],
  京阪淀屋橋: ["京阪 淀屋橋", "中之島図書館", "淀屋橋 重要文化財"],
  中之島: ["京阪中之島", "中之島西公園", "グランキューブ大阪"],
  渡辺橋: ["京阪渡辺橋", "大阪中之島美術館", "国立国際美術館"],
  大江橋: ["京阪大江橋", "水晶橋", "中之島緑道"],
  なにわ橋: ["京阪なにわ橋", "中之島公園", "東洋陶磁美術館"],
  阪神福島: ["阪神 福島", "福島天満宮", "ほたるまち"],
  阪神野田: ["阪神 野田", "野田の藤", "春日神社 野田"],
  阪神淀川: ["阪神 淀川", "海老江八坂神社", "淀川橋梁"],
  姫島: ["阪神姫島", "姫嶋神社", "大野川緑陰道路"],
  千船: ["阪神千船", "大和田住吉神社", "左門殿川"],
  杭瀬: ["阪神杭瀬", "杭瀬熊野神社", "左門殿川"],
  大物: ["阪神大物", "大物主神社", "大物公園"],
  阪神住吉: ["阪神 住吉", "住吉川", "白鶴酒造資料館", "東求女塚古墳"],
  阪神御影: ["阪神 御影", "沢の井", "綱敷天満神社", "御影公会堂"],
  石屋川: ["阪神石屋川", "処女塚古墳", "石屋川公園"],
  新在家: ["阪神新在家", "東明八幡神社", "西郷 酒蔵"],
  大石: ["阪神大石", "沢の鶴資料館", "都賀川公園"],
  西灘: ["阪神西灘", "河原霊社", "西郷川"],
  阪神岩屋: ["阪神 岩屋", "敏馬神社", "兵庫県立美術館"],
  阪神春日野道: ["阪神 春日野道", "春日野道商店街", "筒井八幡神社"],
  阪神尼崎: ["阪神 尼崎", "尼崎城", "本興寺", "尼崎車庫"],
  出屋敷: ["阪神出屋敷", "貴布禰神社", "リベル"],
  尼崎センタープール前: ["阪神尼崎センタープール前", "蓬川緑地"],
  武庫川: ["阪神武庫川", "武庫川河川敷"],
  "鳴尾・武庫川女子大前": ["鳴尾", "鳴尾八幡神社", "旧甲子園ホテル"],
  甲子園: ["阪神甲子園", "甲子園球場", "素盞嗚神社"],
  久寿川: ["阪神久寿川", "上野神社"],
  阪神今津: ["阪神 今津", "今津郷", "六角川"],
  阪神西宮: ["阪神 西宮", "西宮神社", "エビスタ西宮"],
  香櫨園: ["阪神香櫨園", "夙川公園"],
  打出: ["阪神打出", "打出天神社"],
  阪神芦屋: ["阪神 芦屋", "芦屋川"],
  深江: ["阪神深江", "深江文化村", "冨永家住宅"],
  青木: ["阪神青木", "八坂神社 青木"],
  魚崎: ["阪神魚崎", "菊正宗酒造記念館", "住吉川"],
  阪神桜川: ["阪神 桜川", "赤手拭稲荷神社", "道頓堀川"],
  千日前桜川: ["地下鉄桜川", "道頓堀川水門", "金刀比羅神社"],
  玉川: ["地下鉄玉川", "春日神社", "極楽寺", "野田城址"],
  西長堀: ["地下鉄西長堀", "大阪市立中央図書館", "土佐稲荷神社"],
  千日前なんば: ["地下鉄なんば 千日前", "法善寺", "戎橋"],
  千日前今里: ["地下鉄今里", "熊野大神宮", "妙法寺", "今里交差点"],
  新深江: ["地下鉄新深江", "深江稲荷神社", "深江郷土資料館"],
  小路: [
    "地下鉄小路",
    "千日前線 小路",
    "小路駅 生野",
    "清見原神社",
    "定専坊 生野",
  ],
  野田阪神: [
    "地下鉄野田阪神",
    "千日前線 野田阪神",
    "野田阪神駅",
    "野田恵美須神社",
    "圓満寺 野田",
  ],
  北巽: ["地下鉄北巽", "専念寺", "巽神社"],
  南巽: ["地下鉄南巽", "法性寺", "巽橋"],
  住吉東: ["南海住吉東", "南海高野線 住吉東", "住吉大社 東門", "荘厳浄土寺"],
  百舌鳥八幡: [
    "南海百舌鳥八幡",
    "南海高野線 百舌鳥八幡",
    "百舌鳥八幡宮",
    "万代寺 百舌鳥",
  ],
  北野田: [
    "南海北野田",
    "南海高野線 北野田",
    "大美野噴水ロータリー",
    "大美野田園都市",
    "菅生神社 堺",
  ],
  千早口: [
    "南海千早口",
    "南海高野線 千早口",
    "地蔵寺 河内長野",
    "松明屋 天見",
    "千早口駅",
  ],
  長堀大正: ["地下鉄大正", "大正橋", "木津川水門"],
  ドーム前千代崎: ["地下鉄ドーム前千代崎", "京セラドーム大阪", "御霊神社堀江行宮"],
  西大橋: ["地下鉄西大橋", "間長涯", "新町"],
  松屋町: ["地下鉄松屋町", "末吉橋", "榎木大明神"],
  大阪ビジネスパーク: ["OBP", "大阪城ホール", "京橋口"],
  長堀京橋: ["地下鉄京橋 長堀", "片町橋", "コムズガーデン"],
  蒲生四丁目: ["地下鉄蒲生四丁目", "若宮八幡大神宮", "城北川"],
  今福鶴見: ["地下鉄今福鶴見", "鶴見神社", "古堤街道"],
  横堤: ["地下鉄横堤", "横堤八幡宮", "鶴見緑地"],
  鶴見緑地: ["地下鉄鶴見緑地", "いのちの塔", "咲くやこの花館"],
  門真南: ["地下鉄門真南", "三島神社", "薫蓋クス"],
  ドーム前: ["阪神ドーム前", "京セラドーム大阪", "岩崎運河"],
  阪神九条: ["阪神 九条", "安治川トンネル", "ナインモール九条"],
  阪神西九条: ["阪神 西九条", "西九条神社"],
  千鳥橋: ["阪神千鳥橋", "四貫島住吉神社", "正蓮寺川公園"],
  福: ["阪神福", "福住吉神社"],
  出来島: ["阪神出来島", "出来島八坂神社"],
  伝法: ["阪神伝法", "澪標住吉神社", "鴉宮"],
  阪急中津: ["阪急 中津", "中津中央公園", "富島神社"],
  十三: ["阪急十三", "神津神社", "十三の渡し"],
  神崎川: ["阪急神崎川", "三津屋商店街"],
  園田: ["阪急園田", "藻川", "白井神社"],
  阪急塚口: ["阪急 塚口", "塚口神社", "ピッコロシアター"],
  武庫之荘: ["阪急武庫之荘", "大井戸公園", "磐長姫神社"],
  西宮北口: ["阪急西宮北口", "芸術文化センター", "高松公園"],
  夙川: ["阪急夙川", "夙川公園", "カトリック夙川教会"],
  芦屋川: ["阪急芦屋川", "滴水美術館"],
  岡本: ["阪急岡本", "岡本梅林公園", "鷺宮八幡神社"],
  阪急御影: ["阪急 御影", "深田池公園", "香雪美術館", "弓弦羽神社"],
  六甲: ["阪急六甲", "六甲八幡神社"],
  王子公園: ["阪急王子公園", "王子動物園", "神戸文学館"],
  阪急春日野道: ["阪急 春日野道", "生田川", "春日野道商店街"],
  三国: ["阪急三国", "蒲田神社", "神崎橋"],
  阪急庄内: ["阪急 庄内", "庄内神社"],
  服部天神: ["阪急服部天神", "服部天満宮", "天竺川"],
  阪急曽根: ["阪急 曽根", "東光院", "原田城跡"],
  岡町: ["阪急岡町", "原田神社", "桜塚古墳群"],
  豊中: ["阪急豊中", "豊中稲荷神社", "稲荷山公園"],
  蛍池: ["阪急蛍池", "麻田藩陣屋跡", "圓満寺"],
  石橋阪大前: ["石橋阪大前", "西国街道", "待兼山"],
  阪急池田: ["阪急 池田", "逸翁美術館", "池田城跡"],
  川西能勢口: ["阪急川西能勢口", "小戸神社", "源氏の橋"],
  雲雀丘花屋敷: ["阪急雲雀丘花屋敷", "雲雀丘"],
  阪急山本: ["阪急 山本", "最明寺滝", "あいあいパーク"],
  中山観音: ["阪急中山観音", "中山寺"],
  売布神社: ["阪急売布神社", "売布神社"],
  清荒神: ["阪急清荒神", "清荒神清澄寺"],
  阪急宝塚: ["阪急 宝塚", "宝来橋", "花のみち"],
  南方: ["阪急南方", "淀川河川公園", "日下神社"],
  崇禅寺: ["阪急崇禅寺", "水道記念館"],
  阪急淡路: ["阪急 淡路", "淡路天満宮"],
  上新庄: ["阪急上新庄", "瑞光寺"],
  相川: ["阪急相川", "新京阪橋"],
  正雀: ["阪急正雀", "正雀車庫"],
  摂津市: ["阪急摂津市", "大正川"],
  南茨木: ["阪急南茨木", "水尾公園"],
  阪急茨木市: ["阪急 茨木市", "元茨木川緑地", "茨木神社"],
  阪急総持寺: ["阪急 総持寺", "総持寺"],
  阪急高槻市: ["阪急 高槻市", "高槻城公園"],
  上牧: ["阪急上牧", "本澄寺"],
  水無瀬: ["阪急水無瀬", "水無瀬神宮"],
  大山崎: ["阪急大山崎", "離宮八幡宮"],
  西山天王山: ["阪急西山天王山", "観音寺", "恵解山古墳"],
  阪急今津: ["阪急 今津", "福應神社", "今津六角堂"],
  阪神国道: ["阪急阪神国道", "厳島神社", "津門中央公園"],
  門戸厄神: ["阪急門戸厄神", "東光寺"],
  甲東園: ["阪急甲東園", "関西学院"],
  仁川: ["阪急仁川", "阪神競馬場", "弁天池"],
  小林: ["阪急小林", "おばやし", "平林寺"],
  逆瀬川: ["阪急逆瀬川", "末広中央公園"],
  宝塚南口: ["阪急宝塚南口", "宝塚大橋"],
  天神橋筋六丁目: ["天六", "住まいのミュージアム", "大阪くらしの今昔館", "国分寺"],
  扇町: ["地下鉄扇町", "扇町公園", "堀川戎神社"],
  堺筋北浜: ["地下鉄北浜", "北浜", "大阪取引所", "適塾"],
  長堀橋: ["地下鉄長堀橋", "長堀橋跡", "島之内教会"],
  日本橋: ["地下鉄日本橋", "国立文楽劇場", "道頓堀"],
  恵美須町: ["地下鉄恵美須町", "通天閣", "今宮戎神社"],
  天下茶屋: ["地下鉄天下茶屋", "天下茶屋跡", "紹鴎森天満宮"],
  柴島: ["阪急柴島", "柴島神社", "水道記念館"],
  下新庄: ["阪急下新庄", "中島大水道跡"],
  阪急吹田: ["阪急 吹田", "高浜神社", "旧西尾家住宅"],
  豊津: ["阪急豊津", "糸田川", "垂水神社"],
  関大前: ["阪急関大前", "関西大学博物館"],
  千里山: ["阪急千里山", "第一噴水"],
  南千里: ["阪急南千里", "千里南公園"],
  阪急山田: ["阪急 山田", "山田西公園"],
  北千里: ["阪急北千里", "千里北公園"],
  JR京橋: ["JR東西線 京橋", "京橋駅 JR", "旧片町", "寝屋川橋"],
  大阪城北詰: ["JR大阪城北詰", "藤田美術館", "旧藤田邸庭園"],
  大阪天満宮: ["JR大阪天満宮", "天満天神繁昌亭", "堀川戎神社"],
  北新地: ["JR北新地", "蜆川跡", "堂島薬師堂"],
  新福島: ["JR新福島", "福島天満宮", "玉江橋"],
  海老江: ["JR海老江", "海老江八坂神社", "淀川大橋"],
  御幣島: ["JR御幣島", "大野川緑陰道路", "歌島橋"],
  加島: ["JR加島", "香具波志神社", "加島鋳銭所跡"],
  JR尼崎: ["JR東西線 尼崎", "尼崎駅 JR", "潮江緑地", "長洲天満宮"],
  JR福島: ["大阪環状線 福島", "福島駅 JR", "福島天満宮", "了徳院"],
  JR野田: ["大阪環状線 野田", "野田駅 JR", "春日神社", "野田の藤"],
  JR西九条: ["大阪環状線 西九条", "西九条駅 JR", "安治川トンネル", "西九條神社"],
  弁天町: ["JR弁天町", "地下鉄弁天町", "波除公園", "高見神社"],
  大正: ["JR大正", "大正橋", "大地震両川口津浪記"],
  芦原橋: ["JR芦原橋", "芦原公園", "塩草公園"],
  今宮: ["JR今宮", "敷津松之宮", "願泉寺"],
  新今宮: ["JR新今宮", "通天閣", "今宮戎神社"],
  天王寺: ["JR天王寺", "天王寺公園", "堀越神社"],
  寺田町: ["JR寺田町", "河堀稲生神社", "超願寺"],
  桃谷: ["JR桃谷", "観音寺", "彌榮神社"],
  玉造: ["JR玉造", "地下鉄玉造", "玉造稲荷神社", "三光神社"],
  森ノ宮: ["JR森ノ宮", "地下鉄森ノ宮", "鵲森宮", "大阪城公園"],
  大阪城公園: ["JR大阪城公園", "大阪城ホール", "青屋門"],
  桜ノ宮: ["JR桜ノ宮", "毛馬桜之宮公園", "櫻宮"],
  天満: ["JR天満", "扇町公園", "堀川戎神社"],
  塚本: ["JR塚本", "淀川橋梁", "鼻川神社"],
  立花: ["JR立花", "水堂須佐男神社", "七松八幡神社"],
  甲子園口: ["JR甲子園口", "武庫川松並木", "熊野神社"],
  JR西宮: ["JR神戸線 西宮", "西ノ宮", "東川親水南公園", "松原天満宮"],
  さくら夙川: ["JRさくら夙川", "夙川公園", "カトリック夙川教会"],
  JR芦屋: ["JR神戸線 芦屋", "芦屋川トンネル", "津知日吉神社"],
  甲南山手: ["JR甲南山手", "森稲荷神社", "神明八幡神社"],
  摂津本山: ["JR摂津本山", "天井川", "岡本南公園"],
  JR住吉: ["JR神戸線 住吉", "本住吉神社", "住吉川清流の道"],
  六甲道: ["JR六甲道", "六甲道南公園", "石屋川公園"],
  摩耶: ["JR摩耶", "都賀川公園", "西求女塚古墳"],
  灘: ["JR灘", "横尾忠則現代美術館", "兵庫県立美術館"],
  三ノ宮: ["JR三ノ宮", "東遊園地", "三宮神社", "フラワーロード"],
  JR塚口: ["JR宝塚線 塚口", "正玄寺", "塚口神社"],
  猪名寺: ["JR猪名寺", "猪名寺廃寺跡", "法園寺"],
  JR伊丹: ["JR宝塚線 伊丹", "有岡城跡", "旧岡田家住宅"],
  北伊丹: ["JR北伊丹", "西猪名公園", "軍行橋"],
  川西池田: ["JR川西池田", "栄根寺廃寺跡", "小戸神社"],
  中山寺: ["JR中山寺", "中山寺", "中筋の街並み"],
  JR宝塚: ["JR宝塚線 宝塚", "宝塚神社", "平林寺", "宝来橋"],
  生瀬: ["JR生瀬", "浄橋寺", "生瀬水道橋"],
  西宮名塩: ["JR西宮名塩", "教行寺", "名塩和紙学習館"],
  武田尾: ["JR武田尾", "武田尾橋", "福知山線廃線敷"],
  道場: ["JR道場", "烏帽子岩", "生野皇太神社"],
  三田: ["JR三田", "旧九鬼家住宅", "三田城跡"],
  新三田: ["JR新三田", "福島稲荷神社", "福島大池"],
  美章園: ["JR美章園", "桑津天神社", "近鉄立体交差"],
  南田辺: ["JR南田辺", "桃ヶ池公園", "山坂神社"],
  鶴ケ丘: ["JR鶴ケ丘", "長居球技場", "神須牟地神社"],
  JR長居: ["JR阪和線 長居", "臨南寺", "長居商店街"],
  我孫子町: ["JR我孫子町", "大聖観音寺", "あびこ観音"],
  杉本町: ["JR杉本町", "大阪公立大学", "阪和貨物線跡"],
  浅香: ["JR浅香", "浅香山緑道", "浅香山稲荷神社"],
  堺市: ["JR堺市", "東雲公園", "堺市立文化館"],
  JR三国ケ丘: ["JR阪和線 三国ケ丘", "田出井山古墳", "大仙陵古墳"],
  百舌鳥: ["JR百舌鳥", "大仙陵古墳拝所", "堺市博物館"],
  上野芝: ["JR上野芝", "上石津ミサンザイ古墳", "大仙公園日本庭園"],
  津久野: ["JR津久野", "踞尾八幡神社", "石津川橋梁"],
  鳳: ["JR鳳", "大鳥大社", "熊野街道"],
  富木: ["JR富木", "等乃伎神社"],
  北信太: ["JR北信太", "信太森葛葉稲荷神社", "聖神社"],
  信太山: ["JR信太山", "池上曽根遺跡", "弥生文化博物館"],
  和泉府中: ["JR和泉府中", "泉井上神社"],
  久米田: ["JR久米田", "久米田寺", "久米田池"],
  下松: ["JR阪和線 下松", "兵主神社", "岸和田市中央公園"],
  東岸和田: ["JR東岸和田", "土生神社"],
  東佐野: ["JR東佐野", "四角池", "加支多神社"],
  熊取: ["JR熊取", "中家住宅", "大森神社"],
  日根野: ["JR日根野", "日根神社", "慈眼院"],
  長滝: ["JR長滝", "蟻通神社"],
  新家: ["JR新家", "一岡神社", "泉南市埋蔵文化財センター"],
  和泉砂川: ["JR和泉砂川", "海会寺跡", "市場稲荷神社"],
  和泉鳥取: ["JR和泉鳥取", "波太神社"],
  山中渓: ["JR山中渓", "山中渓宿", "境橋"],
  紀伊: ["JR紀伊", "上野廃寺跡"],
  東部市場前: ["JR東部市場前", "今林公園", "杭全神社"],
  JR平野: ["大和路線 平野", "平野郷", "大念佛寺"],
  加美: ["JR加美", "菅原神社", "正覚寺"],
  久宝寺: ["JR久宝寺", "顕証寺", "久宝寺寺内町"],
  JR八尾: ["大和路線 八尾", "常光寺", "八尾神社"],
  志紀: ["JR志紀", "弓削神社"],
  柏原: ["JR柏原", "築留樋門跡", "光徳寺"],
  JR高井田: ["大和路線 高井田", "高井田横穴公園", "柏原市立歴史資料館"],
  河内堅上: ["JR河内堅上", "金山媛神社", "亀の瀬"],
  三郷: ["JR三郷", "龍田大社", "大和総国神社"],
  王寺: ["JR王寺", "達磨寺", "舟戸児童公園"],
  法隆寺: ["JR法隆寺", "斑鳩神社", "法隆寺参道"],
  大和小泉: ["JR大和小泉", "慈光院", "小泉神社"],
  JR郡山: ["大和路線 郡山", "外堀緑地", "薬園八幡神社"],
  江坂: ["地下鉄江坂", "江坂公園", "素盞嗚尊神社"],
  東三国: ["地下鉄東三国", "蒲田神社", "東三国東公園"],
  西中島南方: ["地下鉄西中島南方", "淀川河川公園西中島", "大林寺"],
  御堂筋中津: ["地下鉄中津", "富島神社", "中津公園"],
  御堂筋淀屋橋: ["地下鉄淀屋橋", "淀屋橋", "適塾"],
  御堂筋本町: ["地下鉄本町", "北御堂", "南御堂", "坐摩神社"],
  心斎橋: ["地下鉄心斎橋", "心斎橋跡", "御津八幡宮"],
  大国町: ["地下鉄大国町", "敷津松之宮", "願泉寺"],
  動物園前: ["地下鉄動物園前", "天王寺動物園", "天王寺公園"],
  昭和町: ["地下鉄昭和町", "桃ヶ池公園", "寺西家阿倍野長屋"],
  西田辺: ["地下鉄西田辺", "長池公園", "山阪神社"],
  御堂筋長居: ["地下鉄長居", "長居公園", "長居植物園"],
  あびこ: ["地下鉄あびこ", "大聖観音寺", "大依羅神社"],
  北花田: ["地下鉄北花田", "華表神社", "大和川左岸堤防"],
  新金岡: ["地下鉄新金岡", "大泉緑地", "金岡公園"],
  なかもず: ["地下鉄なかもず", "定の山古墳", "ニサンザイ古墳"],
  東梅田: ["地下鉄東梅田", "露天神社", "太融寺"],
  南森町: ["地下鉄南森町", "大阪天満宮", "堀川戎神社"],
  谷町天満橋: ["地下鉄天満橋", "八軒家浜", "南天満公園"],
  谷町四丁目: ["地下鉄谷町四丁目", "大阪歴史博物館", "難波宮跡公園"],
  谷町六丁目: ["地下鉄谷町六丁目", "空堀商店街", "観音寺"],
  谷町九丁目: ["地下鉄谷町九丁目", "生國魂神社", "真言坂"],
  四天王寺前夕陽ヶ丘: ["地下鉄四天王寺前夕陽ヶ丘", "四天王寺", "口縄坂"],
  谷町天王寺: ["地下鉄天王寺", "堀越神社", "茶臼山"],
  阿倍野: ["地下鉄阿倍野", "熊野街道", "阪堺上町線"],
  文の里: ["地下鉄文の里", "文の里商店街", "工芸高校"],
  谷町田辺: ["地下鉄田辺", "法楽寺", "山阪神社"],
  駒川中野: ["地下鉄駒川中野", "駒川商店街", "今川緑道"],
  谷町平野: ["地下鉄平野", "大念佛寺", "平野本町通"],
  喜連瓜破: ["地下鉄喜連瓜破", "楯原神社", "如願寺"],
  出戸: ["地下鉄出戸", "長吉公園", "素盞嗚尊神社"],
  長原: ["地下鉄長原", "志紀長吉神社", "一ヶ塚古墳"],
  八尾南: ["地下鉄八尾南", "八尾空港", "八尾車庫"],
  大日: ["地下鉄大日", "八雲神社", "庭窪浄水場"],
  谷町守口: ["地下鉄守口", "文禄堤", "難宗寺"],
  太子橋今市: ["地下鉄太子橋今市", "豊里大橋", "日吉神社"],
  千林大宮: ["地下鉄千林大宮", "大宮神社", "旭公園"],
  関目高殿: ["地下鉄関目高殿", "関目七曲り", "関目神社"],
  野江内代: ["地下鉄野江内代", "野江水神社", "内代公園"],
  都島: ["地下鉄都島", "都島神社", "都島橋"],
  西梅田: ["地下鉄西梅田", "桜橋跡", "堂島薬師堂"],
  肥後橋: ["地下鉄肥後橋", "錦橋", "国立国際美術館"],
  四つ橋本町: ["四つ橋線本町", "靱公園", "楠永神社"],
  四ツ橋: ["地下鉄四ツ橋", "四つ橋跡碑", "御津八幡宮"],
  四つ橋なんば: ["四つ橋線なんば", "浮庭橋", "難波八阪神社"],
  花園町: ["地下鉄花園町", "鶴見橋商店街", "梅旧院"],
  岸里: ["地下鉄岸里", "汐見橋線", "皿池公園"],
  玉出: ["地下鉄玉出", "生根神社", "玉出本通商店街"],
  北加賀屋: ["地下鉄北加賀屋", "名村造船所跡", "千島公園"],
  住之江公園: ["地下鉄住之江公園", "住之江公園", "大阪護國神社"],
  コスモスクエア: ["地下鉄コスモスクエア", "シーサイドコスモ", "さきしまコスモタワー"],
  大阪港: ["地下鉄大阪港", "天保山公園", "赤レンガ倉庫"],
  朝潮橋: ["地下鉄朝潮橋", "八幡屋公園", "みなとオアシス八幡屋"],
  中央九条: ["中央線九条", "茨住吉神社", "安治川トンネル"],
  阿波座: ["地下鉄阿波座", "津波・高潮ステーション", "雑魚場魚市場跡"],
  中央本町: ["中央線本町", "坐摩神社", "船場センタービル"],
  堺筋本町: ["地下鉄堺筋本町", "本町橋", "企業家ミュージアム"],
  中央谷町四丁目: ["中央線谷町四丁目", "難波宮跡公園", "大阪歴史博物館"],
  緑橋: ["地下鉄緑橋", "平野川分水路", "白山神社"],
  深江橋: ["地下鉄深江橋", "深江稲荷神社", "チャンチキ堂"],
  中央高井田: ["中央線高井田", "鴨高田神社", "長瀬川緑道"],
  中央長田: ["中央線長田", "長田神社", "楠根川緑地"],
  生駒: ["近鉄 生駒", "生駒駅", "宝山寺"],
  東生駒: ["近鉄 東生駒", "往馬大社"],
  富雄: ["近鉄 富雄", "富雄川"],
  近鉄学園前: ["近鉄 学園前", "学園前駅 奈良", "大渕池"],
  菖蒲池: ["近鉄 菖蒲池", "あやめ池"],
  新大宮: ["近鉄 新大宮", "新大宮駅"],
  近鉄奈良: ["近鉄奈良駅", "近鉄 奈良", "興福寺"],
  大阪難波: ["近鉄難波", "近鉄 大阪難波", "法善寺"],
  近鉄日本橋: ["近鉄 日本橋", "日本橋駅 近鉄", "黒門市場"],
  大阪上本町: ["上本町", "近鉄上本町", "生國魂神社"],
  鶴橋: ["近鉄鶴橋", "近鉄 鶴橋", "鶴橋商店街"],
  近鉄今里: ["近鉄 今里", "今里駅 近鉄", "生野八坂神社"],
  布施: ["近鉄布施", "近鉄 布施", "都留彌神社"],
  河内永和: ["近鉄河内永和", "長瀬川"],
  河内小阪: ["近鉄河内小阪", "司馬遼太郎記念館"],
  八戸ノ里: ["八戸の里", "近鉄八戸ノ里", "御厨天神社"],
  若江岩田: ["近鉄若江岩田", "若江鏡神社"],
  河内花園: ["近鉄河内花園", "玉串川"],
  東花園: ["近鉄東花園", "花園ラグビー場"],
  瓢箪山: ["近鉄瓢箪山", "瓢箪山稲荷神社"],
  枚岡: ["近鉄枚岡", "枚岡神社"],
  額田: ["近鉄額田", "額田谷"],
  石切: ["近鉄石切", "石切参道"],
  西木津: ["JR西木津", "相楽神社"],
  祝園: ["JR祝園", "けいはんな記念公園"],
  下狛: ["JR下狛", "大宮神社 鞍岡山"],
  JR三山木: ["三山木（JR）", "寿宝寺"],
  同志社前: ["JR同志社前", "甘南備山"],
  京田辺: ["JR京田辺", "一休寺"],
  大住: ["JR大住", "月読神社 大住"],
  松井山手: ["JR松井山手", "山手幹線"],
  長尾: ["JR長尾", "王仁公園", "長尾駅 枚方"],
  藤阪: ["JR藤阪", "伝王仁墓"],
  津田: ["JR津田", "春日神社 津田"],
  河内磐船: ["JR河内磐船", "機物神社"],
  星田: ["JR星田", "星田妙見宮"],
  寝屋川公園: ["JR寝屋川公園", "府営寝屋川公園"],
  忍ケ丘: ["忍ヶ丘", "JR忍ケ丘", "忍陵神社"],
  四条畷: ["JR四条畷", "四條畷神社"],
  野崎: ["JR野崎", "野崎観音"],
  住道: ["JR住道", "住道大橋"],
  鴻池新田: ["JR鴻池新田", "鴻池新田会所"],
  徳庵: ["JR徳庵", "徳庵橋"],
  放出: ["JR放出", "はなてん", "阿遅速雄神社"],
  俊徳道: ["近鉄俊徳道", "俊徳街道"],
  長瀬: ["近鉄長瀬", "長瀬川"],
  弥刀: ["近鉄弥刀", "御劔神社"],
  久宝寺口: ["近鉄久宝寺口", "顕証寺"],
  近鉄八尾: ["八尾（近鉄）", "常光寺"],
  河内山本: ["近鉄河内山本", "玉串川"],
  高安: ["近鉄高安", "教興寺"],
  恩智: ["近鉄恩智", "恩智神社"],
  法善寺: ["近鉄法善寺", "壺井寺"],
  堅下: ["近鉄堅下", "鐸比古鐸比賣神社"],
  安堂: ["近鉄安堂", "高井田横穴"],
  河内国分: ["近鉄河内国分", "国分神社"],
  大阪教育大前: ["近鉄大阪教育大前"],
  関屋: ["近鉄関屋", "関屋駅 香芝"],
  二上: ["近鉄二上", "大坂山口神社"],
  近鉄下田: ["下田（近鉄）", "鹿嶋神社 香芝"],
  五位堂: ["近鉄五位堂", "十二社神社"],
  築山: ["近鉄築山", "築山古墳"],
  大和高田: ["近鉄大和高田", "高田千本桜"],
  松塚: ["近鉄松塚", "葛城川"],
  真菅: ["近鉄真菅", "人麿神社"],
  // 2026-11-16 spots empty_spots 救済
  鶴原: [
    "南海本線 鶴原駅",
    "鶴原駅 南海",
    "鶴原 泉佐野 南海",
    "日根神社 鶴原",
  ],
  みさき公園: [
    "南海みさき公園",
    "南海本線 みさき公園",
    "みさき公園駅",
    "淡輪海水浴場",
  ],
  室生口大野: [
    "近鉄室生口大野",
    "近鉄大阪線 室生口大野",
    "室生寺",
    "室生口大野駅",
  ],
  近鉄三本松: [
    "近鉄 三本松",
    "近鉄大阪線 三本松",
    "三本松駅 宇陀",
    "宇陀川",
  ],
  赤目口: ["近鉄赤目口", "近鉄大阪線 赤目口", "赤目四十八滝", "赤目口駅"],
  上ノ太子: [
    "近鉄上ノ太子",
    "近鉄南大阪線 上ノ太子",
    "叡福寺",
    "上ノ太子駅",
  ],
  人丸前: [
    "山陽人丸前",
    "山陽電鉄 人丸前",
    "柿本人麻呂",
    "人丸前駅 明石",
  ],
};

/**
 * 土地文ストック駅の spots バッチ正本名（docs/land-stock 見出しと一致）。
 * 別名キーは BY_NAME にあるが、キャッシュ鍵はここで一本化する。
 */
export const LAND_STOCK_SPOT_BATCH: ReadonlyArray<{
  line:
    | "eizan"
    | "keihan"
    | "randen"
    | "hankyu"
    | "sagano"
    | "karasuma"
    | "tozai"
    | "kintetsu"
    | "jr-nara"
    | "jr-kyoto"
    | "kashihara"
    | "keihanna"
    | "keihan-osaka"
    | "keihan-nakanoshima"
    | "keihan-katano"
    | "sanyo"
    | "kobe-subway"
    | "jr-fukuchiyama"
    | "senboku"
    | "kitakyu"
    | "osaka-monorail"
    | "kintetsu-nara"
    | "kintetsu-nara-osaka"
    | "jr-gakken"
    | "kintetsu-osaka"
    | "hanshin"
    | "hanshin-mukogawa"
    | "jr-kakogawa"
    | "hojo"
    | "shintetsu-ao"
    | "shintetsu-koen-toshi"
    | "shintetsu-sanda"
    | "shintetsu-arima"
    | "nose"
    | "hanshin-namba"
    | "hankyu-kobe"
    | "hankyu-takarazuka"
    | "hankyu-kyoto-osaka"
    | "hankyu-imazu"
    | "hankyu-senri"
    | "jr-tozai"
    | "jr-loop"
    | "jr-kobe"
    | "jr-takarazuka"
    | "jr-hanwa"
    | "jr-yamato"
    | "midosuji"
    | "tanimachi"
    | "yotsubashi"
    | "chuo"
    | "sakaisuji"
    | "sennichimae"
    | "nagahori"
    | "nankai-koya"
    | "nankai-main"
    | "kintetsu-osaka-east"
    | "kintetsu-minami-osaka";
  name: string;
}> = [
  // 正本 · Argon再生成（D0）
  { line: "eizan", name: "出町柳" },
  { line: "eizan", name: "二ノ瀬" },
  { line: "keihan", name: "中書島" },
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
  // 烏丸南北 · 未収録7（十条は地下鉄表記で近鉄と鍵分離）
  { line: "karasuma", name: "国際会館" },
  { line: "karasuma", name: "松ヶ崎" },
  { line: "karasuma", name: "北山" },
  { line: "karasuma", name: "北大路" },
  { line: "karasuma", name: "九条" },
  { line: "karasuma", name: "地下鉄十条" },
  { line: "karasuma", name: "くいな橋" },
  // 地下鉄東西 · 未収録13（六地蔵・烏丸御池・二条・太秦天神川は他線）
  { line: "tozai", name: "石田" },
  { line: "tozai", name: "醍醐" },
  { line: "tozai", name: "小野" },
  { line: "tozai", name: "椥辻" },
  { line: "tozai", name: "東野" },
  { line: "tozai", name: "山科" },
  { line: "tozai", name: "御陵" },
  { line: "tozai", name: "蹴上" },
  { line: "tozai", name: "東山" },
  { line: "tozai", name: "三条京阪" },
  { line: "tozai", name: "京都市役所前" },
  { line: "tozai", name: "二条城前" },
  { line: "tozai", name: "西大路御池" },
  // 近鉄京都線 · 未収録25（京都は烏丸線正本）
  { line: "kintetsu", name: "東寺" },
  { line: "kintetsu", name: "十条" },
  { line: "kintetsu", name: "上鳥羽口" },
  { line: "kintetsu", name: "竹田" },
  { line: "kintetsu", name: "伏見" },
  { line: "kintetsu", name: "近鉄丹波橋" },
  { line: "kintetsu", name: "桃山御陵前" },
  { line: "kintetsu", name: "向島" },
  { line: "kintetsu", name: "小倉" },
  { line: "kintetsu", name: "伊勢田" },
  { line: "kintetsu", name: "大久保" },
  { line: "kintetsu", name: "久津川" },
  { line: "kintetsu", name: "寺田" },
  { line: "kintetsu", name: "富野荘" },
  { line: "kintetsu", name: "新田辺" },
  { line: "kintetsu", name: "興戸" },
  { line: "kintetsu", name: "三山木" },
  { line: "kintetsu", name: "近鉄宮津" },
  { line: "kintetsu", name: "狛田" },
  { line: "kintetsu", name: "新祝園" },
  { line: "kintetsu", name: "木津川台" },
  { line: "kintetsu", name: "山田川" },
  { line: "kintetsu", name: "高の原" },
  { line: "kintetsu", name: "平城" },
  { line: "kintetsu", name: "大和西大寺" },
  // JR奈良線 · 未収録20（京都は烏丸線正本。京阪同名は JR 接頭）
  { line: "jr-nara", name: "JR東福寺" },
  { line: "jr-nara", name: "JR稲荷" },
  { line: "jr-nara", name: "JR藤森" },
  { line: "jr-nara", name: "JR桃山" },
  { line: "jr-nara", name: "JR六地蔵" },
  { line: "jr-nara", name: "JR木幡" },
  { line: "jr-nara", name: "JR黄檗" },
  { line: "jr-nara", name: "JR宇治" },
  { line: "jr-nara", name: "JR小倉" },
  { line: "jr-nara", name: "新田" },
  { line: "jr-nara", name: "城陽" },
  { line: "jr-nara", name: "長池" },
  { line: "jr-nara", name: "山城青谷" },
  { line: "jr-nara", name: "山城多賀" },
  { line: "jr-nara", name: "玉水" },
  { line: "jr-nara", name: "棚倉" },
  { line: "jr-nara", name: "上狛" },
  { line: "jr-nara", name: "木津" },
  { line: "jr-nara", name: "平城山" },
  { line: "jr-nara", name: "JR奈良" },
  // JR京都線 · 未収録14（京都・新大阪・大阪除外。東淀川含む。阪急同名は JR 接頭）
  { line: "jr-kyoto", name: "西大路" },
  { line: "jr-kyoto", name: "桂川" },
  { line: "jr-kyoto", name: "向日町" },
  { line: "jr-kyoto", name: "長岡京" },
  { line: "jr-kyoto", name: "JR山崎" },
  { line: "jr-kyoto", name: "島本" },
  { line: "jr-kyoto", name: "JR高槻" },
  { line: "jr-kyoto", name: "摂津富田" },
  { line: "jr-kyoto", name: "JR総持寺" },
  { line: "jr-kyoto", name: "JR茨木" },
  { line: "jr-kyoto", name: "千里丘" },
  { line: "jr-kyoto", name: "岸辺" },
  { line: "jr-kyoto", name: "JR吹田" },
  { line: "jr-kyoto", name: "東淀川" },
  // 近鉄橿原線 · 未収録16（大和西大寺除外。九条は烏丸と分離）
  { line: "kashihara", name: "尼ヶ辻" },
  { line: "kashihara", name: "西ノ京" },
  { line: "kashihara", name: "近鉄九条" },
  { line: "kashihara", name: "近鉄郡山" },
  { line: "kashihara", name: "筒井" },
  { line: "kashihara", name: "平端" },
  { line: "kashihara", name: "ファミリー公園前" },
  { line: "kashihara", name: "結崎" },
  { line: "kashihara", name: "近鉄石見" },
  { line: "kashihara", name: "田原本" },
  { line: "kashihara", name: "笠縫" },
  { line: "kashihara", name: "新ノ口" },
  { line: "kashihara", name: "大和八木" },
  { line: "kashihara", name: "八木西口" },
  { line: "kashihara", name: "畝傍御陵前" },
  { line: "kashihara", name: "橿原神宮前" },
  // 近鉄けいはんな線 · 未収録7（生駒除外。長田・吉田は接頭）
  { line: "keihanna", name: "けいはんな長田" },
  { line: "keihanna", name: "荒本" },
  { line: "keihanna", name: "けいはんな吉田" },
  { line: "keihanna", name: "新石切" },
  { line: "keihanna", name: "白庭台" },
  { line: "keihanna", name: "学研北生駒" },
  { line: "keihanna", name: "学研奈良登美ヶ丘" },
  // 京阪本線 · 大阪寄り J1（橋本〜大和田。京橋以西は J2）
  { line: "keihan-osaka", name: "京阪橋本" },
  { line: "keihan-osaka", name: "樟葉" },
  { line: "keihan-osaka", name: "枚方公園" },
  { line: "keihan-osaka", name: "枚方市" },
  { line: "keihan-osaka", name: "御殿山" },
  { line: "keihan-osaka", name: "京阪牧野" },
  { line: "keihan-osaka", name: "香里園" },
  { line: "keihan-osaka", name: "寝屋川市" },
  { line: "keihan-osaka", name: "萱島" },
  { line: "keihan-osaka", name: "京阪大和田" },
  // 京阪本線 · 大阪寄り J2（古川橋〜野江）
  { line: "keihan-osaka", name: "古川橋" },
  { line: "keihan-osaka", name: "門真市" },
  { line: "keihan-osaka", name: "西三荘" },
  { line: "keihan-osaka", name: "守口市" },
  { line: "keihan-osaka", name: "京阪土居" },
  { line: "keihan-osaka", name: "滝井" },
  { line: "keihan-osaka", name: "千林" },
  { line: "keihan-osaka", name: "森小路" },
  { line: "keihan-osaka", name: "関目" },
  { line: "keihan-osaka", name: "京阪野江" },
  // 京阪本線 · J3 京橋〜淀屋橋（都心 · 運用B）
  { line: "keihan-osaka", name: "京阪京橋" },
  { line: "keihan-osaka", name: "京阪天満橋" },
  { line: "keihan-osaka", name: "京阪北浜" },
  { line: "keihan-osaka", name: "京阪淀屋橋" },
  // 京阪中之島線 · J4（運用B）
  { line: "keihan-nakanoshima", name: "中之島" },
  { line: "keihan-nakanoshima", name: "渡辺橋" },
  { line: "keihan-nakanoshima", name: "大江橋" },
  { line: "keihan-nakanoshima", name: "なにわ橋" },
  // 阪神本線 · L0 福島〜大物（運用B）
  { line: "hanshin", name: "阪神福島" },
  { line: "hanshin", name: "阪神野田" },
  { line: "hanshin", name: "阪神淀川" },
  { line: "hanshin", name: "姫島" },
  { line: "hanshin", name: "千船" },
  { line: "hanshin", name: "杭瀬" },
  { line: "hanshin", name: "大物" },
  // 阪神本線 · L2 住吉〜春日野道
  { line: "hanshin", name: "阪神住吉" },
  { line: "hanshin", name: "阪神御影" },
  { line: "hanshin", name: "石屋川" },
  { line: "hanshin", name: "新在家" },
  { line: "hanshin", name: "大石" },
  { line: "hanshin", name: "西灘" },
  { line: "hanshin", name: "阪神岩屋" },
  { line: "hanshin", name: "阪神春日野道" },
  // 阪神本線 · L 尼崎〜魚崎
  { line: "hanshin", name: "阪神尼崎" },
  { line: "hanshin", name: "出屋敷" },
  { line: "hanshin", name: "尼崎センタープール前" },
  { line: "hanshin", name: "武庫川" },
  { line: "hanshin", name: "鳴尾・武庫川女子大前" },
  // 阪神武庫川線 · T1（武庫川は本線と共有 id · 東鳴尾〜団地前は新規）
  { line: "hanshin-mukogawa", name: "東鳴尾" },
  { line: "hanshin-mukogawa", name: "洲先" },
  { line: "hanshin-mukogawa", name: "武庫川団地前" },
  { line: "hanshin", name: "甲子園" },
  { line: "hanshin", name: "久寿川" },
  { line: "hanshin", name: "阪神今津" },
  { line: "hanshin", name: "阪神西宮" },
  { line: "hanshin", name: "香櫨園" },
  { line: "hanshin", name: "打出" },
  { line: "hanshin", name: "阪神芦屋" },
  { line: "hanshin", name: "深江" },
  { line: "hanshin", name: "青木" },
  { line: "hanshin", name: "魚崎" },
  // 阪神なんば線 · L3
  { line: "hanshin-namba", name: "阪神桜川" },
  { line: "hanshin-namba", name: "ドーム前" },
  { line: "hanshin-namba", name: "阪神九条" },
  { line: "hanshin-namba", name: "阪神西九条" },
  { line: "hanshin-namba", name: "千鳥橋" },
  { line: "hanshin-namba", name: "福" },
  { line: "hanshin-namba", name: "出来島" },
  { line: "hanshin-namba", name: "伝法" },
  // 阪急神戸本線 · M1 中津〜春日野道
  { line: "hankyu-kobe", name: "阪急中津" },
  { line: "hankyu-kobe", name: "十三" },
  { line: "hankyu-kobe", name: "神崎川" },
  { line: "hankyu-kobe", name: "園田" },
  { line: "hankyu-kobe", name: "阪急塚口" },
  { line: "hankyu-kobe", name: "武庫之荘" },
  { line: "hankyu-kobe", name: "西宮北口" },
  { line: "hankyu-kobe", name: "夙川" },
  { line: "hankyu-kobe", name: "芦屋川" },
  { line: "hankyu-kobe", name: "岡本" },
  { line: "hankyu-kobe", name: "阪急御影" },
  { line: "hankyu-kobe", name: "六甲" },
  { line: "hankyu-kobe", name: "王子公園" },
  { line: "hankyu-kobe", name: "阪急春日野道" },
  // 阪急宝塚本線 · M2 三国〜宝塚
  { line: "hankyu-takarazuka", name: "三国" },
  { line: "hankyu-takarazuka", name: "阪急庄内" },
  { line: "hankyu-takarazuka", name: "服部天神" },
  { line: "hankyu-takarazuka", name: "阪急曽根" },
  { line: "hankyu-takarazuka", name: "岡町" },
  { line: "hankyu-takarazuka", name: "豊中" },
  { line: "hankyu-takarazuka", name: "蛍池" },
  { line: "hankyu-takarazuka", name: "石橋阪大前" },
  { line: "hankyu-takarazuka", name: "阪急池田" },
  { line: "hankyu-takarazuka", name: "川西能勢口" },
  { line: "hankyu-takarazuka", name: "雲雀丘花屋敷" },
  { line: "hankyu-takarazuka", name: "阪急山本" },
  { line: "hankyu-takarazuka", name: "中山観音" },
  { line: "hankyu-takarazuka", name: "売布神社" },
  { line: "hankyu-takarazuka", name: "清荒神" },
  { line: "hankyu-takarazuka", name: "阪急宝塚" },
  // 阪急京都本線 · M3 南方〜西山天王山
  { line: "hankyu-kyoto-osaka", name: "南方" },
  { line: "hankyu-kyoto-osaka", name: "崇禅寺" },
  { line: "hankyu-kyoto-osaka", name: "阪急淡路" },
  { line: "hankyu-kyoto-osaka", name: "上新庄" },
  { line: "hankyu-kyoto-osaka", name: "相川" },
  { line: "hankyu-kyoto-osaka", name: "正雀" },
  { line: "hankyu-kyoto-osaka", name: "摂津市" },
  { line: "hankyu-kyoto-osaka", name: "南茨木" },
  { line: "hankyu-kyoto-osaka", name: "阪急茨木市" },
  { line: "hankyu-kyoto-osaka", name: "阪急総持寺" },
  { line: "hankyu-kyoto-osaka", name: "阪急高槻市" },
  { line: "hankyu-kyoto-osaka", name: "上牧" },
  { line: "hankyu-kyoto-osaka", name: "水無瀬" },
  { line: "hankyu-kyoto-osaka", name: "大山崎" },
  { line: "hankyu-kyoto-osaka", name: "西山天王山" },
  // 阪急今津線 · M4 今津〜宝塚（西宮北口・宝塚は既存 id 共有）
  { line: "hankyu-imazu", name: "阪急今津" },
  { line: "hankyu-imazu", name: "阪神国道" },
  { line: "hankyu-imazu", name: "西宮北口" },
  { line: "hankyu-imazu", name: "門戸厄神" },
  { line: "hankyu-imazu", name: "甲東園" },
  { line: "hankyu-imazu", name: "仁川" },
  { line: "hankyu-imazu", name: "小林" },
  { line: "hankyu-imazu", name: "逆瀬川" },
  { line: "hankyu-imazu", name: "宝塚南口" },
  { line: "hankyu-imazu", name: "阪急宝塚" },
  // 阪急千里線 · M5 天神橋筋六丁目〜北千里
  { line: "hankyu-senri", name: "天神橋筋六丁目" },
  { line: "hankyu-senri", name: "柴島" },
  { line: "hankyu-senri", name: "阪急淡路" },
  { line: "hankyu-senri", name: "下新庄" },
  { line: "hankyu-senri", name: "阪急吹田" },
  { line: "hankyu-senri", name: "豊津" },
  { line: "hankyu-senri", name: "関大前" },
  { line: "hankyu-senri", name: "千里山" },
  { line: "hankyu-senri", name: "南千里" },
  { line: "hankyu-senri", name: "阪急山田" },
  { line: "hankyu-senri", name: "北千里" },
  // JR東西線 · N1 京橋〜尼崎（京橋≠京阪、尼崎≠阪神）
  { line: "jr-tozai", name: "JR京橋" },
  { line: "jr-tozai", name: "大阪城北詰" },
  { line: "jr-tozai", name: "大阪天満宮" },
  { line: "jr-tozai", name: "北新地" },
  { line: "jr-tozai", name: "新福島" },
  { line: "jr-tozai", name: "海老江" },
  { line: "jr-tozai", name: "御幣島" },
  { line: "jr-tozai", name: "加島" },
  { line: "jr-tozai", name: "JR尼崎" },
  // 大阪環状線 · N2 福島〜天満（福島・野田・西九条≠阪神。京橋・鶴橋は共有）
  { line: "jr-loop", name: "JR福島" },
  { line: "jr-loop", name: "JR野田" },
  { line: "jr-loop", name: "JR西九条" },
  { line: "jr-loop", name: "弁天町" },
  { line: "jr-loop", name: "大正" },
  { line: "jr-loop", name: "芦原橋" },
  { line: "jr-loop", name: "今宮" },
  { line: "jr-loop", name: "新今宮" },
  { line: "jr-loop", name: "天王寺" },
  { line: "jr-loop", name: "寺田町" },
  { line: "jr-loop", name: "桃谷" },
  { line: "jr-loop", name: "鶴橋" },
  { line: "jr-loop", name: "玉造" },
  { line: "jr-loop", name: "森ノ宮" },
  { line: "jr-loop", name: "大阪城公園" },
  { line: "jr-loop", name: "JR京橋" },
  { line: "jr-loop", name: "桜ノ宮" },
  { line: "jr-loop", name: "天満" },
  // JR神戸線 · N3 塚本〜三ノ宮（尼崎共有 · 西宮・芦屋・住吉≠阪神）
  { line: "jr-kobe", name: "塚本" },
  { line: "jr-kobe", name: "JR尼崎" },
  { line: "jr-kobe", name: "立花" },
  { line: "jr-kobe", name: "甲子園口" },
  { line: "jr-kobe", name: "JR西宮" },
  { line: "jr-kobe", name: "さくら夙川" },
  { line: "jr-kobe", name: "JR芦屋" },
  { line: "jr-kobe", name: "甲南山手" },
  { line: "jr-kobe", name: "摂津本山" },
  { line: "jr-kobe", name: "JR住吉" },
  { line: "jr-kobe", name: "六甲道" },
  { line: "jr-kobe", name: "摩耶" },
  { line: "jr-kobe", name: "灘" },
  { line: "jr-kobe", name: "三ノ宮" },
  // JR宝塚線 · N4 塚口〜新三田（塚口・伊丹・宝塚≠阪急）
  { line: "jr-takarazuka", name: "JR塚口" },
  { line: "jr-takarazuka", name: "猪名寺" },
  { line: "jr-takarazuka", name: "JR伊丹" },
  { line: "jr-takarazuka", name: "北伊丹" },
  { line: "jr-takarazuka", name: "川西池田" },
  { line: "jr-takarazuka", name: "中山寺" },
  { line: "jr-takarazuka", name: "JR宝塚" },
  { line: "jr-takarazuka", name: "生瀬" },
  { line: "jr-takarazuka", name: "西宮名塩" },
  { line: "jr-takarazuka", name: "武田尾" },
  { line: "jr-takarazuka", name: "道場" },
  { line: "jr-takarazuka", name: "三田" },
  { line: "jr-takarazuka", name: "新三田" },
  // JR阪和線 · N5 美章園〜鳳（長居・三国ケ丘は他社と別 id）
  { line: "jr-hanwa", name: "美章園" },
  { line: "jr-hanwa", name: "南田辺" },
  { line: "jr-hanwa", name: "鶴ケ丘" },
  { line: "jr-hanwa", name: "JR長居" },
  { line: "jr-hanwa", name: "我孫子町" },
  { line: "jr-hanwa", name: "杉本町" },
  { line: "jr-hanwa", name: "浅香" },
  { line: "jr-hanwa", name: "堺市" },
  { line: "jr-hanwa", name: "JR三国ケ丘" },
  { line: "jr-hanwa", name: "百舌鳥" },
  { line: "jr-hanwa", name: "上野芝" },
  { line: "jr-hanwa", name: "津久野" },
  { line: "jr-hanwa", name: "鳳" },
  // JR阪和線 · N6 富木〜紀伊
  { line: "jr-hanwa", name: "富木" },
  { line: "jr-hanwa", name: "北信太" },
  { line: "jr-hanwa", name: "信太山" },
  { line: "jr-hanwa", name: "和泉府中" },
  { line: "jr-hanwa", name: "久米田" },
  { line: "jr-hanwa", name: "下松" },
  { line: "jr-hanwa", name: "東岸和田" },
  { line: "jr-hanwa", name: "東佐野" },
  { line: "jr-hanwa", name: "熊取" },
  { line: "jr-hanwa", name: "日根野" },
  { line: "jr-hanwa", name: "長滝" },
  { line: "jr-hanwa", name: "新家" },
  { line: "jr-hanwa", name: "和泉砂川" },
  { line: "jr-hanwa", name: "和泉鳥取" },
  { line: "jr-hanwa", name: "山中渓" },
  { line: "jr-hanwa", name: "紀伊" },
  // 大和路線 · N7 東部市場前〜郡山（八尾・郡山・高井田・平野は他社と別 id）
  { line: "jr-yamato", name: "東部市場前" },
  { line: "jr-yamato", name: "JR平野" },
  { line: "jr-yamato", name: "加美" },
  { line: "jr-yamato", name: "久宝寺" },
  { line: "jr-yamato", name: "JR八尾" },
  { line: "jr-yamato", name: "志紀" },
  { line: "jr-yamato", name: "柏原" },
  { line: "jr-yamato", name: "JR高井田" },
  { line: "jr-yamato", name: "河内堅上" },
  { line: "jr-yamato", name: "三郷" },
  { line: "jr-yamato", name: "王寺" },
  { line: "jr-yamato", name: "法隆寺" },
  { line: "jr-yamato", name: "大和小泉" },
  { line: "jr-yamato", name: "JR郡山" },
  // 御堂筋線 · Q1 江坂〜あびこ（中津≠阪急、長居≠JR、淀屋橋≠京阪）
  { line: "midosuji", name: "江坂" },
  { line: "midosuji", name: "東三国" },
  { line: "midosuji", name: "西中島南方" },
  { line: "midosuji", name: "御堂筋中津" },
  { line: "midosuji", name: "御堂筋淀屋橋" },
  { line: "midosuji", name: "御堂筋本町" },
  { line: "midosuji", name: "心斎橋" },
  { line: "midosuji", name: "大国町" },
  { line: "midosuji", name: "動物園前" },
  { line: "midosuji", name: "昭和町" },
  { line: "midosuji", name: "西田辺" },
  { line: "midosuji", name: "御堂筋長居" },
  { line: "midosuji", name: "あびこ" },
  // 御堂筋線 · Q2 北花田〜なかもず
  { line: "midosuji", name: "北花田" },
  { line: "midosuji", name: "新金岡" },
  { line: "midosuji", name: "なかもず" },
  // 谷町線 · Q3 東梅田〜八尾南（天王寺・平野・天満橋・田辺は他社と別 id）
  { line: "tanimachi", name: "東梅田" },
  { line: "tanimachi", name: "南森町" },
  { line: "tanimachi", name: "谷町天満橋" },
  { line: "tanimachi", name: "谷町四丁目" },
  { line: "tanimachi", name: "谷町六丁目" },
  { line: "tanimachi", name: "谷町九丁目" },
  { line: "tanimachi", name: "四天王寺前夕陽ヶ丘" },
  { line: "tanimachi", name: "谷町天王寺" },
  { line: "tanimachi", name: "阿倍野" },
  { line: "tanimachi", name: "文の里" },
  { line: "tanimachi", name: "谷町田辺" },
  { line: "tanimachi", name: "駒川中野" },
  { line: "tanimachi", name: "谷町平野" },
  { line: "tanimachi", name: "喜連瓜破" },
  { line: "tanimachi", name: "出戸" },
  { line: "tanimachi", name: "長原" },
  { line: "tanimachi", name: "八尾南" },
  // 谷町線 · Q4 大日〜都島（守口≠京阪守口市）
  { line: "tanimachi", name: "大日" },
  { line: "tanimachi", name: "谷町守口" },
  { line: "tanimachi", name: "太子橋今市" },
  { line: "tanimachi", name: "千林大宮" },
  { line: "tanimachi", name: "関目高殿" },
  { line: "tanimachi", name: "野江内代" },
  { line: "tanimachi", name: "都島" },
  // 四つ橋線 · Q5 西梅田〜住之江公園（本町・なんばは四つ橋キー）
  { line: "yotsubashi", name: "西梅田" },
  { line: "yotsubashi", name: "肥後橋" },
  { line: "yotsubashi", name: "四つ橋本町" },
  { line: "yotsubashi", name: "四ツ橋" },
  { line: "yotsubashi", name: "四つ橋なんば" },
  { line: "yotsubashi", name: "大国町" },
  { line: "yotsubashi", name: "花園町" },
  { line: "yotsubashi", name: "岸里" },
  { line: "yotsubashi", name: "玉出" },
  { line: "yotsubashi", name: "北加賀屋" },
  { line: "yotsubashi", name: "住之江公園" },
  // 中央線 · Q6 コスモスクエア〜長田
  { line: "chuo", name: "コスモスクエア" },
  { line: "chuo", name: "大阪港" },
  { line: "chuo", name: "朝潮橋" },
  { line: "chuo", name: "弁天町" },
  { line: "chuo", name: "中央九条" },
  { line: "chuo", name: "阿波座" },
  { line: "chuo", name: "中央本町" },
  { line: "chuo", name: "堺筋本町" },
  { line: "chuo", name: "中央谷町四丁目" },
  { line: "chuo", name: "森ノ宮" },
  { line: "chuo", name: "玉造" },
  { line: "chuo", name: "緑橋" },
  { line: "chuo", name: "深江橋" },
  { line: "chuo", name: "中央高井田" },
  { line: "chuo", name: "中央長田" },
  // 堺筋線 · Q7 天神橋筋六丁目〜天下茶屋（北浜≠京阪、日本橋≠近鉄）
  { line: "sakaisuji", name: "天神橋筋六丁目" },
  { line: "sakaisuji", name: "扇町" },
  { line: "sakaisuji", name: "南森町" },
  { line: "sakaisuji", name: "堺筋北浜" },
  { line: "sakaisuji", name: "堺筋本町" },
  { line: "sakaisuji", name: "長堀橋" },
  { line: "sakaisuji", name: "日本橋" },
  { line: "sakaisuji", name: "恵美須町" },
  { line: "sakaisuji", name: "動物園前" },
  { line: "sakaisuji", name: "天下茶屋" },
  // 千日前線 · Q8 野田阪神〜南巽（桜川≠阪神、なんば≠四つ橋、今里≠近鉄）
  { line: "sennichimae", name: "野田阪神" },
  { line: "sennichimae", name: "玉川" },
  { line: "sennichimae", name: "西長堀" },
  { line: "sennichimae", name: "千日前桜川" },
  { line: "sennichimae", name: "千日前なんば" },
  { line: "sennichimae", name: "日本橋" },
  { line: "sennichimae", name: "谷町九丁目" },
  { line: "sennichimae", name: "鶴橋" },
  { line: "sennichimae", name: "千日前今里" },
  { line: "sennichimae", name: "新深江" },
  { line: "sennichimae", name: "小路" },
  { line: "sennichimae", name: "北巽" },
  { line: "sennichimae", name: "南巽" },
  // 長堀鶴見緑地線 · Q9 大正〜門真南（大正≠JR、京橋≠京阪/JR）
  { line: "nagahori", name: "長堀大正" },
  { line: "nagahori", name: "ドーム前千代崎" },
  { line: "nagahori", name: "西長堀" },
  { line: "nagahori", name: "西大橋" },
  { line: "nagahori", name: "心斎橋" },
  { line: "nagahori", name: "長堀橋" },
  { line: "nagahori", name: "松屋町" },
  { line: "nagahori", name: "谷町六丁目" },
  { line: "nagahori", name: "玉造" },
  { line: "nagahori", name: "森ノ宮" },
  { line: "nagahori", name: "大阪ビジネスパーク" },
  { line: "nagahori", name: "長堀京橋" },
  { line: "nagahori", name: "蒲生四丁目" },
  { line: "nagahori", name: "今福鶴見" },
  { line: "nagahori", name: "横堤" },
  { line: "nagahori", name: "鶴見緑地" },
  { line: "nagahori", name: "門真南" },
  // 南海高野線 · P1 今宮戎〜中百舌鳥（新今宮≠JR、天下茶屋≠堺筋、三国ヶ丘≠JR、中百舌鳥≠御堂筋）
  { line: "nankai-koya", name: "今宮戎" },
  { line: "nankai-koya", name: "南海新今宮" },
  { line: "nankai-koya", name: "南海天下茶屋" },
  { line: "nankai-koya", name: "岸里玉出" },
  { line: "nankai-koya", name: "帝塚山" },
  { line: "nankai-koya", name: "住吉東" },
  { line: "nankai-koya", name: "沢ノ町" },
  { line: "nankai-koya", name: "我孫子前" },
  { line: "nankai-koya", name: "浅香山" },
  { line: "nankai-koya", name: "堺東" },
  { line: "nankai-koya", name: "南海三国ヶ丘" },
  { line: "nankai-koya", name: "百舌鳥八幡" },
  { line: "nankai-koya", name: "中百舌鳥" },
  // 南海高野線 · P2 白鷺〜天見
  { line: "nankai-koya", name: "白鷺" },
  { line: "nankai-koya", name: "初芝" },
  { line: "nankai-koya", name: "萩原天神" },
  { line: "nankai-koya", name: "北野田" },
  { line: "nankai-koya", name: "狭山" },
  { line: "nankai-koya", name: "大阪狭山市" },
  { line: "nankai-koya", name: "金剛" },
  { line: "nankai-koya", name: "滝谷" },
  { line: "nankai-koya", name: "千代田" },
  { line: "nankai-koya", name: "河内長野" },
  { line: "nankai-koya", name: "三日市町" },
  { line: "nankai-koya", name: "美加の台" },
  { line: "nankai-koya", name: "千早口" },
  { line: "nankai-koya", name: "天見" },
  // 南海本線 · P3 粉浜〜浜寺公園（堺≠堺東、湊は南海キー、住ノ江≠住之江公園）
  { line: "nankai-main", name: "粉浜" },
  { line: "nankai-main", name: "住吉大社" },
  { line: "nankai-main", name: "住ノ江" },
  { line: "nankai-main", name: "七道" },
  { line: "nankai-main", name: "南海堺" },
  { line: "nankai-main", name: "南海湊" },
  { line: "nankai-main", name: "石津川" },
  { line: "nankai-main", name: "諏訪ノ森" },
  { line: "nankai-main", name: "浜寺公園" },
  // 南海本線 · P4 羽衣〜蛸地蔵
  { line: "nankai-main", name: "羽衣" },
  { line: "nankai-main", name: "高石" },
  { line: "nankai-main", name: "北助松" },
  { line: "nankai-main", name: "松ノ浜" },
  { line: "nankai-main", name: "泉大津" },
  { line: "nankai-main", name: "忠岡" },
  { line: "nankai-main", name: "春木" },
  { line: "nankai-main", name: "和泉大宮" },
  { line: "nankai-main", name: "岸和田" },
  { line: "nankai-main", name: "蛸地蔵" },
  // 南海本線 · P5 貝塚〜みさき公園
  { line: "nankai-main", name: "貝塚" },
  { line: "nankai-main", name: "二色浜" },
  { line: "nankai-main", name: "鶴原" },
  { line: "nankai-main", name: "井原里" },
  { line: "nankai-main", name: "泉佐野" },
  { line: "nankai-main", name: "羽倉崎" },
  { line: "nankai-main", name: "岡田浦" },
  { line: "nankai-main", name: "樽井" },
  { line: "nankai-main", name: "尾崎" },
  { line: "nankai-main", name: "鳥取ノ荘" },
  { line: "nankai-main", name: "箱作" },
  { line: "nankai-main", name: "淡輪" },
  { line: "nankai-main", name: "みさき公園" },
  // 近鉄奈良線 · 奈良寄り7（大和西大寺除外）
  { line: "kintetsu-nara", name: "生駒" },
  { line: "kintetsu-nara", name: "東生駒" },
  { line: "kintetsu-nara", name: "富雄" },
  { line: "kintetsu-nara", name: "近鉄学園前" },
  { line: "kintetsu-nara", name: "菖蒲池" },
  { line: "kintetsu-nara", name: "新大宮" },
  { line: "kintetsu-nara", name: "近鉄奈良" },
  // 近鉄奈良線 · 大阪寄り16（E）
  { line: "kintetsu-nara-osaka", name: "大阪難波" },
  { line: "kintetsu-nara-osaka", name: "近鉄日本橋" },
  { line: "kintetsu-nara-osaka", name: "大阪上本町" },
  { line: "kintetsu-nara-osaka", name: "鶴橋" },
  { line: "kintetsu-nara-osaka", name: "近鉄今里" },
  { line: "kintetsu-nara-osaka", name: "布施" },
  { line: "kintetsu-nara-osaka", name: "河内永和" },
  { line: "kintetsu-nara-osaka", name: "河内小阪" },
  { line: "kintetsu-nara-osaka", name: "八戸ノ里" },
  { line: "kintetsu-nara-osaka", name: "若江岩田" },
  { line: "kintetsu-nara-osaka", name: "河内花園" },
  { line: "kintetsu-nara-osaka", name: "東花園" },
  { line: "kintetsu-nara-osaka", name: "瓢箪山" },
  { line: "kintetsu-nara-osaka", name: "枚岡" },
  { line: "kintetsu-nara-osaka", name: "額田" },
  { line: "kintetsu-nara-osaka", name: "石切" },
  // JR学研都市線 · 21（F · 木津・京橋・鴫野除外）
  { line: "jr-gakken", name: "西木津" },
  { line: "jr-gakken", name: "祝園" },
  { line: "jr-gakken", name: "下狛" },
  { line: "jr-gakken", name: "JR三山木" },
  { line: "jr-gakken", name: "同志社前" },
  { line: "jr-gakken", name: "京田辺" },
  { line: "jr-gakken", name: "大住" },
  { line: "jr-gakken", name: "松井山手" },
  { line: "jr-gakken", name: "長尾" },
  { line: "jr-gakken", name: "藤阪" },
  { line: "jr-gakken", name: "津田" },
  { line: "jr-gakken", name: "河内磐船" },
  { line: "jr-gakken", name: "星田" },
  { line: "jr-gakken", name: "寝屋川公園" },
  { line: "jr-gakken", name: "忍ケ丘" },
  { line: "jr-gakken", name: "四条畷" },
  { line: "jr-gakken", name: "野崎" },
  { line: "jr-gakken", name: "住道" },
  { line: "jr-gakken", name: "鴻池新田" },
  { line: "jr-gakken", name: "徳庵" },
  { line: "jr-gakken", name: "放出" },
  // 近鉄大阪線 · 俊徳道〜真菅21（K · 布施・大和八木除外）
  { line: "kintetsu-osaka", name: "俊徳道" },
  { line: "kintetsu-osaka", name: "長瀬" },
  { line: "kintetsu-osaka", name: "弥刀" },
  { line: "kintetsu-osaka", name: "久宝寺口" },
  { line: "kintetsu-osaka", name: "近鉄八尾" },
  { line: "kintetsu-osaka", name: "河内山本" },
  { line: "kintetsu-osaka", name: "高安" },
  { line: "kintetsu-osaka", name: "恩智" },
  { line: "kintetsu-osaka", name: "法善寺" },
  { line: "kintetsu-osaka", name: "堅下" },
  { line: "kintetsu-osaka", name: "安堂" },
  { line: "kintetsu-osaka", name: "河内国分" },
  { line: "kintetsu-osaka", name: "大阪教育大前" },
  { line: "kintetsu-osaka", name: "関屋" },
  { line: "kintetsu-osaka", name: "二上" },
  { line: "kintetsu-osaka", name: "近鉄下田" },
  { line: "kintetsu-osaka", name: "五位堂" },
  { line: "kintetsu-osaka", name: "築山" },
  { line: "kintetsu-osaka", name: "大和高田" },
  { line: "kintetsu-osaka", name: "松塚" },
  { line: "kintetsu-osaka", name: "真菅" },
  // 近鉄大阪線 · K2 桜井〜名張（桜井は近鉄キー）
  { line: "kintetsu-osaka-east", name: "近鉄桜井" },
  { line: "kintetsu-osaka-east", name: "大和朝倉" },
  { line: "kintetsu-osaka-east", name: "長谷寺" },
  { line: "kintetsu-osaka-east", name: "榛原" },
  { line: "kintetsu-osaka-east", name: "室生口大野" },
  { line: "kintetsu-osaka-east", name: "近鉄三本松" },
  { line: "kintetsu-osaka-east", name: "赤目口" },
  { line: "kintetsu-osaka-east", name: "名張" },
  // 近鉄南大阪線 · K3 河堀口〜古市（大阪阿部野橋除外）
  { line: "kintetsu-minami-osaka", name: "河堀口" },
  { line: "kintetsu-minami-osaka", name: "北田辺" },
  { line: "kintetsu-minami-osaka", name: "近鉄今川" },
  { line: "kintetsu-minami-osaka", name: "針中野" },
  { line: "kintetsu-minami-osaka", name: "近鉄矢田" },
  { line: "kintetsu-minami-osaka", name: "河内天美" },
  { line: "kintetsu-minami-osaka", name: "布忍" },
  { line: "kintetsu-minami-osaka", name: "高見ノ里" },
  { line: "kintetsu-minami-osaka", name: "河内松原" },
  { line: "kintetsu-minami-osaka", name: "恵我ノ荘" },
  { line: "kintetsu-minami-osaka", name: "高鷲" },
  { line: "kintetsu-minami-osaka", name: "藤井寺" },
  { line: "kintetsu-minami-osaka", name: "土師ノ里" },
  { line: "kintetsu-minami-osaka", name: "道明寺" },
  { line: "kintetsu-minami-osaka", name: "近鉄古市" },
  // 近鉄南大阪線 · K4 駒ヶ谷〜橿原神宮前（高田市≠大和高田 · 二上山≠二上 · 橿原神宮前は共有id）
  { line: "kintetsu-minami-osaka", name: "駒ヶ谷" },
  { line: "kintetsu-minami-osaka", name: "上ノ太子" },
  { line: "kintetsu-minami-osaka", name: "二上山" },
  { line: "kintetsu-minami-osaka", name: "二上神社口" },
  { line: "kintetsu-minami-osaka", name: "当麻寺" },
  { line: "kintetsu-minami-osaka", name: "磐城" },
  { line: "kintetsu-minami-osaka", name: "尺土" },
  { line: "kintetsu-minami-osaka", name: "高田市" },
  { line: "kintetsu-minami-osaka", name: "浮孔" },
  { line: "kintetsu-minami-osaka", name: "坊城" },
  { line: "kintetsu-minami-osaka", name: "橿原神宮西口" },
  { line: "kintetsu-minami-osaka", name: "橿原神宮前" },
  // 京阪交野線 · J5 宮之阪〜私市（枚方市除外 · 星ヶ丘は京阪キー）
  { line: "keihan-katano", name: "宮之阪" },
  { line: "keihan-katano", name: "星ヶ丘（京阪）" },
  { line: "keihan-katano", name: "村野" },
  { line: "keihan-katano", name: "郡津" },
  { line: "keihan-katano", name: "交野市" },
  { line: "keihan-katano", name: "河内森" },
  { line: "keihan-katano", name: "私市" },
  // 山陽電鉄本線 · R1 西代〜山陽明石（JR寄せ禁止 · 霞ヶ丘は山陽キー）
  { line: "sanyo", name: "西代" },
  { line: "sanyo", name: "板宿" },
  { line: "sanyo", name: "東須磨" },
  { line: "sanyo", name: "須磨寺" },
  { line: "sanyo", name: "山陽須磨" },
  { line: "sanyo", name: "須磨浦公園" },
  { line: "sanyo", name: "山陽塩屋" },
  { line: "sanyo", name: "滝の茶屋" },
  { line: "sanyo", name: "東垂水" },
  { line: "sanyo", name: "山陽垂水" },
  { line: "sanyo", name: "霞ヶ丘（山陽）" },
  { line: "sanyo", name: "舞子公園" },
  { line: "sanyo", name: "西舞子" },
  { line: "sanyo", name: "大蔵谷" },
  { line: "sanyo", name: "人丸前" },
  { line: "sanyo", name: "山陽明石" },
  // 神戸市営地下鉄西神・山手線 · R2 新神戸〜西神中央（三宮除外 · 長田≠大阪 · 板宿は共有id）
  { line: "kobe-subway", name: "新神戸" },
  { line: "kobe-subway", name: "県庁前（神戸）" },
  { line: "kobe-subway", name: "大倉山（神戸）" },
  { line: "kobe-subway", name: "湊川公園" },
  { line: "kobe-subway", name: "上沢" },
  { line: "kobe-subway", name: "長田（神戸）" },
  { line: "kobe-subway", name: "新長田" },
  { line: "kobe-subway", name: "板宿（地下鉄）" },
  { line: "kobe-subway", name: "妙法寺（神戸）" },
  { line: "kobe-subway", name: "名谷" },
  { line: "kobe-subway", name: "総合運動公園" },
  { line: "kobe-subway", name: "学園都市" },
  { line: "kobe-subway", name: "伊川谷" },
  { line: "kobe-subway", name: "西神南" },
  { line: "kobe-subway", name: "西神中央" },
  // JR福知山線 · N9 篠山口〜福知山（新三田以南除外 · 柏原は丹波キー）
  { line: "jr-fukuchiyama", name: "篠山口" },
  { line: "jr-fukuchiyama", name: "丹波大山" },
  { line: "jr-fukuchiyama", name: "下滝" },
  { line: "jr-fukuchiyama", name: "谷川" },
  { line: "jr-fukuchiyama", name: "柏原（丹波）" },
  { line: "jr-fukuchiyama", name: "石生" },
  { line: "jr-fukuchiyama", name: "黒井" },
  { line: "jr-fukuchiyama", name: "市島" },
  { line: "jr-fukuchiyama", name: "福知山" },
  { line: "senboku", name: "深井" },
  { line: "senboku", name: "泉ケ丘（泉北）" },
  { line: "senboku", name: "栂・美木多" },
  { line: "senboku", name: "光明池" },
  { line: "senboku", name: "和泉中央" },
  // 北大阪急行 · S2 緑地公園〜箕面萱野（江坂除外 · 千里中央は北急キー）
  { line: "kitakyu", name: "緑地公園" },
  { line: "kitakyu", name: "千里中央" },
  { line: "kitakyu", name: "桃山台" },
  { line: "kitakyu", name: "箕面船場阪大前" },
  { line: "kitakyu", name: "箕面萱野" },
  // 大阪モノレール本線 · S3 大阪空港〜門真市（乗換はモノレール専用名）
  { line: "osaka-monorail", name: "大阪空港" },
  { line: "osaka-monorail", name: "蛍池（モノレール）" },
  { line: "osaka-monorail", name: "柴原阪大前" },
  { line: "osaka-monorail", name: "少路" },
  { line: "osaka-monorail", name: "千里中央（モノレール）" },
  { line: "osaka-monorail", name: "山田（モノレール）" },
  { line: "osaka-monorail", name: "万博記念公園" },
  { line: "osaka-monorail", name: "宇野辺" },
  { line: "osaka-monorail", name: "南茨木（モノレール）" },
  { line: "osaka-monorail", name: "沢良宜" },
  { line: "osaka-monorail", name: "摂津" },
  { line: "osaka-monorail", name: "南摂津" },
  { line: "osaka-monorail", name: "大日（モノレール）" },
  { line: "osaka-monorail", name: "門真市（モノレール）" },
  { line: "nose", name: "滝山" },
  { line: "nose", name: "絹延橋" },
  { line: "nose", name: "一の鳥居" },
  { line: "nose", name: "畦野" },
  { line: "nose", name: "山下" },
  { line: "nose", name: "笹部" },
  { line: "nose", name: "光風台" },
  { line: "nose", name: "ときわ台" },
  { line: "nose", name: "妙見口" },
  { line: "shintetsu-arima", name: "湊川" },
  { line: "shintetsu-arima", name: "長田" },
  { line: "shintetsu-arima", name: "丸山" },
  { line: "shintetsu-arima", name: "鵯越" },
  { line: "shintetsu-arima", name: "鈴蘭台" },
  { line: "shintetsu-sanda", name: "五社" },
  { line: "shintetsu-sanda", name: "岡場" },
  { line: "shintetsu-sanda", name: "田尾寺" },
  { line: "shintetsu-sanda", name: "二郎" },
  { line: "shintetsu-sanda", name: "道場南口" },
  { line: "shintetsu-sanda", name: "神鉄道場" },
  { line: "shintetsu-sanda", name: "横山" },
  { line: "shintetsu-sanda", name: "三田本町" },
  { line: "shintetsu-sanda", name: "三田" },
  { line: "shintetsu-koen-toshi", name: "フラワータウン" },
  { line: "shintetsu-koen-toshi", name: "南ウッディタウン" },
  { line: "shintetsu-koen-toshi", name: "ウッディタウン中央" },
  { line: "shintetsu-ao", name: "鈴蘭台西口" },
  { line: "shintetsu-ao", name: "西鈴蘭台" },
  { line: "shintetsu-ao", name: "藍那" },
  { line: "shintetsu-ao", name: "木津" },
  { line: "shintetsu-ao", name: "木幡" },
  { line: "shintetsu-ao", name: "栄" },
  { line: "shintetsu-ao", name: "押部谷" },
  { line: "shintetsu-ao", name: "緑が丘" },
  { line: "shintetsu-ao", name: "広野ゴルフ場前" },
  { line: "shintetsu-ao", name: "志染" },
  { line: "hojo", name: "網引" },
  { line: "hojo", name: "田原" },
  { line: "hojo", name: "法華口" },
  { line: "hojo", name: "播磨下里" },
  { line: "hojo", name: "長" },
  { line: "hojo", name: "播磨横田" },
  { line: "hojo", name: "北条町" },
  { line: "jr-kakogawa", name: "加古川" },
  { line: "jr-kakogawa", name: "日岡" },
  { line: "jr-kakogawa", name: "神野" },
  { line: "jr-kakogawa", name: "厄神" },
  { line: "jr-kakogawa", name: "市場" },
  { line: "jr-kakogawa", name: "小野町" },
  { line: "jr-kakogawa", name: "粟生" },
  { line: "jr-kakogawa", name: "河合西" },
  { line: "jr-kakogawa", name: "青野ケ原" },
  { line: "jr-kakogawa", name: "社町" },
  { line: "jr-kakogawa", name: "滝野" },
  { line: "jr-kakogawa", name: "滝" },
  { line: "jr-kakogawa", name: "西脇市" },
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
    // 仮の日本中心 (35,135) を置かない。置くと filterFarSpots が
    // 京都のピンを全部「遠すぎ」と落とす（太秦・等持院の empty_spots 原因）。
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
  // いまメモは正本の下に日付つきで重ねる（土地文ファイルは触らない）
  return applyLandNowNotes(
    withStoryNotes(refineLandProse(ensureLandPresentAnchors(merged))),
  );
}

export function paragraphsFrom(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
