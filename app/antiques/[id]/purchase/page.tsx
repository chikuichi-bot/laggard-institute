export const dynamic = "force-dynamic";

import Link from "next/link";
import PurchaseForm from "@/components/PurchaseForm";
import SiteShell from "@/components/SiteShell";
import { categoryLabel } from "@/lib/category";
import { canPurchaseItem } from "@/lib/purchase-mailto";
import { getItem } from "@/lib/items";
import { isStripeCheckoutAvailable } from "@/lib/stripe";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function AntiquePurchasePage({ params }: Props) {
  const { id } = await params;
  const item = await getItem("antiques", id);
  if (!item || !canPurchaseItem(item)) notFound();

  const hero = item.images[0];
  const stripeAvailable = isStripeCheckoutAvailable();

  return (
    <SiteShell tagline="購入のお問い合わせ">
      <article className="detail-page detail-page--purchase">
        <header className="purchase-page-intro">
          <Link href={`/antiques/${item.id}`} className="purchase-page-back">
            ← {item.title}
          </Link>
          <p className="detail-antique-eyebrow">購入記入</p>
          <h1 className="purchase-page-title">お問い合わせ内容</h1>
          <p className="purchase-page-lead">必要事項を記入して送信してください。</p>
        </header>

        <section
          className="purchase-page-product detail-antique-section"
          aria-labelledby="purchase-product-heading"
        >
          <h2 id="purchase-product-heading" className="detail-antique-section-title">
            商品
          </h2>
          <div className="purchase-page-product-body">
            {hero ? (
              <figure className="purchase-page-photo">
                <div className="purchase-page-photo-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={hero} alt="" />
                </div>
              </figure>
            ) : null}
            <dl className="detail-antique-facts purchase-page-facts">
              <div className="detail-antique-fact">
                <dt>品名</dt>
                <dd>{item.title}</dd>
              </div>
              {item.priceLabel ? (
                <div className="detail-antique-fact">
                  <dt>価格</dt>
                  <dd className="detail-antique-price">{item.priceLabel}</dd>
                </div>
              ) : null}
              <div className="detail-antique-fact">
                <dt>カテゴリー</dt>
                <dd>{categoryLabel("antiques")}</dd>
              </div>
            </dl>
          </div>
        </section>

        <PurchaseForm item={item} stripeAvailable={stripeAvailable} />
      </article>
    </SiteShell>
  );
}
