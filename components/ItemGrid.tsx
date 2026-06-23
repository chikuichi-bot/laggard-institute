import Link from "next/link";
import type { CatalogItem, ItemCategory } from "@/lib/types";
import { categoryBasePath, categoryLabel } from "@/lib/items";

type ItemGridProps = {
  category: ItemCategory;
  items: CatalogItem[];
};

function cardOrientation(item: CatalogItem): "portrait" | "landscape" | "square" {
  if (item.orientation) return item.orientation;
  if (item.images[0]?.includes("knolling")) return "landscape";
  return "portrait";
}

export default function ItemGrid({ category, items }: ItemGridProps) {
  const base = categoryBasePath(category);

  if (items.length === 0) {
    return (
      <article className="content-card content-card--flat">
        <div className="horizontal-body empty-catalog">
          <p>まだ記録がありません。</p>
          <p className="empty-hint">
            iPhone で撮影したものは
            <Link href="/admin"> 作業ページ </Link>
            から送れます。
          </p>
        </div>
      </article>
    );
  }

  return (
    <div className="item-grid">
      {items.map((item) => {
        const orientation = cardOrientation(item);
        return (
          <Link
            key={item.id}
            href={`${base}/${item.id}`}
            className={`item-card item-card--${orientation}`}
          >
            <div className="item-card-image">
              {item.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.images[0]} alt={item.title} loading="lazy" decoding="async" />
              ) : (
                <div className="item-placeholder" aria-hidden>
                  <span>{categoryLabel(category).slice(0, 2)}</span>
                </div>
              )}
            </div>
            <div className="item-card-body">
              <h2>{item.title}</h2>
              {item.location ? <p className="item-card-meta">{item.location}</p> : null}
              {category === "antiques" && item.forSale && !item.sold ? (
                <p className="item-card-price">{item.priceLabel ?? "要問合せ"}</p>
              ) : null}
              {category === "antiques" && item.sold ? (
                <p className="item-card-sold">売約済み</p>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
