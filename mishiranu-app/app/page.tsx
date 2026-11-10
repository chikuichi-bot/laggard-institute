import { Shippori_Mincho, Zen_Kaku_Gothic_New } from "next/font/google";
import MishiranuApp from "./lab/mishiranu-eki/MishiranuApp";

const display = Shippori_Mincho({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mishiranu-display",
  display: "swap",
});

const sans = Zen_Kaku_Gothic_New({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mishiranu-sans",
  display: "swap",
});

/**
 * Capacitor opens webDir/index.html (= `/`).
 * Same chrome as /lab/mishiranu-eki so the native shell needs no redirect.
 */
export default function HomePage() {
  return (
    <div className={`mishiranu-root ${display.variable} ${sans.variable}`}>
      <MishiranuApp />
    </div>
  );
}
