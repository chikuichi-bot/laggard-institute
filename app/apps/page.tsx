import AppVideo from "@/components/AppVideo";
import SiteShell from "@/components/SiteShell";
import { appVideoSrc } from "@/lib/app-media";
import { assetUrl } from "@/lib/asset-path";
import { apps } from "@/lib/sections";

export default function AppsPage() {
  return (
    <SiteShell tagline="言葉と遊ぶ、小さなアプリたち。">
      <article className="content-card content-card--apps">
        <div className="apps-block horizontal-body">
          <p>これはラガード研究所が開発したアプリです。</p>
          <ul className="app-list">
            {apps.map((app) => {
              const videoSrc = app.videoBase ? appVideoSrc(app.videoBase) : null;

              return (
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
                      <img className="app-icon" src={assetUrl(app.icon)} alt="" />
                    ) : (
                      <span className="app-icon app-icon--placeholder" aria-hidden />
                    )}
                  </span>
                  <div className="app-copy">
                    <div className="app-name">{app.name}</div>
                    <div className="app-desc">{app.description}</div>
                  </div>
                </a>
                {videoSrc || app.poster ? (
                  <div className="apps-video-wrap">
                    {videoSrc ? (
                      <AppVideo
                        name={app.name}
                        src={videoSrc}
                        poster={app.poster ? assetUrl(app.poster) : undefined}
                      />
                    ) : app.poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="apps-video"
                        src={assetUrl(app.poster)}
                        alt={`${app.name}のデモ`}
                      />
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
            })}
          </ul>
        </div>
      </article>
    </SiteShell>
  );
}
