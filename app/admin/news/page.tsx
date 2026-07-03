export const dynamic = "force-dynamic";

import AdminShell from "@/components/AdminShell";
import OpenDaysEditForm from "@/components/OpenDaysEditForm";
import { readOpenDays } from "@/lib/open-days";

export default async function AdminOpenDaysPage() {
  const data = await readOpenDays();

  return (
    <AdminShell
      title="営業日"
      tagline="カレンダーに表示する営業日を登録・削除します。"
    >
      <OpenDaysEditForm initialData={data} />
    </AdminShell>
  );
}
