import Link from "next/link";
import SiteShell from "@/components/SiteShell";
import { fulfillCheckout } from "@/lib/checkout-session";
import { getItem } from "@/lib/items";
import { formatPriceLabel } from "@/lib/price";
import { isStripeCheckoutAvailable } from "@/lib/stripe";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session_id?: string }>;
};

export default async function PurchaseSuccessPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { session_id: sessionId } = await searchParams;
  const item = await getItem("antiques", id);
  if (!item) notFound();

  let verified = false;
  let customerEmail: string | undefined;
  let shippingYen: number | undefined;
  let shippingLabel: string | undefined;
  let amountTotal: number | undefined;

  if (sessionId && isStripeCheckoutAvailable()) {
    try {
      const result = await fulfillCheckout(sessionId, item.id, "antiques");
      verified = result.fulfilled;
      if (verified) {
        customerEmail =
          result.session.customer_details?.email ?? result.session.customer_email ?? undefined;
        shippingYen = Number(result.session.metadata?.shippingYen) || undefined;
        shippingLabel = result.session.metadata?.shippingLabel;
        amountTotal = result.session.amount_total ?? undefined;
      }
    } catch {
      verified = false;
    }
  }

  const itemAfter = verified ? await getItem("antiques", id) : item;

  return (
    <SiteShell tagline="お支払いありがとうございます">
      <article className="detail-page detail-page--purchase purchase-result">
        <header className="purchase-page-intro">
          <p className="detail-antique-eyebrow">クレジットカード</p>
          <h1 className="purchase-page-title">
            {verified ? "お支払いを受け付けました" : "ご購入ありがとうございます"}
          </h1>
          <p className="purchase-page-lead">
            {verified
              ? `${item.title} のご購入を確認しました。${customerEmail ? `（${customerEmail}）` : ""} 発送・受け渡しのご案内をいたします。`
              : `${item.title} のご購入ありがとうございます。確認のうえ、ご連絡いたします。`}
          </p>
          {verified && amountTotal ? (
            <p className="purchase-page-lead purchase-page-lead--sub">
              お支払い合計: {formatPriceLabel(amountTotal)}
              {shippingYen ? `（送料 ${formatPriceLabel(shippingYen)}${shippingLabel ? ` · ${shippingLabel}` : ""}）` : ""}
            </p>
          ) : itemAfter?.priceLabel ? (
            <p className="purchase-page-lead purchase-page-lead--sub">
              商品代金: {itemAfter.priceLabel}
            </p>
          ) : null}
          {verified && itemAfter?.sold ? (
            <p className="purchase-page-lead purchase-page-lead--sub">この商品は売約済みに更新されました。</p>
          ) : null}
        </header>
        <section className="purchase-form-actions detail-antique-section detail-antique-section--actions">
          <Link href={`/antiques/${item.id}`} className="action-btn purchase-form-submit">
            商品ページへ戻る
          </Link>
          <Link href="/antiques" className="action-btn">
            古道具一覧
          </Link>
        </section>
      </article>
    </SiteShell>
  );
}
