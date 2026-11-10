import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native iOS shell for 見知らぬ駅.
 * Bundled static web (ios-web/) — no Cursor Apps Publish required.
 *
 * Optional live reload against a Mac Next server:
 *   CAP_SERVER_URL=http://127.0.0.1:3010/ npm run ios:sync
 */
const liveReload = process.env.CAP_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "jp.lagado.mishiranueki",
  appName: "見知らぬ駅",
  webDir: "ios-web",
  backgroundColor: "#f5eedc",
  ...(liveReload
    ? {
        server: {
          url: liveReload,
          cleartext: true,
          allowNavigation: ["localhost", "127.0.0.1", "*.local"],
        },
      }
    : {}),
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    backgroundColor: "#f5eedc",
    // Must be a single token — spaces break WKWebView asset URLs (white screen).
    scheme: "MishiranuEki",
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
