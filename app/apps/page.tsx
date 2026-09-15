import SiteShell from "@/components/SiteShell";
import { StoreBadges } from "@/components/StoreBadges";
import { assetUrl } from "@/lib/asset-path";
import {
  apps,
  commissionedApps,
  formatAppPlatformLine,
  formatAppReleasedAt,
  sortAppsByReleasedAt,
  type AppEntry,
} from "@/lib/sections";

function AppListItem({
  app,
  commissioned = false,
}: {
  app: AppEntry;
  commissioned?: boolean;
}) {
  const platformLine = formatAppPlatformLine(app.editions);

  return (
    <li className="app-connect-item">
      <div className="app-connect-row">
        <span className="app-connect-icon-wrap" aria-hidden="true">
          {app.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="app-connect-icon" src={assetUrl(app.icon)} alt="" />
          ) : (
            <span className="app-connect-icon app-connect-icon--placeholder" />
          )}
        </span>
        <div className="app-connect-copy">
          <div className="app-connect-name">
            {app.name}
            {commissioned ? (
              <span className="app-commissioned-tag">委託</span>
            ) : null}
          </div>
          {platformLine ? (
            <div className="app-connect-platforms">{platformLine}</div>
          ) : null}
          <p className="app-connect-desc">{app.description}</p>
          <p className="app-connect-date">
            制作日 {formatAppReleasedAt(app.releasedAt)}
          </p>
        </div>
      </div>
      {app.editions.length > 0 ? (
        <div className="app-connect-actions">
          <StoreBadges editions={app.editions} />
        </div>
      ) : null}
    </li>
  );
}

export default function AppsPage() {
  const appsByDate = sortAppsByReleasedAt(apps);
  const commissionedByDate = sortAppsByReleasedAt(commissionedApps);

  return (
    <SiteShell tagline="Lagado がつくった、小さなアプリたち。">
      <article className="content-card content-card--apps">
        <div className="apps-block horizontal-body">
          <p className="apps-lead">
            これはラガード研究所（Lagado）が開発したアプリです。
          </p>
          <ul className="app-list app-list--connect">
            {appsByDate.map((app) => (
              <AppListItem key={app.name} app={app} />
            ))}
          </ul>

          <section className="apps-commissioned" aria-labelledby="apps-commissioned-title">
            <h2 id="apps-commissioned-title" className="apps-commissioned-title">
              委託制作
            </h2>
            <p className="apps-commissioned-note">
              依頼を受けて制作したアプリです。上の自作アプリとは別枠です。
            </p>
            <ul className="app-list app-list--connect">
              {commissionedByDate.map((app) => (
                <AppListItem key={app.name} app={app} commissioned />
              ))}
            </ul>
          </section>
        </div>
      </article>
    </SiteShell>
  );
}
