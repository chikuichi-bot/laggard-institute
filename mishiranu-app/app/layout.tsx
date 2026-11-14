import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "./lab/mishiranu-eki/IosInstall";

export const metadata: Metadata = {
  title: "見知らぬ駅",
  description:
    "名前だけ知っている駅に、私は降りる。名前だけのからっぽだった駅が、私の散歩道になる。",
  applicationName: "見知らぬ駅",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "見知らぬ駅",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
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
      <body style={{ margin: 0 }}>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
