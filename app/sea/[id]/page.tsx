export const dynamic = "force-dynamic";

import ItemDetailView from "@/components/ItemDetailView";
import SiteShell from "@/components/SiteShell";
import { catalogDisplayTitle } from "@/lib/category";
import { getItem, readCatalog, sortByFoundOrder } from "@/lib/items";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function SeaDetailPage({ params }: Props) {
  const { id } = await params;
  const items = sortByFoundOrder(await readCatalog("sea"));
  const item = items.find((entry) => entry.id === id) ?? (await getItem("sea", id));
  if (!item) notFound();

  return (
    <SiteShell tagline={catalogDisplayTitle(item, "sea")}>
      <ItemDetailView category="sea" item={item} items={items} />
    </SiteShell>
  );
}
