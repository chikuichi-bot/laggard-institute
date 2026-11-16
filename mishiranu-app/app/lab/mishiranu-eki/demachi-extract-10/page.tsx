import type { Metadata } from "next";
import { Suspense } from "react";
import Extract10 from "./Samples";
import "../demachi-abstract-10/demachi-abstract-10.css";
import "./demachi-extract-10.css";

export const metadata: Metadata = {
  title: "出町柳 · 地図地紋の抽象10案 · 見知らぬ駅",
  description:
    "観光地図から吹き出しを除き、川・道・橋・駅の地紋だけを抽象化した10案です。",
};

export default function DemachiExtract10Page() {
  return (
    <main>
      <Suspense fallback={<p style={{ padding: "2rem" }}>読み込み中…</p>}>
        <Extract10 />
      </Suspense>
    </main>
  );
}
