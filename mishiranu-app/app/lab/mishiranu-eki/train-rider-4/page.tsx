import type { Metadata } from "next";
import TrainRiderSamples from "./Samples";
import "./train-rider-4.css";

export const metadata: Metadata = {
  title: "電車の人 · モーション4案 · 見知らぬ駅",
  description:
    "夜の京阪電車に座っている人の動きを、モノクロで4通り比べます。",
};

export default function TrainRider4Page() {
  return (
    <main className="tr4">
      <TrainRiderSamples />
    </main>
  );
}
