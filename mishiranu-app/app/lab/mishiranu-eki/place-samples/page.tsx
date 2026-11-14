import type { Metadata } from "next";
import { Suspense } from "react";
import PlaceSamples from "./Samples";
import "./place-samples.css";

export const metadata: Metadata = {
  title: "土地ページ UI サンプル · 見知らぬ駅",
  description:
    "観光案内の標識みたいな土地ページ案を3つ比較します。駅前案内板・道標パネル・観光看板。",
};

export default function PlaceSamplesPage() {
  return (
    <main>
      <Suspense fallback={<p style={{ padding: "2rem" }}>読み込み中…</p>}>
        <PlaceSamples />
      </Suspense>
    </main>
  );
}
