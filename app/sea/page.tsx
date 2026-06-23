export const dynamic = "force-dynamic";

import ItemGrid from "@/components/ItemGrid";
import SiteShell from "@/components/SiteShell";
import { readCatalog, sortByFoundOrder } from "@/lib/items";

export default async function SeaPage() {
  const items = sortByFoundOrder(await readCatalog("sea"));

  return (
    <SiteShell tagline="海辺に届いた、漂着物の記録。">
      <ItemGrid category="sea" items={items} />
    </SiteShell>
  );
}
