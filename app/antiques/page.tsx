export const dynamic = "force-dynamic";

import FramedCatalog from "@/components/FramedCatalog";
import ItemGrid from "@/components/ItemGrid";
import SiteShell from "@/components/SiteShell";
import { readCatalog, sortByFoundOrder } from "@/lib/items";

export default async function AntiquesPage() {
  const items = sortByFoundOrder(await readCatalog("antiques"));

  return (
    <SiteShell tagline="使われて、手を離れた道具たち。">
      <FramedCatalog>
        <ItemGrid category="antiques" items={items} />
      </FramedCatalog>
    </SiteShell>
  );
}
