import type { Metadata } from "next";
import { Suspense } from "react";
import HeroMapSamples from "./Samples";
import "./hero-map-samples.css";

export const metadata: Metadata = {
  title: "トップ抽象地図10案 · 見知らぬ駅",
  description:
    "トップの余白に置く、出町柳周辺の抽象イメージ地図サンプル10種です。",
};

export default function HeroMapSamplesPage() {
  return (
    <main>
      <Suspense fallback={<p style={{ padding: "2rem" }}>読み込み中…</p>}>
        <HeroMapSamples />
      </Suspense>
    </main>
  );
}
