import BusinessCalendar from "@/components/BusinessCalendar";
import HomeLatestPhoto from "@/components/HomeLatestPhoto";
import SiteShell from "@/components/SiteShell";
import { collectPhotoCandidates } from "@/lib/home-latest";
import { readCatalog } from "@/lib/items";
import { readOpenDays } from "@/lib/open-days";
import { isLolipopMinimal } from "@/lib/site-mode";

export default async function HomePage() {
  // 公開ミニマル: トップ＝営業日カレンダー（ナビは営業日・地図・連絡のみ）
  if (isLolipopMinimal) {
    const data = await readOpenDays();
    return (
      <SiteShell tagline="営業日のご案内。">
        <article className="content-card content-card--news">
          <BusinessCalendar
            weeklyWeekdays={data.weeklyWeekdays}
            extraDays={data.extraDays}
            closedDays={data.closedDays}
            hoursLabel={data.hoursLabel}
            note={data.note}
          />
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
