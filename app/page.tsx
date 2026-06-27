export const dynamic = "force-dynamic";

import HomeLatestPhoto from "@/components/HomeLatestPhoto";
import SiteShell from "@/components/SiteShell";
import { collectPhotoCandidates } from "@/lib/home-latest";
import { readCatalog } from "@/lib/items";

export default async function HomePage() {
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
