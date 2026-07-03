import Link from "next/link";
import SiteShell from "@/components/SiteShell";
import { assetUrl } from "@/lib/asset-path";
import {
  AMAPPOLA_DESCRIPTION,
  AMAPPOLA_META,
  canPurchaseAmappola,
  getAmappolaProduct,
} from "@/lib/amappola";

export default function AmappolaPage() {
  const product = getAmappolaProduct();
  const canPurchase = canPurchaseAmappola();

  return (
    <SiteShell tagline="街に落ちていた、名前のない言葉。">
      <article className="detail-page detail-page--amappola">
        <figure className="amappola-cover amappola-cover--hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={assetUrl(product.images[0])} alt={product.title} width={1024} height={768} />
        </figure>

        <header className="detail-antique-intro">
          <p className="detail-antique-eyebrow">街で拾った言葉</p>
          <h1 className="detail-antique-title">{product.title}</h1>
          <p className="amappola-author">{AMAPPOLA_META.split(" / ")[1]}</p>
        </header>

        <section className="detail-antique-section" aria-labelledby="amappola-about-heading">
          <h2 id="amappola-about-heading" className="detail-antique-section-title">
            説明
          </h2>
          <div className="amappola-description">
            {AMAPPOLA_DESCRIPTION.map((paragraph) => (
              <p key={paragraph} className="detail-antique-description">
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        {canPurchase ? (
          <section className="detail-antique-section detail-antique-section--actions">
            {product.priceLabel ? (
              <p className="detail-antique-price amappola-price-display">{product.priceLabel}</p>
            ) : null}
            <Link href="/amappola/purchase" className="action-btn action-btn--primary detail-antique-buy">
              購入する
            </Link>
            <p className="detail-antique-note">お支払い・発送先のご記入はこちらから。</p>
          </section>
        ) : null}
      </article>
    </SiteShell>
  );
}
