import type { Metadata } from "next";
import { Shippori_Mincho, Zen_Kaku_Gothic_New } from "next/font/google";

const display = Shippori_Mincho({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mishiranu-display",
  display: "swap",
});

const sans = Zen_Kaku_Gothic_New({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mishiranu-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "見知らぬ駅 — Lagado Lab",
  description:
    "降りた駅の、徒歩圏だけを、物語にする。思いがけない寄り道のプロトタイプ。",
};

export default function MishiranuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${display.variable} ${sans.variable}`}>{children}</div>
  );
}
