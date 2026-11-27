import type { NextConfig } from "next";

const lolipopExport = process.env.LOLIPOP_EXPORT === "1";
const lolipopMinimal = process.env.LOLIPOP_MINIMAL === "1";
/** 通常は /lagado2026。私設プレビューは LOLIPOP_BASE_PATH=/preview-apps-intro */
const lolipopBasePath = process.env.LOLIPOP_BASE_PATH || "/lagado2026";

const nextConfig: NextConfig = {
  devIndicators: false,
  /** Try Live / desktop Chrome が 127.0.0.1 で開いても HMR・クライアント資産が届くようにする */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  ...(lolipopExport
    ? {
        output: "export",
        basePath: lolipopBasePath,
        trailingSlash: true,
        env: {
          NEXT_PUBLIC_BASE_PATH: lolipopBasePath,
          NEXT_PUBLIC_HOME_AT_ROOT: "1",
          ...(lolipopMinimal ? { NEXT_PUBLIC_LOLIPOP_MINIMAL: "1" } : {}),
        },
      }
    : {}),
};

export default nextConfig;
