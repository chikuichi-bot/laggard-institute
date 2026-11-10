import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native iOS shell (Xcode) for 見知らぬ駅.
 * Loads the Next.js app from CAP_SERVER_URL when set; otherwise uses
 * the Cursor Apps host. For local Xcode + Mac debugging, set:
 *   CAP_SERVER_URL=http://<your-mac-lan-ip>:3010
 */
const serverUrl =
  process.env.CAP_SERVER_URL?.trim() ||
  "https://mishiranu-eki.apps.grok.bot/lab/mishiranu-eki";

const config: CapacitorConfig = {
  appId: "jp.lagado.mishiranueki",
  appName: "見知らぬ駅",
  webDir: "ios-web",
  backgroundColor: "#f5eedc",
  server: {
    url: serverUrl,
    cleartext: true,
    allowNavigation: [
      "mishiranu-eki.apps.grok.bot",
      "localhost",
      "127.0.0.1",
      "*.apps.grok.bot",
    ],
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
