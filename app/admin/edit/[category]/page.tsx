export const dynamic = "force-dynamic";

import AdminEditList from "@/components/AdminEditList";
import AdminShell from "@/components/AdminShell";
import { categoryLabel, isItemCategory } from "@/lib/category";
import { readCatalog, sortByFoundOrder } from "@/lib/items";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ category: string }> };

export default async function AdminEditListPage({ params }: Props) {
  const { category: categoryRaw } = await params;
  if (!isItemCategory(categoryRaw)) notFound();

  const items = [...sortByFoundOrder(await readCatalog(categoryRaw))].reverse();

  return (
    <AdminShell
      title={`${categoryLabel(categoryRaw)}を編集`}
      tagline="写真の削除は各記録の編集画面から。掲載ごと消すときは「削除」。"
      backHref="/admin/edit"
    >
      <AdminEditList category={categoryRaw} items={items} />
    </AdminShell>
  );
}
