import type { Metadata } from "next";
import { Suspense } from "react";
import SkinSamples from "./Samples";
import "./skin-samples.css";

export const metadata: Metadata = {
  title: "見た目の方向 · 見知らぬ駅",
  description:
    "おみくじ文庫の和紙UIから離し、見知らぬ駅に合うデザイン方向を3つ比較します。",
};

export default function SkinSamplesPage() {
  return (
    <main>
      <Suspense fallback={<p style={{ padding: "2rem" }}>読み込み中…</p>}>
        <SkinSamples />
      </Suspense>
    </main>
  );
}
