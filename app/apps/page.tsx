import SiteShell from "@/components/SiteShell";
import { apps } from "@/lib/sections";

export default function AppsPage() {
  return (
    <SiteShell tagline="言葉と遊ぶ、小さなアプリたち。">
      <article className="content-card content-card--apps">
        <div className="apps-block horizontal-body">
          <p>これはラガード研究所が開発したアプリです。</p>
          <ul className="app-list">
            {apps.map((app) => (
              <li key={app.name}>
                <a
                  href={app.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="app-row"
                  aria-label={`${app.name} — App Storeで開く`}
                >
                  <span className="app-icon-wrap" aria-hidden="true">
                    {app.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="app-icon" src={app.icon} alt="" />
                    ) : (
                      <span className="app-icon app-icon--placeholder" aria-hidden />
                    )}
                  </span>
                  <div className="app-copy">
                    <div className="app-name">{app.name}</div>
                    <div className="app-desc">{app.description}</div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </article>
    </SiteShell>
  );
}
