import type { Metadata } from "next";
import { Suspense } from "react";
import MapHeaderSamples from "./Samples";
import "./map-header-samples.css";

export const metadata: Metadata = {
  title: "地図ヘッド UI サンプル · 見知らぬ駅",
  description:
    "地図タブ上部の重複（駅名＋キャッチの二重表示）を整理する案を3つ比較します。",
};

export default function MapHeaderSamplesPage() {
  return (
    <main>
      <Suspense fallback={<p style={{ padding: "2rem" }}>読み込み中…</p>}>
        <MapHeaderSamples />
      </Suspense>
    </main>
  );
}
