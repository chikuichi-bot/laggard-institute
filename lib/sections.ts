export type SectionId =
  | "home"
  | "news"
  | "antiques"
  | "city"
  | "sea"
  | "apps"
  | "amappola"
  | "map"
  | "contact";

export type NavItem = {
  id: SectionId;
  href: string;
  label: string;
};

export const navItems: NavItem[] = [
  { id: "news", href: "/news", label: "営業日" },
  { id: "antiques", href: "/antiques", label: "古道具" },
  { id: "city", href: "/city", label: "街で見つけたモノ" },
  { id: "sea", href: "/sea", label: "海で見つけたモノ" },
  { id: "apps", href: "/apps", label: "アプリ" },
  { id: "amappola", href: "/amappola", label: "街で拾った言葉" },
  { id: "map", href: "/map", label: "地図" },
  { id: "contact", href: "/contact", label: "連絡" },
];

const minimalNavIds = new Set<SectionId>(["news", "map", "contact"]);

/** 本番は全項目。Lolipop ミニマル公開は営業日・地図・連絡のみ */
export function getNavItems(): NavItem[] {
  if (process.env.NEXT_PUBLIC_LOLIPOP_MINIMAL === "1") {
    return navItems.filter((item) => minimalNavIds.has(item.id));
  }
  return navItems;
}

export type AppPlatform = "web" | "ios" | "android";

export type AppEdition = {
  platform: AppPlatform;
  href: string;
  /** その版の初回公開日（YYYY-MM-DD） */
  releasedAt: string;
  /** App Store / Play の現行バージョン（例: 1.2.11） */
  version?: string;
};

export type AppFriendOffer = {
  /** App Store Offer Code redeem など、無料枠の実URLのみ（推測禁止） */
  url: string;
  /** ボタン主文言。例: 友人 */
  label?: string;
  /** 短い副文言。例: 一年無料 */
  detail?: string;
};

export type AppEntry = {
  /** URL用スラッグ（`/apps/[slug]` · 静的エクスポート対応） */
  slug: string;
  name: string;
  icon?: string;
  /** 一覧カード用の短い一文 */
  description: string;
  /**
   * 個別紹介ページ用。段落の配列。
   * 未設定のときは description を1段落として使う。
   */
  intro?: string[];
  /** 掲載順用。いちばん早い版の公開日 */
  releasedAt: string;
  /**
   * 最新更新日（YYYY-MM-DD）。
   * App Store `currentVersionReleaseDate` など、ストア上の現行版リリース日。
   */
  updatedAt?: string;
  editions: AppEdition[];
  videoBase?: string;
  poster?: string;
  /**
   * 個別紹介ページの画面ギャラリー。
   * App Store 掲載スクリーンショットなど、実在する画像パスのみ。
   */
  gallery?: string[];
  /**
   * 友人向け無料枠があるときだけ設定。
   * 無いアプリには付けない（ボタンも出さない）。
   */
  friendOffer?: AppFriendOffer;
};

export function appPlatformLabel(platform: AppPlatform): string {
  switch (platform) {
    case "web":
      return "Web";
    case "android":
      return "Android";
    case "ios":
      return "iOS";
  }
}

export function appOpenLabel(platform: AppPlatform): string {
  switch (platform) {
    case "web":
      return "Webで開く";
    case "android":
      return "Google Playで開く";
    case "ios":
      return "App Storeで開く";
  }
}

export function formatAppReleasedAt(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return `${y}年${m}月${d}日`;
}

/** 制作日順（新しいものが先） */
export function sortAppsByReleasedAt<T extends AppEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    if (a.releasedAt === b.releasedAt) {
      return a.name.localeCompare(b.name, "ja");
    }
    return a.releasedAt < b.releasedAt ? 1 : -1;
  });
}

const PLATFORM_LINE_ORDER: AppPlatform[] = ["ios", "android", "web"];

