import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "トップ地図の位置・大きさ · 見知らぬ駅",
};

export default function HeroMapLayoutPage() {
  return (
    <iframe
      src="/hero-map-edit.html"
      title="トップ地図の位置・大きさ"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        border: 0,
        background: "#12100e",
      }}
    />
  );
}
