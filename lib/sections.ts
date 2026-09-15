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

export type AppEntry = {
  name: string;
  icon?: string;
  description: string;
  /** 掲載順用。いちばん早い版の公開日 */
  releasedAt: string;
  editions: AppEdition[];
  videoBase?: string;
  poster?: string;
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
export function sortAppsByReleasedAt(entries: AppEntry[]): AppEntry[] {
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

/** Lagado 自作（表示は制作日の新しい順） */
export const apps: AppEntry[] = [
  {
    name: "おみくじ文庫",
    icon: "/icons/omikuji-bunko.png",
    description:
      "青空文庫のなかから、偶然の一節を引く小さな図書館。言葉の漂着物を、毎日ひとつ。",
    releasedAt: "2026-03-03",
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
        version: "1.2.11",
      },
      {
        platform: "android",
        href: "https://play.google.com/store/apps/details?id=jp.lagado.omikuji",
        releasedAt: "2026-04-30",
      },
    ],
  },
  {
    name: "Fragments - 文学の断片",
    icon: "/icons/literary-fragments.png",
    description: "世界文学の断片を、気配とともに巡るアプリ。",
    releasedAt: "2026-04-10",
    editions: [
      {
        platform: "ios",
        href: "https://apps.apple.com/jp/app/fragments-%E6%96%87%E5%AD%A6%E3%81%AE%E6%96%AD%E7%89%87/id6761637530",
        releasedAt: "2026-04-10",
        version: "1.1.4",
      },
      {
        platform: "android",
        href: "https://play.google.com/store/apps/details?id=jp.lagado.literaryfragments",
        releasedAt: "2026-08-13",
      },
    ],
  },
  {
    name: "わすれメモ",
    icon: "/icons/wasure-memo.png",
    description: "思いついたらメモして、あとは忘れて大丈夫。お店の近くで、そっと知らせます。",
    releasedAt: "2026-08-02",
    editions: [
      {
        platform: "ios",
        href: "https://apps.apple.com/jp/app/%E3%82%8F%E3%81%99%E3%82%8C%E3%83%A1%E3%83%A2-%E5%BF%98%E3%82%8C%E3%81%A6%E3%81%84%E3%81%84%E8%B2%B7%E3%81%84%E3%82%82%E3%81%AE%E3%83%A1%E3%83%A2/id6794892342",
        releasedAt: "2026-08-02",
        version: "1.3.2",
      },
    ],
  },
  {
    name: "相対性理論計",
    icon: "/icons/wazukana-byo.png",
    description: "万歩計の代わりに、時間のずれを。式は本物。測りはざっくり。",
    releasedAt: "2026-08-25",
    editions: [
      {
        platform: "ios",
        href: "https://apps.apple.com/jp/app/%E7%9B%B8%E5%AF%BE%E6%80%A7%E7%90%86%E8%AB%96%E8%A8%88/id6804165772",
        releasedAt: "2026-08-25",
        version: "2.0",
      },
    ],
  },
  {
    name: "ついたらメモ",
    icon: "/icons/tsuitara-memo.png",
    description: "次の訪問先まで、忘れていい。着いたら、その場所のことだけ出ます。",
    releasedAt: "2026-08-27",
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
    name: "4S カメラ",
    icon: "/icons/4s-camera.png",
    description: "いまの iPhone では切れない補正を、切るためのカメラ。綺麗にするアプリではありません。",
    releasedAt: "2026-09-03",
    editions: [
      {
        platform: "ios",
        href: "https://apps.apple.com/jp/app/4s-%E3%82%AB%E3%83%A1%E3%83%A9/id6803322523",
        releasedAt: "2026-09-03",
        version: "1.0.2",
      },
    ],
  },
];

/** 委託制作（自作アプリと分けて掲載） */
export const commissionedApps: AppEntry[] = [
  {
    name: "アボモンゲーム",
    icon: "/icons/abomon-game.png",
    description: "アボカドかモンキーか。ゆるくてふしぎな、タッチのゲーム。",
    releasedAt: "2026-07-20",
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
