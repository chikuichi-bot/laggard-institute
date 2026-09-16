import Link from "next/link";
import PurchaseCheckout from "@/components/PurchaseCheckout";
import SiteShell from "@/components/SiteShell";
import { categoryLabel } from "@/lib/category";
import { canPurchaseItem } from "@/lib/purchase-mailto";
import { getItem, readCatalog } from "@/lib/items";
import { isLolipopStaticExport } from "@/lib/site-mode";
import { isStripeCheckoutAvailable } from "@/lib/stripe";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export async function generateStaticParams() {
  const items = await readCatalog("antiques");
  return items.filter(canPurchaseItem).map((item) => ({ id: item.id }));
}

export default async function AntiquePurchasePage({ params }: Props) {
  const { id } = await params;
  const item = await getItem("antiques", id);
  if (!item || !canPurchaseItem(item)) notFound();

  const stripeAvailable = !isLolipopStaticExport && isStripeCheckoutAvailable();
  const cardCheckoutReady = stripeAvailable && Boolean(item.price && item.price > 0);

  return (
    <SiteShell tagline="購入手続き">
      <article className="detail-page detail-page--purchase">
        <header className="purchase-page-intro">
          <Link href={`/antiques/${item.id}`} className="purchase-page-back">
            ← {item.title}
          </Link>
          <p className="detail-antique-eyebrow">購入</p>
          <h1 className="purchase-page-title">購入に進む</h1>
          <p className="purchase-page-lead">
            {item.price && item.price > 0
              ? "発送先の住所を入力すると、送料込みの合計が表示されます。"
              : "銀行振込でのお申し込み、またはお問い合わせから進めます。"}
          </p>
        </header>

        <PurchaseCheckout
          item={item}
          stripeAvailable={stripeAvailable}
          cardCheckoutReady={cardCheckoutReady}
          categoryLabel={categoryLabel("antiques")}
        />

        <section className="detail-antique-section detail-antique-section--actions detail-antique-section--actions-secondary">
          <Link href={`/antiques/${item.id}/inquiry`} className="action-btn detail-antique-buy">
            購入のお問い合わせ
          </Link>
          <p className="detail-antique-note">購入前のご質問はこちらから。</p>
        </section>
      </article>
    </SiteShell>
  );
}
