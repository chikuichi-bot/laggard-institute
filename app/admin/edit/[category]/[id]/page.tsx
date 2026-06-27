export const dynamic = "force-dynamic";

import AdminShell from "@/components/AdminShell";
import EditItemForm from "@/components/EditItemForm";
import { categoryLabel, isItemCategory } from "@/lib/category";
import { readCatalog } from "@/lib/items";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ category: string; id: string }> };

export default async function AdminEditItemPage({ params }: Props) {
  const { category: categoryRaw, id } = await params;
  if (!isItemCategory(categoryRaw)) notFound();

  const items = await readCatalog(categoryRaw);
  const item = items.find((entry) => entry.id === id);
  if (!item) notFound();

  return (
    <AdminShell
      title={item.title}
      tagline={`${categoryLabel(categoryRaw)}の編集`}
      backHref={`/admin/edit/${categoryRaw}`}
    >
      <EditItemForm category={categoryRaw} item={item} />
    </AdminShell>
  );
}
