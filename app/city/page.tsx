export const dynamic = "force-dynamic";

import FramedCatalog from "@/components/FramedCatalog";
import ItemGrid from "@/components/ItemGrid";
import SiteShell from "@/components/SiteShell";
import { readCatalog, sortByFoundOrder } from "@/lib/items";

export default async function CityPage() {
  const items = sortByFoundOrder(await readCatalog("city"));

  return (
    <SiteShell tagline="街に落ちていた、名前のない断片。">
      <FramedCatalog>
        <ItemGrid category="city" items={items} />
      </FramedCatalog>
    </SiteShell>
  );
}
