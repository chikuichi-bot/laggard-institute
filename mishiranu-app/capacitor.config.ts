import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native iOS shell for 見知らぬ駅 — local Next.js first (no publish required).
 *
 * Default: http://127.0.0.1:3010/lab/mishiranu-eki
 * Override: CAP_SERVER_URL=http://<mac-lan-ip>:3010/lab/mishiranu-eki
 * Or run:   npm run ios:sync   (auto-picks LAN IP when available)
 */
const serverUrl =
  process.env.CAP_SERVER_URL?.trim() ||
  "http://127.0.0.1:3010/lab/mishiranu-eki";

const config: CapacitorConfig = {
  appId: "jp.lagado.mishiranueki",
  appName: "見知らぬ駅",
  webDir: "ios-web",
  backgroundColor: "#f5eedc",
  server: {
    url: serverUrl,
    cleartext: true,
    allowNavigation: ["localhost", "127.0.0.1", "*.local"],
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    backgroundColor: "#f5eedc",
    scheme: "Mishiranu Eki",
  },
  plugins: {
    SplashScreen: {
      backgroundColor: "#f5eedc",
      launchAutoHide: true,
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#f5eedc",
    },
  },
};

export default config;
