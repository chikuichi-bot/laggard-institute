import Link from "next/link";
import ItemGrid from "@/components/ItemGrid";
import type { CatalogItem, ItemCategory } from "@/lib/types";
import { categoryBasePath } from "@/lib/category";

type CatalogSectionProps = {
  title: string;
  category: ItemCategory;
  items: CatalogItem[];
  moreLabel?: string;
};

export default function CatalogSection({
  title,
  category,
  items,
  moreLabel = "すべて見る",
}: CatalogSectionProps) {
  const base = categoryBasePath(category);

  return (
    <section className="catalog-section">
      <div className="catalog-section-head">
        <h2>{title}</h2>
        <Link href={base} className="catalog-section-more">
          {moreLabel}
        </Link>
      </div>
      <ItemGrid category={category} items={items} compact />
    </section>
  );
}
