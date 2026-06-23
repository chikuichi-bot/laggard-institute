import Link from "next/link";
import AdminShell from "@/components/AdminShell";

const tasks = [
  {
    href: "/admin/antiques",
    label: "古道具を登録",
    desc: "写真を撮って、商品ページを作る",
    primary: true,
  },
  {
    href: "/admin/city",
    label: "街で拾った物",
    desc: "路上の断片を記録する",
  },
  {
    href: "/admin/sea",
    label: "海で拾ったもの",
    desc: "漂着物を記録する",
  },
];

const views = [
  { href: "/antiques", label: "古道具一覧" },
  { href: "/city", label: "街の一覧" },
  { href: "/sea", label: "海の一覧" },
];

export default function AdminHubPage() {
  return (
    <AdminShell
      title="作業"
      tagline="iPhone から写真を送って、サイトを更新します。"
      backHref=""
    >
      <div className="admin-task-list">
        {tasks.map((task) => (
          <Link
            key={task.href}
            href={task.href}
            className={`admin-task-card${task.primary ? " admin-task-card--primary" : ""}`}
          >
            <span className="admin-task-label">{task.label}</span>
            <span className="admin-task-desc">{task.desc}</span>
          </Link>
        ))}
      </div>

      <section className="admin-section">
        <h2 className="admin-section-title">掲載を確認</h2>
        <div className="action-bar">
          {views.map((view) => (
            <Link key={view.href} href={view.href} className="action-btn">
              {view.label}
            </Link>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