/** Connect風の副行（例: iOS 1.2.11 · Android · Web） */
export function formatAppPlatformLine(editions: AppEdition[]): string {
  return [...editions]
    .sort(
      (a, b) =>
        PLATFORM_LINE_ORDER.indexOf(a.platform) -
        PLATFORM_LINE_ORDER.indexOf(b.platform),
    )
    .map((edition) => {
      const label = appPlatformLabel(edition.platform);
      return edition.version ? `${label} ${edition.version}` : label;
    })
    .join(" · ");
}

export function primaryAppHref(editions: AppEdition[]): string | undefined {
  for (const platform of PLATFORM_LINE_ORDER) {
    const hit = editions.find((e) => e.platform === platform);
    if (hit) return hit.href;
  }
  return undefined;
}

export function appHref(slug: string): string {
  return `/apps/${slug}`;
}

/** 個別紹介ページに出す段落（intro 優先 · なければ description） */
export function appIntroParagraphs(app: AppEntry): string[] {
  if (app.intro && app.intro.length > 0) return app.intro;
  return [app.description];
}

/** Lagado 自作（表示は制作日の新しい順） */
export const apps: AppEntry[] = [
  {
    slug: "past-today",
    name: "今日の過去新聞",
    icon: "/icons/past-today.png",
    description: "今日の月日が、一件を差し出す。新聞の体で読む。",
    intro: [
      "「今日の過去新聞」は、きょうの月と日にまつわる過去の出来事を、新聞記事のような形で読む iPhone アプリです。ニュース速報や百科事典ではなく、同じ日付に起きたことを、一枚の紙面のように味わうためのものです。",
      "歴史が好きな人、日付の話題を探している人、朝や夜に短い読みものをしたい人向けです。長く勉強する必要はありません。開いて、きょうの一件を読むだけで使えます。",
      "使い方はかんたんです。アプリを開くと、きょうの月日にあわせた記事が届きます。読む・閉じる——それだけで、日付と過去がそっとつながります。",
    ],
    gallery: ["/apps/past-today/01.jpg", "/apps/past-today/02.jpg"],
    releasedAt: "2026-11-03",
    updatedAt: "2026-11-03",
    editions: [
      {
        platform: "ios",
        href: "https://apps.apple.com/jp/app/%E4%BB%8A%E6%97%A5%E3%81%AE%E9%81%8E%E5%8E%BB%E6%96%B0%E8%81%9E/id6828013368",
        releasedAt: "2026-11-03",
        version: "1.1",
      },
    ],
  },
  {
    slug: "sorakara",
    name: "そらから",
    /** ?v= は Cloudflare が旧グレーPNGをキャッシュしていたためのバスト（2026-10-11） */
    icon: "/icons/sorakara.png?v=20261011",
    description:
      "空の散歩。ただ浮いて、街を上から眺めます。たまに、新しい発見があります。",
    intro: [
      "「そらから」は、空の上から街や景色を眺めるための iPhone アプリです。ナビやルート案内の地図ではなく、浮いて眺める「空の散歩」を楽しむアプリだと思ってください。",
      "行き先を決めずにぶらぶらしたい人、見慣れた町を別の角度から見たい人、短い休憩に画面のなかで散歩したい人向けです。ゲームの得点競争や複雑な設定はありません。",
      "開いたら、上空に浮いて景色を見渡します。動かしたり眺めたりしているうちに、ときどき思いがけない発見があります。目的地へ急がなくていい——それが使い方の中心です。",
    ],
    gallery: ["/apps/sorakara/01.jpg", "/apps/sorakara/02.jpg"],
    releasedAt: "2026-10-09",
    updatedAt: "2026-11-03",
    editions: [
      {
        platform: "ios",
        href: "https://apps.apple.com/jp/app/%E3%81%9D%E3%82%89%E3%81%8B%E3%82%89/id6819470015",
        releasedAt: "2026-10-09",
        version: "1.6.2",
      },
    ],
    /** App Store Connect カスタムオファーコード SORAKARA1Y（2026-12-31 まで · 最大500） */
    friendOffer: {
      url: "https://apps.apple.com/redeem?ctx=offercodes&id=6819470015&code=SORAKARA1Y",
      label: "友人",
      detail: "一年無料",
    },
  },
  {
    slug: "omikuji-bunko",
    name: "おみくじ文庫",
    icon: "/icons/omikuji-bunko.png",
    description:
      "青空文庫のなかから、偶然の一節を引く小さな図書館。言葉の漂着物を、毎日ひとつ。",
    intro: [
      "「おみくじ文庫」は、青空文庫（著作権の切れた文学作品を公開している図書館）のなかから、偶然の一節を引いて読むアプリ／Web です。本を最初から最後まで読むのではなく、おみくじのように「きょうの一文」が手元に来ます。",
      "長い読書の時間が取れない人、文学に気軽に触れたい人、毎日ひとつだけ言葉が欲しい人向けです。どの作品を選ぶか迷わなくて大丈夫です。",
      "開いて引くと、物語や詩の一部分が表示されます。スマホのアプリでも、ブラウザ（Web）でも使えます。読む・また引く——その繰り返しで使います。",
    ],
    gallery: [
      "/apps/omikuji-bunko/01.jpg",
      "/apps/omikuji-bunko/02.jpg",
      "/apps/omikuji-bunko/poster.jpg",
    ],
    releasedAt: "2026-03-03",
    updatedAt: "2026-11-02",
    editions: [
      {
        platform: "web",
        href: "https://lagado.jp/omikuji_bunko/",
        releasedAt: "2026-03-03",
      },
      {
        platform: "ios",
        href: "https://apps.apple.com/jp/app/%E3%81%8A%E3%81%BF%E3%81%8F%E3%81%98%E6%96%87%E5%BA%AB/id6760742804",
        releasedAt: "2026-03-26",
        version: "1.3.1",
      },
      {
        platform: "android",
        href: "https://play.google.com/store/apps/details?id=jp.lagado.omikuji",
        releasedAt: "2026-04-30",
      },
    ],
    /** App Store Connect カスタムオファーコード OMIKUJI1Y（2026-12-31 まで · 最大500） */
    friendOffer: {
      url: "https://apps.apple.com/redeem?ctx=offercodes&id=6760742804&code=OMIKUJI1Y",
      label: "友人",
      detail: "一年無料",
    },
  },
  {
    slug: "literary-fragments",
    name: "Fragments - 文学の断片",
    icon: "/icons/literary-fragments.png",
    description: "世界文学の断片を、気配とともに巡るアプリ。",
    intro: [
      "「Fragments（フラグメンツ）— 文学の断片」は、世界の文学作品から短い一節（断片）を拾って読むアプリです。一冊まるごと読む読書アプリではなく、切れ端のような文章に、ちょっと出会うためのものです。",
      "忙しい日に短い読みものが欲しい人、外国文学や昔の文章に軽く触れてみたい人向けです。あらすじを覚えたり、感想を書かせたりはしません。",
      "アプリを開くと、短い文学の一節が表示されます。読んで、次の断片へ進む——それだけで使えます。長い時間を確保しなくても始められます。",
    ],
    gallery: [
      "/apps/literary-fragments/01.jpg",
      "/apps/literary-fragments/02.jpg",
    ],
    releasedAt: "2026-04-10",
    updatedAt: "2026-09-29",
    editions: [
      {
        platform: "ios",
        href: "https://apps.apple.com/jp/app/fragments-%E6%96%87%E5%AD%A6%E3%81%AE%E6%96%AD%E7%89%87/id6761637530",
        releasedAt: "2026-04-10",
        version: "1.1.5",
      },
      {
        platform: "android",
        href: "https://play.google.com/store/apps/details?id=jp.lagado.literaryfragments",
        releasedAt: "2026-08-13",
      },
    ],
  },
  {
    slug: "wasure-memo",
    name: "わすれメモ",
    icon: "/icons/wasure-memo.png",
    description: "思いついたらメモして、あとは忘れて大丈夫。お店の近くで、そっと知らせます。",
    intro: [
      "「わすれメモ」は、思いついた買い物や用事をメモしておき、そのお店の近くに来たときだけお知らせしてくれる iPhone アプリです。いつも画面を見なくてもいい、「忘れても大丈夫なメモ」です。",
      "買い物リストを覚えきれない人、用事を頭の中で抱えたくない人向けです。リマインダーを時刻だけで鳴らすのではなく、「その場所の近く」で思い出させてほしいときに向きます。",
      "使い方は、買いたいものや用事を書いて場所と結びつけておくだけです。あとは普通に過ごし、お店の近くに来るとアプリがそっと知らせます。",
    ],
    gallery: ["/apps/wasure-memo/01.jpg", "/apps/wasure-memo/02.jpg"],
    releasedAt: "2026-08-02",
    updatedAt: "2026-09-09",
    editions: [
      {
        platform: "ios",
        href: "https://apps.apple.com/jp/app/%E3%82%8F%E3%81%99%E3%82%8C%E3%83%A1%E3%83%A2-%E5%BF%98%E3%82%8C%E3%81%A6%E3%81%84%E3%81%84%E8%B2%B7%E3%81%84%E3%82%82%E3%81%AE%E3%83%A1%E3%83%A2/id6794892342",
        releasedAt: "2026-08-02",
        version: "1.3.2",
      },
    ],
    /**
     * IAP 買い切り「フル機能アンロック」の友人向けオファーコード FRIEND2026
     * （オファー名 FRIEND_FREE_2026 · 期限 2026-10-31 · 最大500 · 非消耗型 ¥300 相当）
     */
    friendOffer: {
      url: "https://apps.apple.com/redeem?ctx=offercodes&id=6794892342&code=FRIEND2026",
      label: "友人",
      detail: "買い切り無料",
    },
  },
  {
    slug: "wazukana-byo",
    name: "相対性理論計",
    icon: "/icons/wazukana-byo.png",
    description: "万歩計の代わりに、時間のずれを。式は本物。測りはざっくり。",
    intro: [
      "「相対性理論計」は、歩いたり高いところにいたりしたときに、「時間の進み方がごくわずかにずれる」様子をざっくり見積もる iPhone アプリです。万歩計が歩数を数えるように、こちらはアインシュタインの相対性理論（高い場所では時間がわずかに速く進む、という考え方）に沿った「わずかな秒」を表示します。",
      "科学や散歩が好きな人、むずかしい話を遊びとして触ってみたい人向けです。学校のテスト用でも、精密な実験用でもありません。「だいたいこんな感じ」を楽しむアプリです。",
      "使い方は、普段どおり持ち歩く・歩くことです。アプリが動きや高さをもとに、時間のずれの目安を見せてくれます。式は本物ですが、測り方はざっくり——そのつもりで読んでください。",
    ],
    gallery: ["/apps/wazukana-byo/01.jpg", "/apps/wazukana-byo/02.jpg"],
    releasedAt: "2026-08-25",
    updatedAt: "2026-09-17",
    editions: [
      {
        platform: "ios",
        href: "https://apps.apple.com/jp/app/%E7%9B%B8%E5%AF%BE%E6%80%A7%E7%90%86%E8%AB%96%E8%A8%88/id6804165772",
        releasedAt: "2026-08-25",
        version: "2.2",
      },
    ],
  },
  {
    slug: "4s-camera",
    name: "4S カメラ",
    icon: "/icons/4s-camera.png",
    description: "いまの iPhone では切れない補正を、切るためのカメラ。綺麗にするアプリではありません。",
    intro: [
      "「4S カメラ」は、いまの iPhone が写真を自動で明るく・きれいに整えてしまう補正を、できるだけ切って撮るためのカメラアプリです。美肌や盛りのための加工アプリではありません。",
      "撮ったままの見え方に近づけたい人、自動補正が強すぎると感じる人向けです。「もっと綺麗に」したい人より、「余計な整えを減らしたい」人に向きます。",
      "アプリを開いて写真を撮る、それが基本の使い方です。加工を足すのではなく、補正をほどく方向のカメラだと思って使ってください。",
    ],
    gallery: ["/apps/4s-camera/01.jpg", "/apps/4s-camera/02.jpg"],
    releasedAt: "2026-09-03",
    updatedAt: "2026-10-07",
    editions: [
      {
        platform: "ios",
        href: "https://apps.apple.com/jp/app/4s-%E3%82%AB%E3%83%A1%E3%83%A9/id6803322523",
        releasedAt: "2026-09-03",
        version: "1.0.4",
      },
    ],
  },
];

