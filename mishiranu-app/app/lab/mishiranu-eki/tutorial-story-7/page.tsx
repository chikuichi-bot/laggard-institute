import type { Metadata } from "next";
import TutorialStorySamples from "./Samples";
import "./tutorial-story-7.css";

export const metadata: Metadata = {
  title: "チュートリアル · 物語アニメ7 · 見知らぬ駅",
  description:
    "チュートリアル各ページの言葉に合わせて、モノクロの物語アニメを1ページ1本ずつ置きます。",
};

export default function TutorialStory7Page() {
  return (
    <main className="ts7">
      <TutorialStorySamples />
    </main>
  );
}
