import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ラガード研究所",
  description:
    "古道具と、街や海で拾ったものと、言葉の標本。淡嶋健仁の工房。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
