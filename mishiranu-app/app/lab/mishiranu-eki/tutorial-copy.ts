/** チュートリアル／ホームページ（orikata）共通の文。ここが正本。 */

export type TutorialStepCopy = {
  title: string;
  body: string;
};

export type TutorialPageCopy = {
  kicker?: string;
  title: string;
  bodies: string[];
  quote?: string;
  quoteBy?: string;
  imageSrc?: string;
  imageAlt?: string;
  steps?: TutorialStepCopy[];
  showBrand?: boolean;
};

export const TUTORIAL_PAGES: TutorialPageCopy[] = [
  {
    showBrand: true,
    title: "知らない駅に降りる",
    bodies: [
      "名前だけ知っている駅に、私は降りる。",
      "空っぽの名前だった駅が、私の散歩道になる。",
    ],
  },
  {
    kicker: "はじまり",
    title: "名前を知って、見なくなった駅",
    quote:
      "子どもに「あれは鳥だよ」と言葉を教えたその日から、子どもはもう、あの鳥を見なくなってしまいます。",
    quoteBy: "── ジッドゥ・クリシュナムルティ",
    bodies: [
      "電車の窓に、知らない駅名が何度も流れます。私はその名前を読み、それで分かったつもりになって、降りません。",
      "名前だけが残り、その土地の姿を、私は一度も見ていない。駅は、私にとって存在しないもののようになっていました。",
    ],
  },
  {
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
    kicker: "なにができるか · 02",
    title: "名前の奥から、声が聞こえる",
    bodies: [
      "改札を出て、イヤホンをつける。散歩道の案内を開くと、この土地の成り立ちと、いまの空気を、声で読み上げてくれる。",
      "スマホはポケットにしまって、私は顔を上げる。聴いているうちに、ただの文字だった名前に、目の前の川や坂が重なっていく。",
    ],
    imageSrc: "/story/orikata/land-fujinomori.png",
    imageAlt: "土地の案内と読み上げ",
  },
  {
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
    kicker: "使い方",
    title: "同じ名前が、違って見える",
    bodies: [
      "帰りの電車で、私はその駅名をもう一度読む。同じ名前なのに、もう空っぽではない。そこには、私の歩いた散歩道がある。",
    ],
    steps: [
      {
        title: "知らない駅に降りる",
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
