import type { ReactNode } from "react";
import type { AppEdition, AppPlatform } from "@/lib/sections";
import { appOpenLabel } from "@/lib/sections";

const PLATFORM_ORDER: AppPlatform[] = ["ios", "android", "web"];

export function sortStoreEditions(editions: AppEdition[]): AppEdition[] {
  return [...editions].sort(
    (a, b) => PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform),
  );
}

function AppStoreBadgeMark() {
  return (
    <svg
      className="store-badge-mark"
      viewBox="0 0 17 20"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M13.97 10.57c-.02-2.05 1.67-3.04 1.75-3.09-0.95-1.39-2.43-1.58-2.95-1.6-1.25-.13-2.45.74-3.08.74-.64 0-1.62-.72-2.67-.7-1.37.02-2.64.8-3.35 2.03-1.43 2.48-.37 6.15 1.03 8.17.68.98 1.5 2.09 2.57 2.05 1.03-.04 1.42-.67 2.67-.67 1.24 0 1.6.67 2.69.65 1.11-.02 1.81-1 2.49-1.99.78-1.14 1.1-2.24 1.12-2.3-.02-.01-2.15-.83-2.17-3.29zM11.5 3.78c.57-.69.95-1.65.85-2.61-.82.03-1.81.55-2.4 1.24-.53.61-.99 1.59-.87 2.53.92.07 1.86-.47 2.42-1.16z"
      />
    </svg>
  );
}

function GooglePlayBadgeMark() {
  return (
    <svg
      className="store-badge-mark store-badge-mark--play"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path fill="#00F076" d="M3.6 2.3 13.8 12 3.6 21.7c-.5-.3-.8-.8-.8-1.4V3.7c0-.6.3-1.1.8-1.4z" />
      <path fill="#FF3A44" d="m3.6 2.3 10.2 9.7 3.8-2.2L5.8 1.1C5 .7 4.1 1.1 3.6 2.3z" />
      <path fill="#FFE000" d="m17.6 19.7-3.8-2.2L3.6 21.7c.5 1.1 1.6 1.5 2.6.9l11.4-6.9z" />
      <path fill="#00C3FF" d="m17.6 4.3-3.8 2.2L17.6 8.7l3.3-1.9c1-.6 1-1.6 0-2.2l-3.3-1.9z" />
      <path fill="#0089D0" d="m13.8 12 3.8-2.2 3.3 1.9c1 .6 1 1.6 0 2.2l-3.3 1.9L13.8 12z" />
    </svg>
  );
}

function StoreBadgeShell({
  href,
  platform,
  children,
}: {
  href: string;
  platform: AppPlatform;
  children: ReactNode;
}) {
  return (
    <a
      className={`store-badge store-badge--${platform}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={appOpenLabel(platform)}
    >
      {children}
    </a>
  );
}

function AppStoreBadge({ href }: { href: string }) {
  return (
    <StoreBadgeShell href={href} platform="ios">
      <AppStoreBadgeMark />
      <span className="store-badge-copy">
        <span className="store-badge-kicker">Download on the</span>
        <span className="store-badge-name">App Store</span>
      </span>
    </StoreBadgeShell>
  );
}

function GooglePlayBadge({ href }: { href: string }) {
  return (
    <StoreBadgeShell href={href} platform="android">
      <GooglePlayBadgeMark />
      <span className="store-badge-copy">
        <span className="store-badge-kicker">GET IT ON</span>
        <span className="store-badge-name">Google Play</span>
      </span>
    </StoreBadgeShell>
  );
}

function WebBadgeMark() {
  return (
    <svg
      className="store-badge-mark store-badge-mark--web"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        d="M3 12h18M12 3c2.5 2.8 3.8 5.8 3.8 9s-1.3 6.2-3.8 9c-2.5-2.8-3.8-5.8-3.8-9S9.5 5.8 12 3z"
      />
    </svg>
  );
}

function WebBadge({ href }: { href: string }) {
  return (
    <StoreBadgeShell href={href} platform="web">
      <WebBadgeMark />
      <span className="store-badge-copy">
        <span className="store-badge-kicker">Open on the</span>
        <span className="store-badge-name">Web</span>
      </span>
    </StoreBadgeShell>
  );
}

export function StoreBadges({ editions }: { editions: AppEdition[] }) {
  const sorted = sortStoreEditions(editions);
  const storeEditions = sorted.filter((e) => e.platform !== "web");
  const webEdition = sorted.find((e) => e.platform === "web");

  return (
    <div className="store-badges">
      {webEdition ? <WebBadge key="web" href={webEdition.href} /> : null}
      {storeEditions.length > 0 ? (
        <div className="store-badges-row">
          {storeEditions.map((edition) => {
            switch (edition.platform) {
              case "ios":
                return <AppStoreBadge key="ios" href={edition.href} />;
              case "android":
                return <GooglePlayBadge key="android" href={edition.href} />;
              default:
                return null;
            }
          })}
        </div>
      ) : null}
    </div>
  );
}
