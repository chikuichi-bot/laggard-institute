import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/constants";
import { categoryBasePath, categoryLabel } from "@/lib/items";
import type { CatalogItem, ItemCategory } from "@/lib/types";

type ItemDetailViewProps = {
  category: ItemCategory;
  item: CatalogItem;
};

function purchaseMailto(item: CatalogItem) {
  const subject = encodeURIComponent(`購入希望：${item.title}`);
  const body = encodeURIComponent(
    `${item.title} について購入を検討しています。\n\n商品ID: ${item.id}\n`,
  );
  return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}

export default function ItemDetailView({ category, item }: ItemDetailViewProps) {
  const base = categoryBasePath(category);
  const isAntique = category === "antiques";
  const canPurchase = isAntique && item.forSale && !item.sold;
  const [hero, ...thumbs] = item.images;

  return (
    <>
      <div className="action-bar">
        <Link href={base} className="action-btn">
          ← {categoryLabel(category)}一覧
        </Link>
        {canPurchase ? (
          <a className="action-btn action-btn--primary" href={purchaseMailto(item)}>
            購入のお問い合わせ
          </a>
        ) : null}
      </div>

      <article className="detail-card detail-card--photo">
        <div className="detail-photos">
          {hero ? (
            <>
              <figure className="detail-hero">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={hero} alt={item.title} />
              </figure>
              {thumbs.length > 0 ? (
                <div className="detail-thumbs">
                  {thumbs.map((src, index) => (
                    <figure key={src}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`${item.title} ${index + 2}`} />
                    </figure>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="item-placeholder item-placeholder--hero" aria-hidden>
              <span>写真なし</span>
            </div>
          )}
        </div>

        <div className="detail-body">
          <div className="text-wrapper detail-vertical-wrap">
            <p className="vertical-text">{item.description}</p>
          </div>

          <footer className="detail-meta-block">
            <h1>{item.title}</h1>
            {item.location ? <p>{item.location}</p> : null}
            {item.foundAt ? <p>{item.foundAt}</p> : null}
            {isAntique && item.priceLabel ? (
              <p className="detail-price">{item.priceLabel}</p>
            ) : null}
            {isAntique && item.sold ? <p className="item-card-sold">売約済み</p> : null}
          </footer>
        </div>
      </article>
    </>
  );
}
