import BusinessCalendar from "@/components/BusinessCalendar";
import HomeHeroImage from "@/components/HomeHeroImage";
import HomeLatestPhoto from "@/components/HomeLatestPhoto";
import SiteShell from "@/components/SiteShell";
import { collectPhotoCandidates } from "@/lib/home-latest";
import { readCatalog } from "@/lib/items";
import { readOpenDays } from "@/lib/open-days";
import { isLolipopMinimal } from "@/lib/site-mode";

export default async function HomePage() {
  // 公開ミニマル: 前回の海岸ヒーロー（日付・場所キャプション）+ 営業日カレンダー
  if (isLolipopMinimal) {
    const data = await readOpenDays();
    return (
      <SiteShell tagline="営業日のご案内。">
        <article className="content-card content-card--home content-card--home-with-dates">
          <HomeHeroImage />
          <div className="home-open-days">
            <BusinessCalendar
              weeklyWeekdays={data.weeklyWeekdays}
              extraDays={data.extraDays}
              closedDays={data.closedDays}
              hoursLabel={data.hoursLabel}
              note={data.note}
            />
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
