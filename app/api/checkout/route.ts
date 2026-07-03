import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  checkoutProductImageUrl,
  type CheckoutCategory,
} from "@/lib/checkout-session";
import { getAmappolaProduct, canPurchaseAmappola, AMAPPOLA_PRODUCT_ID } from "@/lib/amappola";
import { getStripe, isStripeCheckoutAvailable } from "@/lib/stripe";
import { getItem } from "@/lib/items";
import { canPurchaseItem } from "@/lib/purchase-mailto";
import { calculateShipping } from "@/lib/shipping";
import type { CatalogItem } from "@/lib/types";

type CheckoutBody = {
  itemId?: string;
  category?: CheckoutCategory;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  message?: string;
};

function trimMeta(value: string | undefined, max = 500) {
  return (value ?? "").trim().slice(0, max);
}

function checkoutErrorMessage(error: unknown) {
  if (error instanceof Stripe.errors.StripeError) {
    return error.message;
  }
  return "決済ページの作成に失敗しました。";
}

async function resolveCheckoutItem(
  itemId: string,
  categoryHint?: CheckoutCategory,
): Promise<{ item: CatalogItem; category: CheckoutCategory } | null> {
  if (itemId === AMAPPOLA_PRODUCT_ID || categoryHint === "amappola") {
    const item = getAmappolaProduct();
    if (item.id !== itemId || !canPurchaseAmappola()) return null;
    return { item, category: "amappola" };
  }

  const item = await getItem("antiques", itemId);
  if (!item || !canPurchaseItem(item)) return null;
  return { item, category: "antiques" };
}

function purchaseSuccessPath(category: CheckoutCategory, itemId: string) {
  if (category === "amappola") return `/amappola/purchase/success`;
  return `/antiques/${itemId}/purchase/success`;
}

function purchaseCancelPath(category: CheckoutCategory, itemId: string) {
  if (category === "amappola") return `/amappola/purchase`;
  return `/antiques/${itemId}/purchase`;
}

export async function POST(request: Request) {
  if (!isStripeCheckoutAvailable()) {
    return NextResponse.json(
      { error: "カード決済は現在準備中です。銀行振込またはメールでお問い合わせください。" },
      { status: 503 },
    );
  }

  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "リクエストが不正です。" }, { status: 400 });
  }

  const itemId = body.itemId?.trim() ?? "";
  const name = trimMeta(body.name, 120);
  const email = trimMeta(body.email, 254);
  const phone = trimMeta(body.phone, 40);
  const address = trimMeta(body.address, 200);
  const message = trimMeta(body.message);

  if (!itemId) {
    return NextResponse.json({ error: "商品が指定されていません。" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "お名前を入力してください。" }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "メールアドレスを入力してください。" }, { status: 400 });
  }
  if (!phone || phone.replace(/\D/g, "").length < 10) {
    return NextResponse.json({ error: "電話番号を入力してください（発送の連絡用）。" }, { status: 400 });
  }
  if (!address || address.length < 5) {
    return NextResponse.json({ error: "ご住所を入力してください（発送先）。" }, { status: 400 });
  }

  const resolved = await resolveCheckoutItem(itemId, body.category);
  if (!resolved) {
    return NextResponse.json({ error: "この商品は現在購入できません。" }, { status: 404 });
  }

  const { item, category } = resolved;

  if (!item.price || item.price <= 0) {
    return NextResponse.json({ error: "価格が設定されていないため、カード決済できません。" }, { status: 400 });
  }

  const shipping = calculateShipping(address, item);
  const origin = new URL(request.url).origin;
  const stripe = getStripe();

  const productLine = {
    quantity: 1,
    price_data: {
      currency: "jpy" as const,
      unit_amount: item.price,
      product_data: {
        name: item.title,
        description: item.shippingIncluded
          ? `${item.description?.slice(0, 160) ?? ""}（クリックポスト送料込み）`.slice(0, 200) || undefined
          : item.description?.slice(0, 200) || undefined,
        images: checkoutProductImageUrl(origin, item.images[0])
          ? [checkoutProductImageUrl(origin, item.images[0])!]
          : undefined,
      },
    },
  };

  const line_items = item.shippingIncluded
    ? [productLine]
    : [
        productLine,
        {
          quantity: 1,
          price_data: {
            currency: "jpy" as const,
            unit_amount: shipping.yen,
            product_data: {
              name: "送料",
              description: `${shipping.label}（京都府発）`,
            },
          },
        },
      ];

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "ja",
      payment_method_types: ["card"],
      customer_email: email,
      line_items,
      success_url: `${origin}${purchaseSuccessPath(category, item.id)}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${purchaseCancelPath(category, item.id)}`,
      metadata: {
        itemId: item.id,
        category,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        customerAddress: address,
        customerMessage: message,
        shippingYen: String(item.shippingIncluded ? 0 : shipping.yen),
        shippingLabel: shipping.label,
        shippingMethod: item.shippingMethod ?? "yupack",
        shippingIncluded: item.shippingIncluded ? "true" : "false",
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "決済ページを作成できませんでした。" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[checkout]", error);
    return NextResponse.json({ error: checkoutErrorMessage(error) }, { status: 500 });
  }
}
