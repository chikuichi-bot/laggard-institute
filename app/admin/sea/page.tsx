import AdminShell from "@/components/AdminShell";
import UploadItemForm from "@/components/UploadItemForm";

export default function AdminSeaPage() {
  return (
    <AdminShell title="海で見つけたモノ" tagline="場所と写真だけ。撮った順に一覧へ。">
      <UploadItemForm category="sea" submitLabel="漂着物として登録" />
    </AdminShell>
  );
}
