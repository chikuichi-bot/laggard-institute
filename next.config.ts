import type { NextConfig } from "next";

const lolipopExport = process.env.LOLIPOP_EXPORT === "1";
const lolipopMinimal = process.env.LOLIPOP_MINIMAL === "1";
const lolipopBasePath = "/lagado2026";

const nextConfig: NextConfig = {
  devIndicators: false,
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
