import Link from "next/link";

type AdminShellProps = {
  title: string;
  tagline?: string;
  backHref?: string;
  children: React.ReactNode;
};

export default function AdminShell({
  title,
  tagline,
  backHref = "/admin",
  children,
}: AdminShellProps) {
  const showBack = backHref.length > 0;
  return (
    <div className="admin-site">
      <header className="admin-header">
        {showBack ? (
          <Link href={backHref} className="admin-back">
            ← 作業メニュー
          </Link>
        ) : null}
        <p className="admin-eyebrow">ラガード研究所</p>
        <h1>{title}</h1>
        {tagline ? <p className="admin-tagline">{tagline}</p> : null}
      </header>
      <main className="admin-main">{children}</main>
      <footer className="admin-footer">
        <Link href="/">サイトを見る</Link>
      </footer>
    </div>
  );
}
