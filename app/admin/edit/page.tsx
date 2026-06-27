import Link from "next/link";
import AdminShell from "@/components/AdminShell";

const categories = [
  {
    href: "/admin/edit/antiques",
    label: "古道具",
    desc: "写真の削除・記録の削除",
  },
  {
    href: "/admin/edit/city",
    label: "街で見つけたモノ",
    desc: "場所と写真だけ。削除・場所の変更",
  },
  {
    href: "/admin/edit/sea",
    label: "海で見つけたモノ",
    desc: "場所と写真だけ。削除・場所の変更",
  },
];

export default function AdminEditHubPage() {
  return (
    <AdminShell
      title="編集"
      tagline="掲載済みの記録を直したり、削除したりします。"
    >
      <div className="admin-task-list">
        {categories.map((entry) => (
          <Link key={entry.href} href={entry.href} className="admin-task-card">
            <span className="admin-task-label">{entry.label}</span>
            <span className="admin-task-desc">{entry.desc}</span>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
