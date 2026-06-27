import type { CatalogItem, ItemCategory } from "./types";

export type ViewerSlide = {
  itemId: string;
  imageSrc: string;
  title: string;
  imageIndex: number;
  category?: ItemCategory;
};

export function buildViewerSlides(items: CatalogItem[]): ViewerSlide[] {
  return items.flatMap((item) =>
    item.images.map((imageSrc, imageIndex) => ({
      itemId: item.id,
      imageSrc,
      title: item.title,
      imageIndex,
    })),
  );
}

export function slideIndexForItem(
  slides: ViewerSlide[],
  itemId: string,
  imageIndex = 0,
): number {
  const index = slides.findIndex(
    (slide) => slide.itemId === itemId && slide.imageIndex === imageIndex,
  );
  return index >= 0 ? index : 0;
}
