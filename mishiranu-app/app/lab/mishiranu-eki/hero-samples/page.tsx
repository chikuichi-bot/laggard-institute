import type { Metadata } from "next";
import { Suspense } from "react";
import HeroSamples from "./Samples";
import "./hero-samples.css";

export const metadata: Metadata = {
  title: "一列の縦書き5種 · 見知らぬ駅",
  description: "見知らぬ駅を改行せず一列にし、置き方を少し変えた5案です。",
};

export default function HeroSamplesPage() {
  return (
    <main>
      <Suspense fallback={<p style={{ padding: "2rem" }}>読み込み中…</p>}>
        <HeroSamples />
      </Suspense>
    </main>
  );
}
