import Link from "next/link";
import SiteShell from "@/components/SiteShell";
import { getItem } from "@/lib/items";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PurchaseSuccessPage({ params }: Props) {
  const { id } = await params;
  const item = await getItem("antiques", id);
  if (!item) notFound();

  return (
    <SiteShell tagline="お支払いありがとうございます">
      <article className="detail-page detail-page--purchase purchase-result">
        <header className="purchase-page-intro">
          <p className="detail-antique-eyebrow">クレジットカード</p>
          <h1 className="purchase-page-title">お支払いを受け付けました</h1>
          <p className="purchase-page-lead">
            {item.title} のご購入ありがとうございます。確認のうえ、ご連絡いたします。
          </p>
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
