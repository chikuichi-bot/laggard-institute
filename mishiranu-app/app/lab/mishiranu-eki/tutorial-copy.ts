/** チュートリアル／ホームページ（orikata）共通の文。ここが正本。 */

export type TutorialStepCopy = {
  title: string;
  body: string;
};

export type TutorialVerseMotion = "lines" | "chars" | "curtain" | "window";

export type TutorialPageCopy = {
  kicker?: string;
  title: string;
  bodies: string[];
  quote?: string;
  quoteBy?: string;
  imageSrc?: string;
  imageAlt?: string;
  steps?: TutorialStepCopy[];
  /** 「見知らぬ駅」ブランド。詩のページには出さない（その次から） */
  showBrand?: boolean;
  /** 縦書き本文（右→左の3列）。あるときは title/bodies よりこちらを表に出す */
  verseLines?: readonly string[];
  verseMotion?: TutorialVerseMotion;
};

/** トップの縦書き3列（ユーザー原文のまま · 右→左） */
export const COMMUTE_VERSE_LINES = [
  "夜の京阪電車",
  "淀屋橋駅で特急の一番前運転席の反対側に座る",
  "駅が通過していき街の明かりが流れていく",
] as const;

/** トップ縦書きモーション（2026-11-13 淡島様 · 4 · 窓の通過） */
export const COMMUTE_VERSE_MOTION: TutorialVerseMotion = "window";

export const TUTORIAL_PAGES: TutorialPageCopy[] = [
  {
    showBrand: false,
    title: "知らない駅に降りてみる",
    bodies: [],
    verseLines: COMMUTE_VERSE_LINES,
    verseMotion: COMMUTE_VERSE_MOTION,
  },
  {
    showBrand: true,
    title: "知らない駅に降りてみる",
    bodies: [
      "名前だけ知っている駅に、私は降りる。",
      "名前だけのからっぽだった駅が、私の散歩道になる。",
    ],
  },
  {
    showBrand: true,
    kicker: "はじまり",
    title: "名前を知って、見なくなった駅",
    quote:
      "子どもに「あれは鳥だよ」と言葉を教えたその日から、子どもはもう、あの鳥を見なくなってしまいます。",
    quoteBy: "── ジッドゥ・クリシュナムルティ",
    bodies: [
      "いつもは、その名前を読むだけで通り過ぎる。分かったつもりになって、降りない。",
      "名前だけが残り、その土地の姿を、私は一度も見ていない。駅は、私にとって存在しないもののようになっていました。",
    ],
  },
  {
    showBrand: true,
    kicker: "なにができるか · 01",
    title: "ホームに、一度降りる",
    bodies: [
      "ドアが開く。知らない駅のホームに、私は一度降りる。次の電車まで、まだ少し時間がある。",
      "このアプリを開いて、いまいる駅を確かめる。まず届くのは、この土地にまつわる物語のゆかりがひとかけら。ここから、空っぽだった駅名が散歩道へと変わっていく。",
    ],
    imageSrc: "/story/orikata/arrive-yodo.png",
    imageAlt: "到着確認の画面",
  },
  {
    showBrand: true,
    kicker: "なにができるか · 02",
    title: "土地の案内を声で聴く",
    bodies: [
      "改札を出て、イヤホンをつける。散歩道の案内を開くと、この土地の成り立ちと、いまの空気を、声で読み上げてくれる。",
      "スマホはポケットにしまって、私は顔を上げる。聴いているうちに、ただの文字だった名前に、目の前の川や坂が重なっていく。",
    ],
    imageSrc: "/story/orikata/land-fujinomori.png",
    imageAlt: "土地の案内と読み上げ",
  },
  {
    showBrand: true,
    kicker: "なにができるか · 03",
    title: "歩いたところが、道になる",
    bodies: [
      "地図をひとつ確かめて、少し回り道をする。最短で急がなくてよい。橋や田畑の道、境内や川辺など、無駄に見える寄り道こそが、このアプリの魅力です。",
      "見たことがあるようで、見たことのない角を曲がり、駅へ戻る。歩いたぶんだけ、名前は散歩道になっていく。",
    ],
    imageSrc: "/story/orikata/map-yodo.png",
    imageAlt: "徒歩圏の地図と動線",
  },
  {
    showBrand: true,
    kicker: "使い方",
    title: "同じ名前が、違って見える",
    bodies: [
      "帰りの電車で、私はその駅名をもう一度読む。同じ名前なのに、もう空っぽではない。そこには、私の歩いた散歩道がある。",
    ],
    steps: [
      {
        title: "知らない駅に降りてみる",
        body: "現在地から探すか、気になっていた駅名を入れる。",
      },
      {
        title: "物語のゆかりを読む",
        body: "土地にまつわるひとかけらを読む。ここまでは無料。",
      },
      {
        title: "散歩道を開く",
        body: "コインを1枚使って、徒歩圏の散歩道の案内をつくる。一度つくった駅は端末に残り、開き直しにコインはいらない。",
      },
      {
        title: "聴きながら歩き、駅へ帰る",
        body: "土地の歴史と今を耳でたどり、無駄な寄り道をして同じ駅へ戻る。",
      },
    ],
  },
];
