import type { Metadata } from "next";
import { Suspense } from "react";
import StationChromeSamples from "./Samples";
import "./station-chrome-samples.css";

export const metadata: Metadata = {
  title: "駅ヘッド統一 · 見知らぬ駅",
  description:
    "地図・土地・歩くでバラバラな「二ノ瀬」表示を、小さくスッキリ統一する案を3つ比較します。",
};

export default function StationChromeSamplesPage() {
  return (
    <main>
      <Suspense fallback={<p style={{ padding: "2rem" }}>読み込み中…</p>}>
        <StationChromeSamples />
      </Suspense>
    </main>
  );
}
