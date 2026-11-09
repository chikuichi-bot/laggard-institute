import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "見知らぬ駅 — Lagado Lab",
  description:
    "降りた駅の、徒歩圏だけを、物語にする。思いがけない寄り道のプロトタイプ。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
