import SiteShell from "@/components/SiteShell";
import { GOOGLE_MAPS_EMBED_URL, INSTITUTE_ADDRESS } from "@/lib/constants";

export default function MapPage() {
  return (
    <SiteShell tagline="京都・北白川。ラガード研究所。">
      <article className="content-card content-card--map">
        <div className="map-stage">
          <iframe
            className="map-frame"
            title="ラガード研究所の地図"
            src={GOOGLE_MAPS_EMBED_URL}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
          <p className="map-address">{INSTITUTE_ADDRESS}</p>
        </div>
      </article>
    </SiteShell>
  );
}
