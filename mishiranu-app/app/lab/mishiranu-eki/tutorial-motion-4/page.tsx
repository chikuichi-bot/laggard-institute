import type { Metadata } from "next";
import TutorialMotionSamples from "./Samples";
import "./tutorial-motion-4.css";

export const metadata: Metadata = {
  title: "チュートリアル · モノクロ想起アニメ4案 · 見知らぬ駅",
  description:
    "チュートリアル各ページの文を想起する、モノクロの小さなアニメを4つの言葉で比べます。",
};

export default function TutorialMotion4Page() {
  return (
    <main className="tm4">
      <TutorialMotionSamples />
    </main>
  );
}
