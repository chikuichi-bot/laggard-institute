"use client";

import { INSTITUTE_NAME } from "@/lib/constants";
import { HOME_HREF } from "@/lib/asset-path";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getNavItems, type SectionId } from "@/lib/sections";

type SiteShellProps = {
  tagline?: string;
  children: React.ReactNode;
};

function activeId(pathname: string): SectionId {
  if (pathname === "/") return "home";
  const match = getNavItems().find((item) => item.href !== "/" && pathname.startsWith(item.href));
  return match?.id ?? "home";
}

export default function SiteShell({ tagline, children }: SiteShellProps) {
  const pathname = usePathname();
  const current = activeId(pathname);

  return (
    <div className="site">
      <header className="site-header">
        {process.env.NEXT_PUBLIC_HOME_AT_ROOT === "1" ? (
          <a href={HOME_HREF}>
            <h1>{INSTITUTE_NAME}</h1>
          </a>
        ) : (
          <Link href={HOME_HREF}>
            <h1>{INSTITUTE_NAME}</h1>
          </Link>
        )}
        <p className="tagline">
          {tagline ?? "古道具と、拾ったものと、"}
        </p>
      </header>

      <main className="site-main">
        <nav className="site-nav action-bar" aria-label="サイト内ナビゲーション">
          {getNavItems().map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`action-btn${current === item.id ? " active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="site-content">{children}</div>
      </main>
    </div>
  );
}
