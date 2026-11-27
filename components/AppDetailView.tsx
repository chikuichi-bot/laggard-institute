import Link from "next/link";
import { StoreBadges } from "@/components/StoreBadges";
import { assetUrl } from "@/lib/asset-path";
import {
  appHref,
  appIntroParagraphs,
  formatAppPlatformLine,
  formatAppReleasedAt,
  type CatalogApp,
} from "@/lib/sections";

type AppDetailViewProps = {
  app: CatalogApp;
  others: CatalogApp[];
};

const INTRO_LABELS = ["なにか", "だれ向け", "どう使うか"] as const;

export default function AppDetailView({ app, others }: AppDetailViewProps) {
  const platformLine = formatAppPlatformLine(app.editions);
  const introParagraphs = appIntroParagraphs(app);

  return (
    <article className="content-card content-card--apps app-detail">
      <div className="action-bar app-detail-nav">
        <Link href="/apps" className="action-btn">
          ← アプリ一覧
        </Link>
      </div>

      <header className="app-detail-header">
        <span className="app-detail-icon-wrap" aria-hidden="true">
          {app.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="app-detail-icon" src={assetUrl(app.icon)} alt="" />
          ) : (
            <span className="app-detail-icon app-detail-icon--placeholder" />
          )}
        </span>
        <div className="app-detail-heading">
          <p className="app-detail-eyebrow">
            {app.commissioned ? "委託制作" : "Lagado 自作"}
          </p>
          <h1 className="app-detail-title">{app.name}</h1>
          {platformLine ? (
            <p className="app-detail-platforms">{platformLine}</p>
          ) : null}
        </div>
      </header>

      <section
        className="app-detail-panel app-detail-panel--intro"
        aria-labelledby="app-detail-about"
      >
        <h2 id="app-detail-about" className="app-detail-section-title">
          紹介
        </h2>
        <ol className="app-detail-intro">
          {introParagraphs.map((paragraph, index) => {
            const label =
              index < INTRO_LABELS.length ? INTRO_LABELS[index] : `続き ${index + 1}`;
            return (
              <li key={paragraph} className="app-detail-intro-item">
                <p className="app-detail-intro-label">{label}</p>
                <p className="app-detail-intro-body">{paragraph}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {app.gallery && app.gallery.length > 0 ? (
        <section
          className="app-detail-panel app-detail-panel--gallery"
          aria-labelledby="app-detail-gallery"
        >
          <div className="app-detail-panel-head">
            <h2 id="app-detail-gallery" className="app-detail-section-title">
              画面のようす
            </h2>
            <p className="app-detail-gallery-note">
              App Store に掲載されている画面です（見た目の参考）。
            </p>
          </div>
          <ul className="app-detail-gallery">
            {app.gallery.map((src, index) => (
              <li key={src} className="app-detail-gallery-item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="app-detail-gallery-image"
                  src={assetUrl(src)}
                  alt={`${app.name}の画面 ${index + 1}`}
                  loading="lazy"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        className="app-detail-panel app-detail-panel--facts"
        aria-label="制作情報"
      >
        <dl className="app-detail-facts">
          <div className="app-detail-fact">
            <dt>制作日</dt>
            <dd>{formatAppReleasedAt(app.releasedAt)}</dd>
          </div>
          {app.updatedAt ? (
            <div className="app-detail-fact">
              <dt>最新更新日</dt>
              <dd>{formatAppReleasedAt(app.updatedAt)}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {app.editions.length > 0 || app.friendOffer ? (
        <section
          className="app-detail-panel app-detail-panel--actions"
          aria-labelledby="app-detail-get"
        >
          <h2 id="app-detail-get" className="app-detail-section-title">
            入手する
          </h2>
          <div className="app-detail-actions">
            {app.editions.length > 0 ? (
              <StoreBadges editions={app.editions} />
            ) : null}
            {app.friendOffer ? (
              <a
                className="app-friend-offer"
                href={app.friendOffer.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="app-friend-offer-label">
                  {app.friendOffer.label ?? "友人"}
                </span>
                {app.friendOffer.detail ? (
                  <span className="app-friend-offer-detail">
                    {app.friendOffer.detail}
                  </span>
                ) : null}
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      {others.length > 0 ? (
        <section
          className="app-detail-panel app-detail-panel--others"
          aria-labelledby="app-detail-others"
        >
          <h2 id="app-detail-others" className="app-detail-section-title">
            ほかのアプリ
          </h2>
          <ul className="app-detail-others">
            {others.map((other) => (
              <li key={other.slug}>
                <Link href={appHref(other.slug)} className="app-detail-other-link">
                  {other.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
