import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "./lab/mishiranu-eki/IosInstall";

export const metadata: Metadata = {
  title: "見知らぬ駅",
  description:
    "知らない駅に降りる。土地の歴史と今をガイダンスで聴きながら、小回り、大回りして散策する。",
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
