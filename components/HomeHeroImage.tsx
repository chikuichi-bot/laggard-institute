import { assetUrl } from "@/lib/asset-path";
import {
  HOME_HERO_DATE,
  HOME_HERO_PLACE,
  HOME_HERO_SRC,
} from "@/lib/home-hero";

export default function HomeHeroImage() {
  const label = `${HOME_HERO_DATE} ${HOME_HERO_PLACE}`;

  return (
    <figure className="home-hero-figure" aria-label={label}>
      <div className="home-hero-stage home-hero-stage--wide">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="home-hero-photo"
          src={assetUrl(HOME_HERO_SRC)}
          alt={label}
          width={1024}
          height={768}
          decoding="async"
        />
      </div>
      <figcaption className="home-hero-caption">
        <p className="home-hero-caption-date">{HOME_HERO_DATE}</p>
        <p className="home-hero-caption-place">{HOME_HERO_PLACE}</p>
      </figcaption>
    </figure>
  );
}
