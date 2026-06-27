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
  { id: "news", href: "/news", label: "ニュース" },
  { id: "antiques", href: "/antiques", label: "古道具" },
  { id: "city", href: "/city", label: "街で見つけたモノ" },
  { id: "sea", href: "/sea", label: "海で見つけたモノ" },
  { id: "apps", href: "/apps", label: "アプリ" },
  { id: "amappola", href: "/amappola", label: "街で拾った言葉" },
  { id: "map", href: "/map", label: "地図" },
  { id: "contact", href: "/contact", label: "連絡" },
];

export const apps = [
  {
    name: "おみくじ文庫",
    href: "https://apps.apple.com/jp/app/%E3%81%8A%E3%81%BF%E3%81%8F%E3%81%98%E6%96%87%E5%BA%AB/id6760742804",
    icon: "/icons/omikuji-bunko.png",
    description:
      "青空文庫のなかから、偶然の一節を引く小さな図書館。言葉の漂着物を、毎日ひとつ。",
  },
  {
    name: "Literary Fragments",
    href: "https://apps.apple.com/jp/app/fragments-literary-quotes/id6761637530",
    icon: "/icons/literary-fragments.png",
    description: "世界文学の断片を、気配とともに巡るアプリ。",
  },
];
