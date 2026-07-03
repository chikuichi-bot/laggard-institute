import type { NextConfig } from "next";

const lolipopExport = process.env.LOLIPOP_EXPORT === "1";
const lolipopBasePath = "/lagado";

const nextConfig: NextConfig = {
  devIndicators: false,
  ...(lolipopExport
    ? {
        output: "export",
        basePath: lolipopBasePath,
        trailingSlash: true,
        env: {
          NEXT_PUBLIC_BASE_PATH: lolipopBasePath,
        },
      }
    : {}),
};

export default nextConfig;
