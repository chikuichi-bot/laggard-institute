import type { Metadata } from "next";
import { Suspense } from "react";
import CommuteVerseSamples from "./Samples";
import "./commute-verse-4.css";

export const metadata: Metadata = {
  title: "帰りの縦書き · モーション4案 · 見知らぬ駅",
  description:
    "夜の京阪電車の一文を縦書きで。徐々に現れるモーションを4つ並べて選びます。",
};

export default function CommuteVersePage() {
  return (
    <main>
      <Suspense fallback={<p style={{ padding: "2rem" }}>読み込み中…</p>}>
        <CommuteVerseSamples />
      </Suspense>
    </main>
  );
}
