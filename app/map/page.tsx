import SiteShell from "@/components/SiteShell";
import { CONTACT_EMAIL, GOOGLE_MAPS_EMBED_URL, INSTITUTE_ADDRESS } from "@/lib/constants";

export default function MapPage() {
  return (
    <SiteShell tagline="京都・北白川。ラガード研究所。">
      <article className="content-card content-card--flat">
        <div className="horizontal-body">
          <p>{INSTITUTE_ADDRESS}</p>
          <iframe
            className="map-frame"
            title="ラガード研究所の地図"
            src={GOOGLE_MAPS_EMBED_URL}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </article>
    </SiteShell>
  );
}
