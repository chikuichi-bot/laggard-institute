
import FramedCatalog from "@/components/FramedCatalog";
import ItemGrid from "@/components/ItemGrid";
import SiteShell from "@/components/SiteShell";
import { readCatalog, shuffleItems } from "@/lib/items";

export default async function SeaPage() {
  const items = shuffleItems(await readCatalog("sea"));

  return (
    <SiteShell tagline="海辺に届いた、漂着物の記録。">
      <FramedCatalog>
        <ItemGrid category="sea" items={items} />
      </FramedCatalog>
    </SiteShell>
  );
}
