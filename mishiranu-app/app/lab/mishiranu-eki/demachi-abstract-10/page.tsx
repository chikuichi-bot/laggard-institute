import type { Metadata } from "next";
import { Suspense } from "react";
import DemachiAbstract10 from "./Samples";
import "./demachi-abstract-10.css";

export const metadata: Metadata = {
  title: "出町柳抽象地図10案 · 見知らぬ駅",
  description:
    "実地図を土台に、出町柳駅周辺を10通りに抽象化したトップ用サンプルです。",
};

export default function DemachiAbstract10Page() {
  return (
    <main>
      <Suspense fallback={<p style={{ padding: "2rem" }}>読み込み中…</p>}>
        <DemachiAbstract10 />
      </Suspense>
    </main>
  );
}
