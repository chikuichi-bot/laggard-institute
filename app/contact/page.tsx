import SiteShell from "@/components/SiteShell";
import { CONTACT_EMAIL } from "@/lib/constants";

export default function ContactPage() {
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("ラガード研究所へのお問い合わせ")}`;

  return (
    <SiteShell tagline="お問い合わせ・展示・漂着物について。">
      <div className="action-bar">
        <a className="action-btn action-btn--primary" href={mailto}>
          {CONTACT_EMAIL}
        </a>
      </div>

      <article className="content-card content-card--flat">
        <div className="horizontal-body contact-block">
          <p>
            古道具のご購入、漂着物について、展示へのご参加、アプリについてのご質問など、お気軽にどうぞ。
          </p>
          <p className="detail-meta-plain">ラガード研究所 / 淡嶋健仁</p>
        </div>
      </article>
    </SiteShell>
  );
}
