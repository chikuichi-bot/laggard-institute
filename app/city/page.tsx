import FramedCatalog from "@/components/FramedCatalog";
import RandomFind from "@/components/RandomFind";
import SiteShell from "@/components/SiteShell";
import { readCatalog } from "@/lib/items";

export default async function CityPage() {
  const items = await readCatalog("city");

  return (
    <SiteShell tagline="街に落ちていた、名前のない断片。">
      <FramedCatalog>
        <RandomFind category="city" items={items} />
      </FramedCatalog>
    </SiteShell>
  );
}
