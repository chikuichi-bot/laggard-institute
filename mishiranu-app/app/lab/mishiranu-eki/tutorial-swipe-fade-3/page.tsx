import type { Metadata } from "next";
import TutorialSwipeFadeSamples from "./Samples";
import "./tutorial-swipe-fade-3.css";

export const metadata: Metadata = {
  title: "チュートリアル · 普通のフェード3案 · 見知らぬ駅",
  description:
    "被らない普通のフェード（消えてから次）を速さ違いで3種類並べます。",
}

export default function TutorialSwipeFade3Page() {
  return (
    <main className="tsf3">
      <TutorialSwipeFadeSamples />
    </main>
  );
}
