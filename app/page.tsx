import HomeLatestPhoto from "@/components/HomeLatestPhoto";
import SiteShell from "@/components/SiteShell";
import { collectPhotoCandidates } from "@/lib/home-latest";
import { readCatalog } from "@/lib/items";
import { isLolipopMinimal } from "@/lib/site-mode";

export default async function HomePage() {
  // 2026-07-03 仮公開成果物 `lagado/`（営業日・地図・連絡のみ）のトップ文言を継承
  if (isLolipopMinimal) {
    return (
      <SiteShell>
        <article className="content-card content-card--home">
          <div className="horizontal-body home-intro-minimal">
            <p>京都・北白川の工房。</p>
            <p>古道具と、街や海で拾ったものと、言葉の標本。</p>
          </div>
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