/** 委託制作（自作アプリと分けて掲載） */
export const commissionedApps: AppEntry[] = [
  {
    slug: "tsuitara-memo",
    name: "ついたらメモ",
    icon: "/icons/tsuitara-memo.png",
    description: "次の訪問先まで、忘れていい。着いたら、その場所のことだけ出ます。",
    intro: [
      "「ついたらメモ」は、次に行く場所での用事を先に書いておき、その場所に着いたときだけメモを出してくれる iPhone アプリです。移動中はずっと忘れてもよく、到着したら必要なことだけが戻ってきます。",
      "訪問先での確認事項が多い人、移動中に頭を空けておきたい人向けです（依頼を受けて制作した委託アプリです）。時刻アラームではなく、「着いたら」思い出したいときに向きます。",
      "使い方は、行き先とメモをセットして出かけるだけです。着くまでは出さず、到着のタイミングでその場所のメモだけが表示されます。",
    ],
    gallery: ["/apps/tsuitara-memo/01.jpg", "/apps/tsuitara-memo/02.jpg"],
    releasedAt: "2026-08-27",
    updatedAt: "2026-09-10",
    editions: [
      {
        platform: "ios",
        href: "https://apps.apple.com/jp/app/%E3%81%A4%E3%81%84%E3%81%9F%E3%82%89%E3%83%A1%E3%83%A2/id6804939168",
        releasedAt: "2026-08-27",
        version: "1.0.4",
      },
    ],
  },
  {
    slug: "abomon-game",
    name: "アボモンゲーム",
    icon: "/icons/abomon-game.png",
    description: "アボカドかモンキーか。ゆるくてふしぎな、タッチのゲーム。",
    intro: [
      "「アボモンゲーム」は、アボカドとモンキー（サル）が登場する、ゆるくて不思議なタッチゲームです。難しいルール説明を読まなくても、画面を触りながら遊べます。",
      "短時間の休憩に遊びたい人、得点を追いすぎない軽いゲームが好きな人向けです（依頼を受けて制作した委託アプリです）。真剣勝負というより、ぽんぽん触る感触を楽しむタイプです。",
      "アプリを開いて画面をタッチして遊びます。長いチュートリアルはありません。気軽に起動して、飽きたら閉じる——それで十分です。",
    ],
    gallery: ["/apps/abomon-game/01.jpg", "/apps/abomon-game/02.jpg"],
    releasedAt: "2026-07-20",
    updatedAt: "2026-08-20",
    editions: [
      {
        platform: "ios",
        href: "https://apps.apple.com/jp/app/%E3%82%A2%E3%83%9C%E3%83%A2%E3%83%B3%E3%82%B2%E3%83%BC%E3%83%A0/id6767998877",
        releasedAt: "2026-07-20",
        version: "1.1.2",
      },
      {
        platform: "android",
        href: "https://play.google.com/store/apps/details?id=jp.lagado.abomongame",
        releasedAt: "2026-08-10",
      },
    ],
  },
];

export type CatalogApp = AppEntry & { commissioned: boolean };

/** 自作 + 委託の全カタログ */
export function allCatalogApps(): CatalogApp[] {
  return [
    ...apps.map((app) => ({ ...app, commissioned: false })),
    ...commissionedApps.map((app) => ({ ...app, commissioned: true })),
  ];
}

export function getCatalogApp(slug: string): CatalogApp | undefined {
  return allCatalogApps().find((app) => app.slug === slug);
}

export function appStaticParams(): { slug: string }[] {
  return allCatalogApps().map((app) => ({ slug: app.slug }));
}
