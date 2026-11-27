import FramedCatalog from "@/components/FramedCatalog";
import RandomFind from "@/components/RandomFind";
import SiteShell from "@/components/SiteShell";
import { readCatalog } from "@/lib/items";

export default async function SeaPage() {
  const items = await readCatalog("sea");

  return (
    <SiteShell tagline="海辺に届いた、漂着物の記録。">
      <FramedCatalog>
        <RandomFind category="sea" items={items} />
      </FramedCatalog>
    </SiteShell>
  );
}
