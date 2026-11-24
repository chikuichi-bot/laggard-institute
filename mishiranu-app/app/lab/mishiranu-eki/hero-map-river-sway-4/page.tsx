import type { Metadata } from "next";
import Samples from "./Samples";
import "./hero-map-river-sway.css";

export const metadata: Metadata = {
  title: "川の線がなびく · 4案 · 見知らぬ駅",
  description:
    "トップ抽象地図の川の線が、形そのものでなびくモーションを4通りに工夫したサンプルです。",
};

export default function HeroMapRiverSwayPage() {
  return <Samples />;
}
