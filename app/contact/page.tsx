import SiteShell from "@/components/SiteShell";
import { CONTACT_EMAIL } from "@/lib/constants";

export default function ContactPage() {
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("ラガード研究所へのお問い合わせ")}`;

  return (
    <SiteShell tagline="お問い合わせ・展示・漂着物について。">
      <article className="content-card content-card--contact">
        <div className="contact-block horizontal-body">
          <p>ご質問など、お気軽にどうぞ。</p>
          <a className="action-btn action-btn--primary contact-email" href={mailto}>
            {CONTACT_EMAIL}
          </a>
          <p className="detail-meta-plain">ラガード研究所 / 淡嶋健仁</p>
        </div>
      </article>
    </SiteShell>
  );
}
