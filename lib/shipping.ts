import type { CatalogItem } from "./types";

export type ShippingZone =
  | "kyoto"
  | "kinki"
  | "chugoku_shikoku"
  | "kanto_tokai_tohoku"
  | "kyushu"
  | "hokkaido"
  | "okinawa"
  | "unknown";

export type ShippingQuote = {
  yen: number;
  label: string;
  zone: ShippingZone;
  prefecture: string | null;
  /** 商品価格に送料を含む場合 */
  included?: boolean;
};

/** 日本郵便クリックポスト（全国一律・税込） */
export const CLICK_POST_FLAT_YEN = 185;

export const CLICK_POST_LABEL = "クリックポスト（全国一律）";

type ShippingItem = Pick<
  CatalogItem,
  "shippingSize" | "shippingMethod" | "shippingIncluded"
>;

/** 発送元（ラガード研究所） */
export const SHIPPING_ORIGIN = "京都府";

const PREFECTURES = [
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
] as const;

const ZONE_LABELS: Record<ShippingZone, string> = {
  kyoto: "京都府内",
  kinki: "近畿",
  chugoku_shikoku: "中国・四国",
  kanto_tokai_tohoku: "関東・東海・東北・北陸・甲信",
  kyushu: "九州",
  hokkaido: "北海道",
  okinawa: "沖縄",
  unknown: "その他",
};

/** 京都発・ゆうパック想定の地域別送料（税込・標準サイズ） */
const ZONE_RATES: Record<ShippingZone, number> = {
  kyoto: 770,
  kinki: 880,
  chugoku_shikoku: 990,
  kanto_tokai_tohoku: 1050,
  kyushu: 1150,
  hokkaido: 1250,
  okinawa: 1580,
  unknown: 1050,
};

const PREFECTURE_ZONE: Record<string, ShippingZone> = {
  京都府: "kyoto",
  滋賀県: "kinki",
  大阪府: "kinki",
  兵庫県: "kinki",
  奈良県: "kinki",
  和歌山県: "kinki",
  三重県: "kinki",
  鳥取県: "chugoku_shikoku",
  島根県: "chugoku_shikoku",
  岡山県: "chugoku_shikoku",
  広島県: "chugoku_shikoku",
  山口県: "chugoku_shikoku",
  徳島県: "chugoku_shikoku",
  香川県: "chugoku_shikoku",
  愛媛県: "chugoku_shikoku",
  高知県: "chugoku_shikoku",
  福岡県: "kyushu",
  佐賀県: "kyushu",
  長崎県: "kyushu",
  熊本県: "kyushu",
  大分県: "kyushu",
  宮崎県: "kyushu",
  鹿児島県: "kyushu",
  北海道: "hokkaido",
  沖縄県: "okinawa",
};

const SIZE_SURCHARGE = {
  small: 0,
  standard: 0,
  large: 400,
} as const;

export function detectPrefecture(address: string): string | null {
  const normalized = address.replace(/\s/g, "");
  if (!normalized) return null;

  const sorted = [...PREFECTURES].sort((a, b) => b.length - a.length);
  for (const prefecture of sorted) {
    if (normalized.includes(prefecture)) return prefecture;
  }

  if (normalized.includes("京都") && !normalized.includes("東京都")) return "京都府";
  if (normalized.includes("東京") && !normalized.includes("京都")) return "東京都";
  if (normalized.includes("大阪")) return "大阪府";
  if (normalized.includes("北海道")) return "北海道";
  if (normalized.includes("沖縄")) return "沖縄県";

  return null;
}

function shippingZone(prefecture: string | null): ShippingZone {
  if (!prefecture) return "unknown";
  return PREFECTURE_ZONE[prefecture] ?? "kanto_tokai_tohoku";
}

export function calculateShipping(address: string, item?: ShippingItem): ShippingQuote {
  const prefecture = detectPrefecture(address);

  if (item?.shippingMethod === "click_post") {
    if (item.shippingIncluded) {
      return {
        yen: 0,
        label: "クリックポスト（送料込み）",
        zone: "unknown",
        prefecture,
        included: true,
      };
    }
    return {
      yen: CLICK_POST_FLAT_YEN,
      label: CLICK_POST_LABEL,
      zone: "unknown",
      prefecture,
    };
  }

  const zone = shippingZone(prefecture);
  const size = item?.shippingSize ?? "standard";
  const surcharge = SIZE_SURCHARGE[size] ?? 0;
  const yen = ZONE_RATES[zone] + surcharge;
  const regionLabel = prefecture ?? ZONE_LABELS[zone];
  const label =
    surcharge > 0
      ? `${regionLabel}（${ZONE_LABELS[zone]}・大型）`
      : `${regionLabel}（${ZONE_LABELS[zone]}）`;

  return { yen, label, zone, prefecture };
}

export function shippingQuoteReady(address: string, item?: ShippingItem): boolean {
  if (item?.shippingIncluded) return true;
  if (item?.shippingMethod === "click_post") return true;
  return address.trim().length >= 5;
}

export function purchaseTotalYen(itemPrice: number | undefined, shippingYen: number) {
  return (itemPrice ?? 0) + shippingYen;
}
