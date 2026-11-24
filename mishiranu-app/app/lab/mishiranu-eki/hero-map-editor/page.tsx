import type { Metadata } from "next";
import HeroMapEditor from "./Editor";
import "./hero-map-editor.css";

export const metadata: Metadata = {
  title: "トップ抽象地図 · 街区エディタ · 見知らぬ駅",
  description: "1・街区を土台に、川・道・区画・駅を細かく動かす編集画面です。",
};

export default function HeroMapEditorPage() {
  return (
    <main>
      <HeroMapEditor />
    </main>
  );
}
