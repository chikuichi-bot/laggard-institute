export const dynamic = "force-dynamic";

import Link from "next/link";
import InquiryForm from "@/components/InquiryForm";
import SiteShell from "@/components/SiteShell";
import { getItem } from "@/lib/items";
import { canPurchaseItem } from "@/lib/purchase-mailto";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function AntiqueInquiryPage({ params }: Props) {
  const { id } = await params;
  const item = await getItem("antiques", id);
  if (!item || !canPurchaseItem(item)) notFound();

  return (
    <SiteShell tagline="購入のお問い合わせ">
      <article className="detail-page detail-page--purchase detail-page--inquiry">
        <header className="purchase-page-intro">
          <Link href={`/antiques/${item.id}`} className="purchase-page-back">
            ← {item.title}
          </Link>
          <p className="detail-antique-eyebrow">お問い合わせ</p>
          <h1 className="purchase-page-title">購入のお問い合わせ</h1>
          <p className="purchase-page-lead">
            お名前だけご記入いただければ結構です。購入・お支払いは
            <Link href={`/antiques/${item.id}/purchase`}>購入に進む</Link>
            からお願いします。
          </p>
        </header>

        <InquiryForm item={item} />
      </article>
    </SiteShell>
  );
}
