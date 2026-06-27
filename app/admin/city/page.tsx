import AdminShell from "@/components/AdminShell";
import UploadItemForm from "@/components/UploadItemForm";

export default function AdminCityPage() {
  return (
    <AdminShell title="街で見つけたモノ" tagline="場所と写真だけ。撮った順に一覧へ。">
      <UploadItemForm category="city" submitLabel="街の記録として登録" />
    </AdminShell>
  );
}
