import Link from "next/link";
import SiteShell from "@/components/SiteShell";
import { getAmappolaProduct } from "@/lib/amappola";

/**
 * 静的 export でも壊れない完了面。
 * Stripe の session 検証は webhook（Node ホスト）側に任せる。
 */
export default function AmappolaPurchaseSuccessPage() {
  const item = getAmappolaProduct();

  return (
    <SiteShell tagline="お支払いありがとうございます">
      <article className="detail-page detail-page--purchase purchase-result">
        <header className="purchase-page-intro">
          <p className="detail-antique-eyebrow">購入完了</p>
          <h1 className="purchase-page-title">ご購入ありがとうございます</h1>
          <p className="purchase-page-lead">
            {item.title} のご購入ありがとうございます。確認のうえ、ご連絡いたします。
          </p>
          {item.priceLabel ? (
            <p className="purchase-page-lead purchase-page-lead--sub">
              商品代金: {item.priceLabel}
            </p>
          ) : null}
        </header>
        <section className="purchase-form-actions detail-antique-section detail-antique-section--actions">
          <Link href="/amappola" className="action-btn purchase-form-submit">
            詩集ページへ戻る
          </Link>
        </section>
      </article>
    </SiteShell>
  );
}
