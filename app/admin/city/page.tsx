import AdminShell from "@/components/AdminShell";
import UploadItemForm from "@/components/UploadItemForm";

export default function AdminCityPage() {
  return (
    <AdminShell title="街で拾った物" tagline="撮った順に、一覧へ追加されます。">
      <UploadItemForm category="city" submitLabel="街の記録として登録" />
    </AdminShell>
  );
}
