import type { Metadata } from "next";
import { Suspense } from "react";
import BunkoSamples from "./Samples";
import "./bunko-cover.css";

export const metadata: Metadata = {
  title: "文庫の表紙4種 · 見知らぬ駅",
  description: "小説の文庫本の表紙を思わせる、見知らぬ駅のトップ案です。",
};

export default function BunkoCoverSamplesPage() {
  return (
    <main>
      <Suspense fallback={<p style={{ padding: "2rem" }}>読み込み中…</p>}>
        <BunkoSamples />
      </Suspense>
    </main>
  );
}
