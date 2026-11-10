/** Lolipop 仮公開（営業日・地図・連絡のみ · 2026-07-03 `lagado/` 成果物と同型） */
export const isLolipopMinimal =
  process.env.NEXT_PUBLIC_LOLIPOP_MINIMAL === "1";

/**
 * Lolipop 静的 export（`build:lolipop`）。
 * API ルートは退避するため、カード決済だけ無効化する判定に使う。
 * 購入 CTA / 振込フォームは静的でも出す。
 */
export const isLolipopStaticExport = process.env.LOLIPOP_EXPORT === "1";
