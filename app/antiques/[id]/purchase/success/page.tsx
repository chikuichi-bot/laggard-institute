import Link from "next/link";
import SiteShell from "@/components/SiteShell";
import { fulfillAntiqueCheckout } from "@/lib/checkout-session";
import { getItem } from "@/lib/items";
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

  if (sessionId && isStripeCheckoutAvailable()) {
    try {
      const result = await fulfillAntiqueCheckout(sessionId, item.id);
      verified = result.fulfilled;
      if (verified) {
        customerEmail =
          result.session.customer_details?.email ?? result.session.customer_email ?? undefined;
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
          {itemAfter?.priceLabel ? (
            <p className="purchase-page-lead purchase-page-lead--sub">
              お支払い金額: {itemAfter.priceLabel}
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
