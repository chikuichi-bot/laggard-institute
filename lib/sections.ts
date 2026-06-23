export type SectionId =
  | "home"
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
  { id: "home", href: "/", label: "はじめに" },
  { id: "antiques", href: "/antiques", label: "古道具" },
  { id: "city", href: "/city", label: "街で拾った物" },
  { id: "sea", href: "/sea", label: "海で拾ったもの" },
  { id: "apps", href: "/apps", label: "アプリ" },
  { id: "amappola", href: "/amappola", label: "アマポーラ詩集" },
  { id: "map", href: "/map", label: "地図" },
  { id: "contact", href: "/contact", label: "コンタクト" },
];

export const apps = [
  {
    name: "おみくじ文庫",
    href: "https://lagado.jp/omikuji/",
    icon: "/icons/omikuji-bunko.png",
    description:
      "青空文庫のなかから、偶然の一節を引く小さな図書館。言葉の漂着物を、毎日ひとつ。",
  },
  {
    name: "Literary Fragments",
    href: "https://lagado.jp/fragments/",
    icon: "/icons/literary-fragments.png",
    description: "世界文学の断片を、気配とともに巡るアプリ。",
  },
  {
    name: "Abomon",
    href: "#",
    description: "異形と出会う、小さなゲーム。工房の実験室から。",
  },
];
