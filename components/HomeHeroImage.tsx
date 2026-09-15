import { assetUrl } from "@/lib/asset-path";
import { HOME_HERO_SRC } from "@/lib/home-hero";

export default function HomeHeroImage() {
  return (
    <div className="home-hero-stage home-hero-stage--wide" aria-label="工房の壁時計">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="home-hero-photo"
        src={assetUrl(HOME_HERO_SRC)}
        alt=""
        width={1024}
        height={584}
        decoding="async"
      />
    </div>
  );
}
