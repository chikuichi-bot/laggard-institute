import AdminShell from "@/components/AdminShell";
import NewsEditForm from "@/components/NewsEditForm";
import { readNews } from "@/lib/news";

export const dynamic = "force-dynamic";

export default async function AdminNewsPage() {
  const { items } = await readNews();

  return (
    <AdminShell
      title="ニュースを編集"
      tagline="トップページに表示するお知らせを書き換えます。"
    >
      <NewsEditForm initialItems={items} />
    </AdminShell>
  );
}
