import type { Metadata } from "next";
import OrikataStory from "./OrikataStory";

export const metadata: Metadata = {
  title: "見知らぬ駅 — 知らない駅に降りる",
  description:
    "名前だけ知っている駅に、私は降りる。空っぽの名前だった駅が、私の散歩道になる。",
  openGraph: {
    title: "見知らぬ駅 — 知らない駅に降りる",
    description:
      "名前だけ知っている駅に、私は降りる。空っぽの名前だった駅が、私の散歩道になる。",
    images: [{ url: "/story/orikata/map-yodo.png" }],
  },
};

export default function OrikataPage() {
  return <OrikataStory />;
}
