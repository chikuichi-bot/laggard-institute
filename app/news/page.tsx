
import BusinessCalendar from "@/components/BusinessCalendar";
import SiteShell from "@/components/SiteShell";
import { readOpenDays } from "@/lib/open-days";

export default async function NewsPage() {
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
