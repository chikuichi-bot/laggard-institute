import type { Metadata } from "next";
import OrikataStory from "./OrikataStory";

export const metadata: Metadata = {
  title: "見知らぬ駅 — 知らない駅に降りる",
  description:
    "知らない駅に降りる。土地の歴史と今をガイダンスで聴きながら、小回り、大回りして散策する。",
  openGraph: {
    title: "見知らぬ駅 — 知らない駅に降りる",
    description:
      "土地の歴史と今をガイダンスで聴きながら、小回り、大回りして散策する。空っぽだった駅を、散歩の大事な空間へ変えるアプリです。",
    images: [{ url: "/story/orikata/map-yodo.png" }],
  },
};

export default function OrikataPage() {
  return <OrikataStory />;
}
