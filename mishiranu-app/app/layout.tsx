import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "見知らぬ駅",
  description:
    "降りた駅の、徒歩圏だけを、物語にする。思いがけない寄り道のプロトタイプ。",
  applicationName: "見知らぬ駅",
  appleWebApp: {
    capable: true,
    title: "見知らぬ駅",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5eedc",
  colorScheme: "light",
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
