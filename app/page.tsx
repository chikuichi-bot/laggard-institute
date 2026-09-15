import HomeHeroImage from "@/components/HomeHeroImage";
import HomeLatestPhoto from "@/components/HomeLatestPhoto";
import SiteShell from "@/components/SiteShell";
import { collectPhotoCandidates } from "@/lib/home-latest";
import { readCatalog } from "@/lib/items";
import { isLolipopMinimal } from "@/lib/site-mode";

export default async function HomePage() {
  if (isLolipopMinimal) {
    return (
      <SiteShell>
        <article className="content-card content-card--home">
          <HomeHeroImage />
        </article>
      </SiteShell>
    );
  }

  const [antiques, city, sea] = await Promise.all([
    readCatalog("antiques"),
    readCatalog("city"),
    readCatalog("sea"),
  ]);

  const candidates = collectPhotoCandidates(antiques, city, sea);

  return (
    <SiteShell>
      <article className="content-card content-card--home">
        {candidates.length > 0 ? <HomeLatestPhoto candidates={candidates} /> : null}
      </article>
    </SiteShell>
  );
}
