export const dynamic = "force-dynamic";

import ItemDetailView from "@/components/ItemDetailView";
import SiteShell from "@/components/SiteShell";
import { getItem } from "@/lib/items";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function AntiqueDetailPage({ params }: Props) {
  const { id } = await params;
  const item = await getItem("antiques", id);
  if (!item) notFound();

  return (
    <SiteShell tagline={item.title}>
      <ItemDetailView category="antiques" item={item} />
    </SiteShell>
  );
}
