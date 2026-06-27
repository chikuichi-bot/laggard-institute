export const dynamic = "force-dynamic";

import NewsList from "@/components/NewsList";
import SiteShell from "@/components/SiteShell";
import { readNews } from "@/lib/news";

export default async function NewsPage() {
  const { items } = await readNews();

  return (
    <SiteShell tagline="最近のお知らせ。">
      <article className="content-card content-card--news">
        <NewsList items={items} />
      </article>
    </SiteShell>
  );
}
