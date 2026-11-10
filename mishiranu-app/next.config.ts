import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            // Location is core to the arrival flow; allow same-tab and embeds.
            key: "Permissions-Policy",
            value: "geolocation=*",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
