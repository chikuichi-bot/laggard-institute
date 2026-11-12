import type { Metadata } from "next";
import Samples from "./Samples";
import "./hero-map-river-wind-soft.css";

export const metadata: Metadata = {
  title: "川のなびき · 控えめ3案 · 見知らぬ駅",
  description:
    "風に流される案を、もっと目立たない強さで3通りにしたサンプルです。",
};

export default function HeroMapRiverWindSoftPage() {
  return <Samples />;
}
