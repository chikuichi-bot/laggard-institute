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
      "今日の月日が、一件を差し出す。新聞の体で読む、小さな過去の窓口です。",
      "カレンダーをめくるように、同じ月日に起きた出来事が、紙面のような気配で届きます。速報でも年表でもなく、いまこの日に寄り添う、ひとつの記事として。",
      "ラガード研究所がつくった、読むための静かなアプリです。",
    ],
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
      "空の散歩。ただ浮いて、街を上から眺めます。たまに、新しい発見があります。",
      "目的地へ急ぐ地図ではなく、上から世界をゆっくり見るためのアプリです。雲のあいだを漂うように、見慣れた景色の輪郭がやわらかく変わります。",
      "操作は少なめ。浮いて、眺めて、ときどき立ち止まる——その繰り返しが、このアプリの本体です。",
    ],
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
      "青空文庫のなかから、偶然の一節を引く小さな図書館です。",
      "ページをめくるのではなく、おみくじのように言葉が手元へ来ます。長い物語の途中でも、短い詩でも、今日のための漂着物として、ひとつだけ。",
      "Web・iOS・Android で同じ気配を保てるようにしています。静かな読書の入口として、どうぞ。",
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
      "世界文学の断片を、気配とともに巡るアプリです。",
      "作品の全体を一気に読むのではなく、切れ端のような一節に出会うための場所。翻訳や時代をまたいで、言葉の温度だけが手元に残ります。",
      "Fragments は、読む速度を落とすための小さな装置です。忙しい日ほど、短い断片のほうが届きやすいことがあります。",
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
      "思いついたらメモして、あとは忘れて大丈夫。お店の近くで、そっと知らせます。",
      "買い物リストを握りしめたまま歩き回る代わりに、場所に紐づけて預けておくメモです。頭の中は空けたまま、必要なときだけ思い出が戻ってくるように。",
      "忘れてもいい設計——それがわすれメモの中心にあります。",
    ],
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
      "万歩計の代わりに、時間のずれを測るアプリです。式は本物。測りはざっくり。",
      "歩いた高さや動きから、相対論の式 Δt ≈ t·gh/c² に沿った「わずかな秒」を見積もります。厳密な実験装置ではなく、日常の散歩にのせる小さな観測です。",
      "数字の正しさより、時間のずれを想像する余白を残すために作りました。",
    ],
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
      "いまの iPhone では切れない補正を、切るためのカメラです。綺麗にするアプリではありません。",
      "明るさや色を整えてくれる便利さをいったん外し、撮ったままの気配に近づけることを狙っています。加工の層を足すのではなく、余計な補正をほどく方向です。",
      "きれいさより、見え方の選択。4S カメラは、そのための小さなスイッチです。",
    ],
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
      "次の訪問先まで、忘れていい。着いたら、その場所のことだけ出ます。",
      "移動中に頭を占有しないためのメモです。行き先に紐づけておき、到着の気配とともに必要なことだけが戻ってきます。",
      "委託制作として、現場の「着いたら思い出す」を素直な形にしたアプリです。",
    ],
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
      "アボカドかモンキーか。ゆるくてふしぎな、タッチのゲームです。",
      "勝ち負けを急かさない遊び方で、画面をぽんぽん触りながら不思議なテンポに乗れます。説明より感触が先に来るタイプです。",
      "委託制作の一本。短時間の休憩に、ちょうどいい軽さがあります。",
    ],
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
