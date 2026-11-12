import type { Metadata } from "next";
import OrikataStory from "./OrikataStory";

export const metadata: Metadata = {
  title: "見知らぬ駅の降り方",
  description:
    "名前は知っているのに、降りたことのない駅。そこでふらっと降りてみるために作ったアプリの話です。",
  openGraph: {
    title: "見知らぬ駅の降り方",
    description:
      "小さな駅の周りのことは、ネットで調べてもなかなか出てきません。駅から歩ける範囲だけをまとめたアプリ、見知らぬ駅について。",
    images: [{ url: "/story/orikata/map-yodo.png" }],
  },
};

export default function OrikataPage() {
  return <OrikataStory />;
}
