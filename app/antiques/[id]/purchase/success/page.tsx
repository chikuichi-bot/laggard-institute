import Link from "next/link";
import SiteShell from "@/components/SiteShell";
import { getItem } from "@/lib/items";
import { canPurchaseItem } from "@/lib/purchase-mailto";
import { catalogStaticParams } from "@/lib/static-params";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return catalogStaticParams("antiques");
}

/**
 * 静的 export でも壊れない完了面（searchParams 非依存）。
 * Stripe session 検証は Node + webhook 側。
 */
export default async function PurchaseSuccessPage({ params }: Props) {
  const { id } = await params;
  const item = await getItem("antiques", id);
  if (!item) notFound();

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
          ) : canPurchaseItem(item) ? (
            <p className="purchase-page-lead purchase-page-lead--sub">
              金額はお申し込み内容・振込案内に沿ってご確認ください。
            </p>
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
