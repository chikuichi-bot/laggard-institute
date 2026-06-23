import AdminShell from "@/components/AdminShell";
import UploadItemForm from "@/components/UploadItemForm";

export default function AdminAntiquesPage() {
  return (
    <AdminShell
      title="古道具を登録"
      tagline="写真 → タイトル → 説明 → 価格。登録すると商品ページができます。"
    >
      <UploadItemForm
        category="antiques"
        submitLabel="古道具として登録"
        defaults={{ location: "京都", forSale: true, showPrice: true, showFoundAt: false }}
      />
    </AdminShell>
  );
}
