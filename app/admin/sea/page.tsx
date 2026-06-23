import AdminShell from "@/components/AdminShell";
import UploadItemForm from "@/components/UploadItemForm";

export default function AdminSeaPage() {
  return (
    <AdminShell title="海で拾ったもの" tagline="撮った順に、一覧へ追加されます。">
      <UploadItemForm category="sea" submitLabel="漂着物として登録" />
    </AdminShell>
  );
}
