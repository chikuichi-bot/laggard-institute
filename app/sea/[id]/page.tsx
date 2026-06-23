export const dynamic = "force-dynamic";

import ItemDetailView from "@/components/ItemDetailView";
import SiteShell from "@/components/SiteShell";
import { getItem } from "@/lib/items";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function SeaDetailPage({ params }: Props) {
  const { id } = await params;
  const item = await getItem("sea", id);
  if (!item) notFound();

  return (
    <SiteShell tagline={item.title}>
      <ItemDetailView category="sea" item={item} />
    </SiteShell>
  );
}
