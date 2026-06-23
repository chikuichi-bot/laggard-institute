export const dynamic = "force-dynamic";

import ItemGrid from "@/components/ItemGrid";
import SiteShell from "@/components/SiteShell";
import { readCatalog, sortByFoundOrder } from "@/lib/items";

export default async function CityPage() {
  const items = sortByFoundOrder(await readCatalog("city"));

  return (
    <SiteShell tagline="街に落ちていた、名前のない断片。">
      <ItemGrid category="city" items={items} />
    </SiteShell>
  );
}
