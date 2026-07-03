"use client";

import { useState } from "react";
import { assetUrl } from "@/lib/asset-path";

type AppVideoProps = {
  name: string;
  src: string;
  poster?: string;
};

export default function AppVideo({ name, src, poster }: AppVideoProps) {
  const [failed, setFailed] = useState(false);

  const posterUrl = poster ? assetUrl(poster) : undefined;

  if (failed && posterUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="apps-video" src={posterUrl} alt={`${name}のデモ`} />
    );
  }

  return (
    <video
      className="apps-video"
      src={src}
      poster={posterUrl}
      controls
      playsInline
      preload="metadata"
      aria-label={`${name}のデモ動画`}
      onError={() => setFailed(true)}
    />
  );
}
