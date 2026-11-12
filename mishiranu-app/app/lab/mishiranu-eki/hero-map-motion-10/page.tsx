import type { Metadata } from "next";
import Samples from "./Samples";
import "./hero-map-motion.css";

export const metadata: Metadata = {
  title: "トップ抽象地図 · わずかな動き10案 · 見知らぬ駅",
  description:
    "トップの道網地図に、ほんの少しだけ動的なものを足すアラカルト10種です。",
};

export default function HeroMapMotionPage() {
  return <Samples />;
}
