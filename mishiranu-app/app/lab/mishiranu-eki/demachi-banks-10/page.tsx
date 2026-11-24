import type { Metadata } from "next";
import { Suspense } from "react";
import Banks10 from "./Samples";
import "../demachi-abstract-10/demachi-abstract-10.css";
import "./demachi-banks-10.css";

export const metadata: Metadata = {
  title: "岸の輪郭 · 派生10案 · 見知らぬ駅",
  description: "抽象地図9・岸の輪郭から派生したトップ用サンプル10種です。",
};

export default function DemachiBanks10Page() {
  return (
    <main>
      <Suspense fallback={<p style={{ padding: "2rem" }}>読み込み中…</p>}>
        <Banks10 />
      </Suspense>
    </main>
  );
}
