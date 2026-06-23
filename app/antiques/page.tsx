export const dynamic = "force-dynamic";

import ItemGrid from "@/components/ItemGrid";
import SiteShell from "@/components/SiteShell";
import { readCatalog, sortByFoundOrder } from "@/lib/items";

export default async function AntiquesPage() {
  const items = sortByFoundOrder(await readCatalog("antiques"));

  return (
    <SiteShell tagline="使われて、手を離れた道具たち。">
      <ItemGrid category="antiques" items={items} />
    </SiteShell>
  );
}
