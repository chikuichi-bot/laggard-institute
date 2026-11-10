import type { NextConfig } from "next";
import path from "path";

const iosExport = process.env.MISHIRANU_IOS_EXPORT === "1";

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {
    root: path.join(__dirname),
  },
  // Capacitor loads files from the app bundle (no Cursor Apps / remote host).
  ...(iosExport
    ? {
        output: "export" as const,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
  ...(!iosExport
    ? {
        async headers() {
          return [
            {
              source: "/:path*",
              headers: [
                {
                  key: "Permissions-Policy",
                  value: "geolocation=*",
                },
              ],
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
