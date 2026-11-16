import type { Metadata } from "next";
import RouteDirectionSamples from "./Samples";
import "./route-direction.css";

export const metadata: Metadata = {
  title: "動線の進行方向 · 4案 · 見知らぬ駅",
  description:
    "出町柳の徒歩線で、進行方向の目印を4通り比べます。丸印は置かず、行きの向きだけです。",
};

export default function RouteDirectionSamplesPage() {
  return (
    <main>
      <RouteDirectionSamples />
    </main>
  );
}
