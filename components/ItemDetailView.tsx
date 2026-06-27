import Link from "next/link";
import DetailPhotoViewer from "@/components/DetailPhotoViewer";
import { catalogDisplayTitle, categoryBasePath, categoryLabel } from "@/lib/category";
import { canPurchaseItem } from "@/lib/purchase-mailto";
import type { CatalogItem, ItemCategory } from "@/lib/types";

type ItemDetailViewProps = {
  category: ItemCategory;
  item: CatalogItem;
  items: CatalogItem[];
};

export default function ItemDetailView({ category, item, items }: ItemDetailViewProps) {
  const base = categoryBasePath(category);
  const isAntique = category === "antiques";
  const displayTitle = catalogDisplayTitle(item, category);
  const canPurchase = canPurchaseItem(item);

  if (isAntique) {
    return (
      <article className="detail-page detail-page--antique">
        <header className="detail-antique-intro">
            <p className="detail-antique-eyebrow">{categoryLabel(category)}</p>
            <h1 className="detail-antique-title">{item.title}</h1>
            <dl className="detail-antique-facts">
              <div className="detail-antique-fact">
                <dt>状態</dt>
                <dd>
                  {item.sold ? (
                    <span className="detail-antique-badge detail-antique-badge--sold">売約済み</span>
                  ) : item.forSale ? (
                    <span className="detail-antique-badge detail-antique-badge--sale">販売中</span>
                  ) : (
                    "展示"
                  )}
                </dd>
              </div>
              {item.priceLabel ? (
                <div className="detail-antique-fact">
                  <dt>価格</dt>
                  <dd className="detail-antique-price">{item.priceLabel}</dd>
                </div>
              ) : null}
              {item.location ? (
                <div className="detail-antique-fact">
                  <dt>場所</dt>
                  <dd>{item.location}</dd>
                </div>
              ) : null}
            </dl>
        </header>

        <DetailPhotoViewer category={category} item={item} items={items} />

        {item.description ? (
          <section className="detail-antique-section" aria-labelledby="detail-antique-about-heading">
            <h2 id="detail-antique-about-heading" className="detail-antique-section-title">
              説明
            </h2>
            <p className="detail-antique-description">{item.description}</p>
          </section>
        ) : null}

        {canPurchase ? (
          <section className="detail-antique-section detail-antique-section--actions">
            <Link
              href={`/antiques/${item.id}/purchase`}
              className="action-btn action-btn--primary detail-antique-buy"
            >
              購入のお問い合わせ
            </Link>
            <p className="detail-antique-note">記入ページへ進み、内容をお送りください。</p>
          </section>
        ) : null}
      </article>
    );
  }

  return (
    <>
      <div className="action-bar">
        <Link href={base} className="action-btn">
          ← {categoryLabel(category)}一覧
        </Link>
      </div>

      <article className="detail-page detail-page--photo">
        <DetailPhotoViewer category={category} item={item} items={items} />

        {displayTitle ? (
          <footer className="detail-meta-block detail-meta-block--place-only">
            <h1>{displayTitle}</h1>
          </footer>
        ) : null}
      </article>
    </>
  );
}
