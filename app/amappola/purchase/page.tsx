import Link from "next/link";
import PurchaseCheckout from "@/components/PurchaseCheckout";
import SiteShell from "@/components/SiteShell";
import { canPurchaseAmappola, getAmappolaProduct } from "@/lib/amappola";
import { isStripeCheckoutAvailable } from "@/lib/stripe";
import { notFound } from "next/navigation";

export default function AmappolaPurchasePage() {
  const item = getAmappolaProduct();
  if (!canPurchaseAmappola()) notFound();

  const stripeAvailable = isStripeCheckoutAvailable();
  const cardCheckoutReady = stripeAvailable && Boolean(item.price && item.price > 0);

  return (
    <SiteShell tagline="購入手続き">
      <article className="detail-page detail-page--purchase">
        <header className="purchase-page-intro">
          <Link href="/amappola" className="purchase-page-back">
            ← {item.title}
          </Link>
          <p className="detail-antique-eyebrow">購入</p>
          <h1 className="purchase-page-title">購入に進む</h1>
          <p className="purchase-page-lead">
            本体と送料（クリックポスト・全国一律 ¥185）を分けて表示します。
          </p>
        </header>

        <PurchaseCheckout
          item={item}
          stripeAvailable={stripeAvailable}
          cardCheckoutReady={cardCheckoutReady}
          categoryLabel="詩集"
          checkoutCategory="amappola"
        />
      </article>
    </SiteShell>
  );
}
